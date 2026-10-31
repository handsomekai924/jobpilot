/**
 * 匹配工作台：发起匹配（搜索范围 + 可选勾选）+ 任务进度 + 匹配结果。
 *
 * 左栏配置、右栏结果，窄屏堆叠；布局与搜索范围细节见
 * `notes/apps/web/src/views/shared/match/WorkbenchSection.md`。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";

import {
  Button, EmptyState, Pill, ScrollArea, Select, Skeleton, Surface, TaskPanel, TextField,
} from "@/components";
import { useToast } from "@/components";
import { typeScale } from "@/theme/tokens";
import { fmtNumber, fmtTime } from "@/utils/format";
import {
  errText, rank, PAGE_SIZE, TASK_TERMINAL, type CrawlPick, type JobPick, type MatchItem, type MatchTaskSnap,
} from "@/views/shared/match/types";
import { MatchCard } from "@/views/shared/match/MatchCard";
import { crawlBatchApi, interviewApi, matchApi } from "@/api/shared";
import { toTaskEvents } from "@/views/shared/taskEvents";

/** 结果卡骨架：几何对齐 MatchCard（圆环 + 两行文案 + 招呼语框 + 按钮行），预占最终空间免得回弹。 */
function MatchCardSkeleton() {
  return (
    <Surface sx={{ mb: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }} aria-hidden>
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
        <Skeleton variant="circular" width={56} height={56} sx={{ flex: "0 0 auto" }} />
        <Box sx={{ flex: 1, minWidth: 0, pt: 0.5 }}>
          <Skeleton variant="text" width="55%" height={18} />
          <Skeleton variant="text" width="38%" height={14} sx={{ mt: 0.5 }} />
          <Skeleton variant="text" width="72%" height={14} sx={{ mt: 0.5 }} />
        </Box>
      </Box>
      <Skeleton variant="rectangular" height={64} />
      <Box sx={{ display: "flex", gap: 1 }}>
        <Skeleton variant="rectangular" width={88} height={28} />
        <Skeleton variant="rectangular" width={88} height={28} />
        <Skeleton variant="rectangular" width={56} height={28} />
      </Box>
    </Surface>
  );
}

