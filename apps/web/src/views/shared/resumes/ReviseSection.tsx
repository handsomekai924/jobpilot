/**
 * 简历优化：定向（岗位 / 批次 / 全库）与自由（章节 + 提示词）两种改稿向导。
 *
 * 目标范围与启动参数口径见 `notes/apps/web/src/views/shared/resumes/ReviseSection.md`；
 * 任务轮询在页面壳，这层只管表单、启动 / 停止与完成后的跳转。
 */

import { useEffect, useState } from "react";
import { Box, Checkbox, Typography } from "@mui/material";

import {
  Button, EmptyState, ScrollArea, SegmentedControl, Select, Skeleton, Surface, TaskPanel,
  TextField, pageRootSx, useToast,
} from "@/components";
import { typeScale } from "@/theme/tokens";
import { fmtNumber, fmtTime } from "@/utils/format";
import { crawlBatchApi, interviewApi, resumeApi } from "@/api/shared";
import { toTaskEvents } from "@/views/shared/taskEvents";
import {
  JOB_PAGE_SIZE, MAX_TARGET, MODE_OPTIONS, msgOf, reviseTerminal,
  type JobPickRow, type PresetItem, type ResumeListItem, type ReviseMode, type ReviseSnapshot,
  type SectionItem,
} from "@/views/shared/resumes/types";