/** 匹配工作台段：左栏发起匹配，右栏任务进度与结果卡。 */
export function WorkbenchSection({
  resumes, resumeId, onResumeId,
  taskSnap, liveTask, activeTaskId, resultsLoading,
  analysisId, matches, drafts, busyJid, expandedJid,
  onAdoptTask, onSetMatches, onSetDrafts,
  onSetBusyJid, onSetExpandedJid, onClearResults,
}: {
  resumes: { resume_id: string; title: string; parsed?: boolean }[];
  resumeId: string;
  onResumeId: (id: string) => void;
  taskSnap: MatchTaskSnap | null;
  liveTask: { title?: string; status: string; done: number; total: number; current?: string; error?: string | null; events?: unknown[] } | null;
  activeTaskId: string | null;
  /** 历史载入详情在途：结果区先摆骨架屏占位，别用空态把布局压扁 */
  resultsLoading: boolean;
  analysisId: string | null;
  matches: MatchItem[];
  drafts: Record<string, string>;
  busyJid: string | null;
  expandedJid: string | null;
  onAdoptTask: (snap: MatchTaskSnap) => void;
  onSetMatches: (fn: (prev: MatchItem[]) => MatchItem[]) => void;
  onSetDrafts: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  onSetBusyJid: (id: string | null) => void;
  onSetExpandedJid: (fn: (prev: string | null) => string | null) => void;
  onClearResults: () => void;
}) {
  const toast = useToast();

  const [starting, setStarting] = useState(false);
  const [jobs, setJobs] = useState<JobPick[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobPage, setJobPage] = useState(0);
  const [jobQuery, setJobQuery] = useState("");
  const [jobApplied, setJobApplied] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [crawls, setCrawls] = useState<CrawlPick[]>([]);
  const [crawlId, setCrawlId] = useState("");

  /** 搜索词防抖 300ms 后才作为查询条件。 */
  useEffect(() => {
    const t = setTimeout(() => {
      setJobApplied((prev) => {
        const next = jobQuery.trim();
        return prev === next ? prev : next;
      });
      setJobPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [jobQuery]);

  /** 按批次 / 分页 / 搜索词拉候选岗位。 */
  useEffect(() => {
    let dead = false;
    void (async () => {
      try {
        const data = await interviewApi.jobs({
          title: jobApplied || undefined,
          crawl_task_id: crawlId || undefined,
          limit: PAGE_SIZE,
          offset: jobPage * PAGE_SIZE,
        });
        if (dead) return;
        setJobs((data.items ?? []) as unknown as JobPick[]);
        setJobsTotal(data.total ?? 0);
      } catch (e) {
        if (!dead) toast.toast(errText(e), "danger");
      }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crawlId, jobPage, jobApplied]);

  /** 拉抓取批次供下拉。 */
  useEffect(() => {
    let dead = false;
    void (async () => {
      try {
        const data = await crawlBatchApi.tasks({ limit: 100 });
        if (dead) return;
        setCrawls(
          (data.items ?? []).map((t) => ({
            task_id: t.task_id,
            title: String((t.params as { title?: string } | undefined)?.title ?? "抓取任务"),
            created_at: t.created_at,
            site: t.site,
          })),
        );
      } catch (e) {
        if (!dead) toast.toast(errText(e), "danger");
      }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 发起匹配：勾了岗位只匹配这些，没勾按搜索范围（批次 / 全库）。 */
  const startMatch = async () => {
    if (!resumeId) {
      toast.toast("先选择一份简历", "warn");
      return;
    }
    setStarting(true);
    try {
      const body: { resume_id: string; job_ids?: string[]; crawl_task_id?: string } = { resume_id: resumeId };
      if (selected.size) body.job_ids = [...selected];
      else if (crawlId) body.crawl_task_id = crawlId;
      const snap = (await matchApi.analyze(body)) as unknown as MatchTaskSnap;
      onAdoptTask(snap);
      toast.toast("匹配已启动", "ok");
    } catch (e) {
      toast.toast(errText(e), "danger");
    } finally {
      setStarting(false);
    }
  };

  /** 请求停止当前匹配任务。 */
  const cancelTask = async () => {
    const id = activeTaskId || taskSnap?.task_id;
    if (!id) return;
    try {
      await matchApi.cancel(id);
      toast.toast("已请求停止", "ok");
    } catch (e) {
      toast.toast(errText(e), "danger");
    }
  };

  /** 勾选 / 取消勾选一个候选岗位。 */
  const toggleSelected = (jid: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });

  const latestRef = useRef({ analysisId, drafts, matches });
  latestRef.current = { analysisId, drafts, matches };

  /** 招呼语草稿按 id 写回（正在输入的那张卡才重渲染）。 */
  const handleDraft = useCallback((jid: string, text: string) => {
    onSetDrafts((prev) => ({ ...prev, [jid]: text }));
  }, [onSetDrafts]);

  /** 展开/收起详情按 id 切（只有变化的两张卡重渲染）。 */
  const handleToggleDetail = useCallback((jid: string) => {
    onSetExpandedJid((prev) => (prev === jid ? null : jid));
  }, [onSetExpandedJid]);

  /** 保存某条结果的招呼语并清掉草稿。 */
  const saveGreeting = useCallback(async (jid: string) => {
    const cur = latestRef.current;
    if (!cur.analysisId) return;
    const text = cur.drafts[jid] ?? cur.matches.find((m) => m.encrypt_job_id === jid)?.greeting ?? "";
    onSetBusyJid(jid);
    try {
      const r = (await matchApi.patchGreeting(cur.analysisId, jid, text)) as { item?: MatchItem };
      onSetMatches((prev) => rank(prev.map((m) => (m.encrypt_job_id === jid ? (r.item ?? { ...m, greeting: text }) : m))));
      onSetDrafts((prev) => {
        const next = { ...prev };
        delete next[jid];
        return next;
      });
      toast.toast("招呼语已保存", "ok");
    } catch (e) {
      toast.toast(errText(e), "danger");
    } finally {
      onSetBusyJid(null);
    }
  }, [onSetBusyJid, onSetDrafts, onSetMatches, toast]);

  /** 重打某条招呼语草稿，只回草稿不落库。 */
  const regenGreeting = useCallback(async (jid: string) => {
    const cur = latestRef.current;
    if (!cur.analysisId) return;
    onSetBusyJid(jid);
    try {
      const r = await matchApi.regenGreeting(cur.analysisId, jid);
      onSetDrafts((prev) => ({ ...prev, [jid]: r.greeting }));
      toast.toast("已生成新草稿，确认后记得保存", "ok");
    } catch (e) {
      toast.toast(errText(e), "danger");
    } finally {
      onSetBusyJid(null);
    }
  }, [onSetBusyJid, onSetDrafts, toast]);

  /** 单条重跑：原地替换这一条，不往列表塞新行。 */
  const rematchOne = useCallback(async (jid: string) => {
    const cur = latestRef.current;
    if (!cur.analysisId) return;
    onSetBusyJid(jid);
    try {
      const r = (await matchApi.rematch(cur.analysisId, jid)) as { item?: MatchItem };
      if (r.item) onSetMatches((prev) => rank(prev.map((m) => (m.encrypt_job_id === jid ? r.item! : m))));
      toast.toast("已重跑这一条", "ok");
    } catch (e) {
      toast.toast(errText(e), "danger");
    } finally {
      onSetBusyJid(null);
    }
  }, [onSetBusyJid, onSetMatches, toast]);

  const panelStatus = liveTask?.status ?? taskSnap?.status ?? "running";
  const panelDone = liveTask?.done ?? taskSnap?.done ?? 0;
  const panelTotal = liveTask?.total ?? taskSnap?.total ?? 0;
  const panelPercent = panelTotal > 0 ? Math.round((panelDone / panelTotal) * 100) : undefined;
  const panelCurrent = liveTask?.current ?? taskSnap?.current_job ?? "";
  const panelError = liveTask?.error ?? taskSnap?.error ?? null;
  const panelEvents = toTaskEvents(taskSnap?.events ?? liveTask?.events, 20);
  const panelCounts: [string, string][] | undefined =
    panelTotal > 0
      ? [["进度", `${fmtNumber(panelDone)}/${fmtNumber(panelTotal)}`]]
      : panelDone > 0
        ? [["已处理", fmtNumber(panelDone)]]
        : undefined;
  const taskRunning = !!activeTaskId && !TASK_TERMINAL.has(panelStatus);
  const pageCount = Math.max(1, Math.ceil(jobsTotal / PAGE_SIZE));
  const showResultSkeletons = resultsLoading || (taskRunning && matches.length === 0);

  return (
    <Box
      data-testid="match-workbench-cols"
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        gap: 2.5,
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        overflowY: { xs: "auto", md: "hidden" },
      }}
    >
      <Box
        role="region"
        aria-label="匹配设置"
        data-testid="match-setup-col"
        sx={{
          width: { xs: "100%", md: 360 },
          flex: { xs: "1 1 auto", md: "0 0 360px" },
          maxWidth: { md: 380 },
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          minHeight: { xs: "auto", md: 0 },
          overflowY: { xs: "visible", md: "hidden" },
        }}
      >
        <ScrollArea sx={{ flex: { xs: "0 0 auto", md: 1 }, minHeight: { xs: "auto", md: 0 }, overflowY: { xs: "visible", md: "auto" } }}>
          <Surface>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <Select
              label="简历"
              options={resumes.map((r) => ({
                code: r.resume_id,
                name: r.parsed ? r.title : `${r.title}（未解析）`,
              }))}
              value={resumeId}
              onChange={onResumeId}
              emptyLabel={null}
              sx={{ minWidth: 0, flex: "1 1 160px" }}
            />
            <Button variant="filled" onClick={() => void startMatch()} disabled={starting}>
              {starting ? "启动中…" : selected.size ? `匹配选中 ${selected.size}` : "开始匹配"}
            </Button>
          </Box>

          <Box
            data-testid="match-scope-row"
            sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mt: 1.5 }}
          >
            <Select
              label="抓取批次"
              options={crawls.map((c) => ({
                code: c.task_id,
                name: `${c.title || "抓取任务"} · ${fmtTime(c.created_at)}`,
              }))}
              value={crawlId}
              onChange={(v) => { setCrawlId(v); setJobPage(0); }}
              emptyLabel="不限"
              sx={{ flex: "1 1 140px", minWidth: 140 }}
            />
            <TextField
              label="搜职位名"
              type="search"
              placeholder="按职位名模糊匹配…"
              value={jobQuery}
              onChange={(e) => setJobQuery(e.target.value)}
              sx={{ flex: "1 1 140px", minWidth: 140 }}
            />
          </Box>

          <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <Pill tone={selected.size ? "accent" : "static"}>已选 {selected.size}</Pill>
              <Button size="small" variant="gray" onClick={() => setSelected(new Set(jobs.map((j) => j.encrypt_job_id)))}>
                全选本页
              </Button>
              <Button size="small" variant="plain" onClick={() => setSelected(new Set())}>清空</Button>
            </Box>
            {jobs.length === 0 ? (
              <Typography sx={{ ...typeScale.s, color: "text.secondary" }}>没有可勾选的职位</Typography>
            ) : (
              <>
                <Box sx={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {jobs.map((j) => {
                    const meta = [j.location, j.salary_desc].filter(Boolean).join(" · ");
                    return (
                      <Box
                        key={j.encrypt_job_id}
                        component="label"
                        sx={{
                          display: "flex", gap: 1, alignItems: "center", cursor: "pointer",
                          p: 1, borderRadius: "10px",
                          "&:hover": { bgcolor: "action.hover" },
                        }}
                      >
                        <input
                          type="checkbox"
                          style={{ flex: "0 0 auto" }}
                          checked={selected.has(j.encrypt_job_id)}
                          onChange={() => toggleSelected(j.encrypt_job_id)}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ ...typeScale.bodySm, overflowWrap: "anywhere" }}>
                            {j.job_name} @ {j.brand_name}
                          </Typography>
                          {meta && (
                            <Typography noWrap title={meta} sx={{ ...typeScale.s, color: "text.secondary" }}>
                              {meta}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
                  <Button
                    size="small" variant="gray"
                    sx={{ flex: "0 0 auto" }}
                    disabled={jobPage <= 0}
                    onClick={() => setJobPage((p) => p - 1)}
                  >
                    上一页
                  </Button>
                  <Button
                    size="small" variant="gray"
                    sx={{ flex: "0 0 auto" }}
                    disabled={jobPage + 1 >= pageCount}
                    onClick={() => setJobPage((p) => p + 1)}
                  >
                    下一页
                  </Button>
                  <Typography
                    sx={{
                      ...typeScale.s,
                      color: "text.secondary",
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                      flexBasis: "100%",
                      textAlign: "center",
                    }}
                  >
                    第 {jobPage + 1} / {pageCount} 页 · 共 {fmtNumber(jobsTotal)} 个职位
                  </Typography>
                </Box>
              </>
            )}
          </Box>
          </Surface>
        </ScrollArea>
      </Box>

      <Box
        role="region"
        aria-label="匹配结果区"
        data-testid="match-results-col"
        sx={{
          flex: 1,
          minWidth: 0,
          width: { xs: "100%" },
          display: "flex",
          flexDirection: "column",
          minHeight: { xs: "auto", md: 0 },
          overflowY: { xs: "visible", md: "hidden" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flex: "0 0 auto" }}>
          <Typography sx={{ ...typeScale.m, fontWeight: 600, flex: 1 }}>匹配结果</Typography>
          {matches.length > 0 && (
            <>
              <Pill tone="static">{fmtNumber(matches.length)} 条</Pill>
              <Button size="small" variant="plain" onClick={onClearResults}>清空</Button>
            </>
          )}
        </Box>

        <ScrollArea sx={{ flex: { xs: "0 0 auto", md: 1 }, minHeight: { xs: "auto", md: 0 }, overflowY: { xs: "visible", md: "auto" } }}>
        {(taskSnap || liveTask) && (
          <Box sx={{ mb: 2.5 }}>
            <TaskPanel
              title={liveTask?.title || "人岗匹配"}
              status={panelStatus}
              percent={panelPercent}
              current={panelCurrent || undefined}
              counts={panelCounts}
              error={panelError}
              events={panelEvents}
              stopLabel="取消"
              onStop={taskRunning ? () => void cancelTask() : undefined}
              extra={
                <Button size="small" variant="plain" onClick={onClearResults}>收起</Button>
              }
            />
          </Box>
        )}

        {showResultSkeletons ? (
          <Box role="status" aria-label="匹配结果加载中" data-testid="match-results-skeleton">
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </Box>
        ) : matches.length === 0 ? (
          <EmptyState title="启动匹配后，结果会按分数从高到低排在这里" />
        ) : (
          <Box>
            {matches.map((m) => (
              <MatchCard
                key={m.encrypt_job_id}
                item={m}
                draft={drafts[m.encrypt_job_id]}
                busy={busyJid === m.encrypt_job_id}
                expanded={expandedJid === m.encrypt_job_id}
                onDraft={handleDraft}
                onToggleDetail={handleToggleDetail}
                onSave={saveGreeting}
                onRegen={regenGreeting}
                onRematch={rematchOne}
              />
            ))}
          </Box>
        )}
        </ScrollArea>
      </Box>
    </Box>
  );
}