/** 优化段：选简历与模式，定向勾岗位或自由选章节，启动 / 停止任务。 */
export function ReviseSection({
  resumes, currentId, task, onTaskChange, onViewRevision,
}: {
  resumes: ResumeListItem[];
  currentId: string;
  task: ReviseSnapshot | null;
  onTaskChange: (s: ReviseSnapshot | null) => void;
  onViewRevision: (revisionId: string) => void;
}) {
  const toast = useToast();
  const [resumeId, setResumeId] = useState(currentId || resumes[0]?.resume_id || "");
  const [mode, setMode] = useState<ReviseMode>("targeted");

  const [jobIds, setJobIds] = useState<string[]>([]);
  const [crawlTaskId, setCrawlTaskId] = useState("");
  const [jobs, setJobs] = useState<JobPickRow[]>([]);
  const [jobTotal, setJobTotal] = useState(0);
  const [jobQuery, setJobQuery] = useState("");
  const [jobPage, setJobPage] = useState(0);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [batches, setBatches] = useState<{ code: string; name: string }[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);

  const [sections, setSections] = useState<SectionItem[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [presetCats, setPresetCats] = useState<string[]>([]);
  const [presetCat, setPresetCat] = useState("");
  const [presets, setPresets] = useState<Record<string, PresetItem[]>>({});
  const [presetsLoading, setPresetsLoading] = useState(true);

  /** 启动 / 停止在途标志（防连点，按钮同步「…中」文案）。 */
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  /** 列表异步到货后补选中第一份简历。 */
  useEffect(() => {
    if (!resumeId && resumes.length) setResumeId(resumes[0].resume_id);
  }, [resumes, resumeId]);

  /** 换简历清掉旧选择。 */
  useEffect(() => {
    setJobIds([]);
    setSelected([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);

  /** 拉预设提示词库（全局，挂载取一次），默认选中第一个分类。 */
  useEffect(() => {
    let alive = true;
    setPresetsLoading(true);
    resumeApi.revisePresets()
      .then((r) => {
        const d = r as unknown as { categories: string[]; presets: Record<string, PresetItem[]> };
        if (!alive) return;
        setPresets(d.presets ?? {});
        setPresetCats(d.categories ?? []);
        setPresetCat((prev) => prev || d.categories?.[0] || "");
      })
      .catch(() => { if (alive) toast.toast("加载预设失败", "warn"); })
      .finally(() => { if (alive) setPresetsLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 批次下拉：共用批次账（跨站点全量，不带 site）。 */
  useEffect(() => {
    let alive = true;
    setBatchesLoading(true);
    crawlBatchApi.tasks({ limit: 100 })
      .then((r) => {
        if (!alive) return;
        setBatches((r.items ?? []).map((t) => ({
          code: t.task_id,
          name: `${(t.params as { title?: string } | undefined)?.title ?? "抓取任务"} · ${fmtTime(t.created_at)}`,
        })));
      })
      .catch(() => {})
      .finally(() => { if (alive) setBatchesLoading(false); });
    return () => { alive = false; };
  }, []);

  /** 候选岗位：搜索 / 翻页 / 批次变化都重拉，每页整页替换。 */
  useEffect(() => {
    if (mode !== "targeted") return;
    let alive = true;
    setJobsLoading(true);
    interviewApi.jobs({
      title: jobQuery || undefined,
      crawl_task_id: crawlTaskId || undefined,
      limit: JOB_PAGE_SIZE,
      offset: jobPage * JOB_PAGE_SIZE,
    })
      .then((r) => {
        if (!alive) return;
        setJobs((r.items ?? []) as unknown as JobPickRow[]);
        setJobTotal(r.total ?? 0);
      })
      .catch((e) => { if (alive) toast.toast(msgOf(e), "danger"); })
      .finally(() => { if (alive) setJobsLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, crawlTaskId, jobQuery, jobPage]);

  /** 换批次就回到第一页，避免带上个范围的页码。 */
  const changeBatch = (v: string) => {
    setCrawlTaskId(v);
    setJobPage(0);
  };

  /** 自由模式：按简历取章节标题。 */
  useEffect(() => {
    if (mode !== "free" || !resumeId) {
      setSections([]);
      return;
    }
    let alive = true;
    setSectionsLoading(true);
    resumeApi.sections(resumeId)
      .then((r) => {
        const d = r as unknown as { sections: SectionItem[] };
        if (alive) setSections(d.sections ?? []);
      })
      .catch((e) => { if (alive) toast.toast(msgOf(e), "danger"); })
      .finally(() => { if (alive) setSectionsLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, resumeId]);

  /** 勾选 / 取消岗位，超出上限时提示并不勾。 */
  const toggleJob = (id: string, checked: boolean) => {
    if (checked && !jobIds.includes(id) && jobIds.length >= MAX_TARGET) {
      toast.toast(`最多选 ${MAX_TARGET} 个`, "warn");
      return;
    }
    setJobIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  };

  /** 勾选 / 取消章节。 */
  const toggleSection = (title: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...new Set([...prev, title])] : prev.filter((x) => x !== title)));
  };

  /** 启动优化：自由走 free-start，定向按「勾了 → job_ids；没勾 → 搜索范围整体」拼 ReviseStartBody。 */
  const start = async () => {
    if (!resumeId) {
      toast.toast("先选一份简历", "warn");
      return;
    }
    if (task && !reviseTerminal(task)) {
      toast.toast("已有优化任务在跑", "warn");
      return;
    }
    if (starting) return;
    setStarting(true);
    try {
      let snap: ReviseSnapshot;
      if (mode === "free") {
        if (!prompt.trim()) {
          toast.toast("请输入或选择优化提示词", "warn");
          return;
        }
        snap = (await resumeApi.startFreeRevise({
          resume_id: resumeId,
          selected_sections: selected,
          optimization_prompt: prompt.trim(),
        })) as unknown as ReviseSnapshot;
      } else {
        const wholeScope = jobIds.length === 0;
        snap = (await resumeApi.startRevise({
          resume_id: resumeId,
          job_ids: jobIds,
          crawl_task_id: wholeScope ? crawlTaskId : "",
          all_repo: wholeScope && !crawlTaskId,
        })) as unknown as ReviseSnapshot;
      }
      onTaskChange({ ...snap, status: snap.status || "running" });
      toast.toast("已启动，正在生成…", "ok");
    } catch (e) {
      toast.toast(msgOf(e), "danger");
    } finally {
      setStarting(false);
    }
  };

  /** 请求停止当前优化任务。 */
  const cancel = async () => {
    if (!task?.task_id || cancelling) return;
    setCancelling(true);
    try {
      await resumeApi.cancelRevise(task.task_id);
      toast.toast("已请求停止", "warn");
    } catch (e) {
      toast.toast(msgOf(e), "danger");
    } finally {
      setCancelling(false);
    }
  };

  if (resumes.length === 0) {
    return <EmptyState title="还没有简历" />;
  }

  const running = task != null && !reviseTerminal(task);
  const done = task != null && task.status === "done";

  return (
    <Box sx={pageRootSx}>
      <Surface sx={{ mb: 2.5, flex: "0 0 auto", display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <Select
          label="简历"
          options={resumes.map((r) => ({ code: r.resume_id, name: r.title || r.resume_id }))}
          value={resumeId}
          onChange={setResumeId}
          emptyLabel={null}
          sx={{ minWidth: 220 }}
        />
        <SegmentedControl
          value={mode}
          options={[...MODE_OPTIONS]}
          onChange={setMode}
          aria-label="优化模式"
        />
        <Typography sx={{ ...typeScale.s, color: "text.secondary", flex: 1, minWidth: 180 }}>
          修改以这份【原文】为底稿，不是解析结果。原简历永不覆盖。
        </Typography>
        <Button
          variant="filled"
          sx={{ ml: "auto" }}
          disabled={running || starting}
          onClick={() => void start()}
        >
          {starting ? "启动中…" : running ? "生成中…" : "启动优化"}
        </Button>
        <Typography sx={{ ...typeScale.s, color: "text.secondary", flexBasis: "100%" }}>
          生成是一次长任务，进度和事件流水都在上面的任务卡里。
        </Typography>
      </Surface>

      {task ? (
        <Box sx={{ mb: 2.5, flex: "0 0 auto" }}>
          <TaskPanel
            title={`简历优化 · ${task.mode === "free" ? "自由优化" : "定向优化"}`}
            status={task.status}
            percent={task.done ? 100 : undefined}
            current={task.current || undefined}
            counts={task.job_count != null ? [["岗位", String(task.job_count)]] : undefined}
            error={task.error || null}
            events={toTaskEvents(task.events, 20)}
            stopLabel={cancelling ? "停止中…" : "停止"}
            onStop={running ? () => void cancel() : undefined}
            extra={
              done ? (
                <Button
                  variant="filled"
                  onClick={() => onViewRevision(task.revision_id || task.task_id || "")}
                >
                  查看修改稿
                </Button>
              ) : null
            }
          />
        </Box>
      ) : null}

      {mode === "targeted" ? (
        <Surface
          sx={{
            mb: 2.5,
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            overflow: "hidden",
          }}
        >
          <Box
            data-testid="revise-scope-row"
            sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap", flex: "0 0 auto" }}
          >
            <Select
              label="爬取批次"
              options={batches}
              value={crawlTaskId}
              onChange={changeBatch}
              emptyLabel={batchesLoading ? "加载中…" : "不限"}
              disabled={batchesLoading}
              sx={{ minWidth: 280 }}
            />
            <TextField
              label="搜索职位 / 公司"
              type="search"
              placeholder="按职位名或公司名过滤…"
              value={jobQuery}
              onChange={(e) => { setJobPage(0); setJobQuery(e.target.value); }}
              sx={{ flex: "1 1 220px", maxWidth: 420 }}
            />
          </Box>

          <Typography sx={{ ...typeScale.s, color: "text.secondary", flex: "0 0 auto" }}>
            不选批次 = 搜全部职位；勾具体岗位 = 只改这几个，不勾 = 以搜索范围内的全部岗位为目标（后端取前 {MAX_TARGET} 个）。
          </Typography>

          <Typography sx={{ ...typeScale.s, color: "text.secondary", flex: "0 0 auto" }}>
            已选 {jobIds.length}/{MAX_TARGET}（后端最多吃 {MAX_TARGET} 个）· 共 {fmtNumber(jobTotal)} 个候选
          </Typography>

          <ScrollArea>
            {jobsLoading ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} height={36} />)}
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                {jobs.map((j) => (
                  <Box
                    key={j.encrypt_job_id}
                    component="label"
                    sx={{
                      display: "flex", alignItems: "center", gap: 1, py: 0.5, cursor: "pointer",
                      borderBottom: "1px solid", borderColor: "divider",
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={jobIds.includes(j.encrypt_job_id)}
                      disabled={!jobIds.includes(j.encrypt_job_id) && jobIds.length >= MAX_TARGET}
                      onChange={(e) => toggleJob(j.encrypt_job_id, e.target.checked)}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ ...typeScale.bodySm }} noWrap>
                        {j.job_name}{" "}
                        <Box component="span" sx={{ ...typeScale.s, color: "text.secondary" }}>@ {j.brand_name}</Box>
                      </Typography>
                      <Typography sx={{ ...typeScale.xs, color: "text.secondary" }}>
                        {[j.salary_desc, j.location].filter(Boolean).join(" · ")}
                      </Typography>
                    </Box>
                  </Box>
                ))}
                {jobs.length === 0 ? (
                  <Typography sx={{ ...typeScale.s, color: "text.secondary", py: 1 }}>没匹配的职位</Typography>
                ) : null}
              </Box>
            )}
          </ScrollArea>

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", flex: "0 0 auto" }}>
            <Button
              size="small"
              variant="gray"
              disabled={jobPage <= 0}
              onClick={() => setJobPage(jobPage - 1)}
            >
              上一页
            </Button>
            <Typography sx={{ ...typeScale.s, color: "text.secondary" }}>
              第 {jobPage + 1}/{Math.max(1, Math.ceil(jobTotal / JOB_PAGE_SIZE))} 页 · 共 {fmtNumber(jobTotal)} 个候选
            </Typography>
            <Button
              size="small"
              variant="gray"
              disabled={(jobPage + 1) * JOB_PAGE_SIZE >= jobTotal}
              onClick={() => setJobPage(jobPage + 1)}
            >
              下一页
            </Button>
            <Button size="small" variant="plain" onClick={() => setJobIds([])}>清空勾选</Button>
          </Box>
        </Surface>
      ) : (
        <ScrollArea sx={{ mb: 2.5 }}>
          <Surface sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box>
              <Typography sx={{ ...typeScale.s, fontWeight: 590, color: "text.secondary", mb: 1 }}>
                优化章节（留空 = 全部）
              </Typography>
              <Box sx={{ maxHeight: 220, overflowY: "auto" }}>
                {sectionsLoading ? (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} height={28} />)}
                  </Box>
                ) : sections.length === 0 ? (
                  <Typography sx={{ ...typeScale.s, color: "text.secondary" }}>未检测到章节标题</Typography>
                ) : (
                  sections.map((s) => (
                    <Box key={s.title} component="label" sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.25, cursor: "pointer" }}>
                      <Checkbox
                        size="small"
                        checked={selected.includes(s.title)}
                        onChange={(e) => toggleSection(s.title, e.target.checked)}
                      />
                      <Typography sx={{ ...typeScale.bodySm, flex: 1 }}>{s.title}</Typography>
                      <Typography sx={{ ...typeScale.xs, color: "text.secondary" }}>H{s.level}</Typography>
                    </Box>
                  ))
                )}
              </Box>
            </Box>

            <Box>
              <Typography sx={{ ...typeScale.s, fontWeight: 590, color: "text.secondary", mb: 1 }}>
                优化提示词
              </Typography>
              {presetsLoading ? (
                <Skeleton height={32} width={280} sx={{ mb: 1.5 }} />
              ) : (
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1.5 }}>
                  <Select
                    label="预设分类"
                    options={presetCats.map((c) => ({ code: c, name: c }))}
                    value={presetCat}
                    onChange={setPresetCat}
                    emptyLabel={null}
                    sx={{ minWidth: 160 }}
                  />
                  {(presets[presetCat] ?? []).map((p) => (
                    <Button key={p.name} size="small" variant="gray" onClick={() => setPrompt(p.prompt)}>
                      {p.name}
                    </Button>
                  ))}
                </Box>
              )}
              <TextField
                label="优化提示词"
                multiline
                rows={4}
                fullWidth
                placeholder="输入自定义提示词，或点上方预设填入"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </Box>
          </Surface>
        </ScrollArea>
      )}
    </Box>
  );
}
