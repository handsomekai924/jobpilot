/**
 * 简历（共用路由 `#/resumes`）：简历库 / 简历解析 / 简历优化 / 优化记录四段。
 *
 * 跨段状态放页面壳，切段不丢；接口出入与旧页取舍见
 * `notes/apps/web/src/views/shared/resumes/ResumesPage.md`。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";

import {
  InlineAlert, PageHeader, ScrollArea, SegmentedControl, Sheet, ViewFade, pageRootSx, useToast,
} from "@/components";
import { fontFamilyMono, typeScale } from "@/theme/tokens";
import { resumeApi, tasksApi } from "@/api/shared";
import { toTaskEvents } from "@/views/shared/taskEvents";
import {
  PARSE_TERMINAL, POLL_MS, msgOf, reviseTerminal,
  type ParseRun, type ResumeDetail, type ResumeListItem, type ReviseSnapshot,
} from "@/views/shared/resumes/types";
import { LibrarySection } from "@/views/shared/resumes/LibrarySection";
import { ParseSection } from "@/views/shared/resumes/ParseSection";
import { ReviseSection } from "@/views/shared/resumes/ReviseSection";
import { RecordsSection } from "@/views/shared/resumes/RecordsSection";

const TABS = [
  { value: "library", label: "简历库" },
  { value: "parse", label: "简历解析" },
  { value: "revise", label: "简历优化" },
  { value: "records", label: "优化记录" },
] as const;

/** 分段取值。 */
type TabValue = (typeof TABS)[number]["value"];

/** 简历页壳：四段切换，持有跨段状态与任务轮询。 */
export function ResumesPage() {
  const toast = useToast();

  const [tab, setTab] = useState<TabValue>("library");
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [resumesLoading, setResumesLoading] = useState(true);
  const [currentId, setCurrentId] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingRevision, setPendingRevision] = useState<string | null>(null);

  const [runs, setRuns] = useState<Record<string, ParseRun>>({});
  const [detail, setDetail] = useState<ResumeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rawItem, setRawItem] = useState<{ title: string; raw: string } | null>(null);
  /** 查看原文 / 发起解析在途的简历（按钮「…中」+ 禁点防连发）。 */
  const [rawBusyId, setRawBusyId] = useState<string | null>(null);
  const [parseBusyId, setParseBusyId] = useState<string | null>(null);

  /** 优化任务快照（切到记录再回来还在跑）。 */
  const [reviseTask, setReviseTask] = useState<ReviseSnapshot | null>(null);
  const reviseTaskRef = useRef(reviseTask);
  reviseTaskRef.current = reviseTask;

  /** 拉简历列表。 */
  const loadResumes = useCallback(async () => {
    setResumesLoading(true);
    try {
      const r = await resumeApi.list();
      setResumes((r.items ?? []) as unknown as ResumeListItem[]);
      setLoadError(null);
    } catch (e) {
      setLoadError(msgOf(e));
    } finally {
      setResumesLoading(false);
    }
  }, []);

  /** 清掉待开修改稿标记（RecordsSection 打开后回调）。 */
  const clearPendingRevision = useCallback(() => setPendingRevision(null), []);
  /** 从优化任务跳到「优化记录」并打开对应修改稿。 */
  const openRevisionFromTask = useCallback((id: string) => {
    setPendingRevision(id);
    setTab("records");
  }, []);

  /** 首屏拉简历列表。 */
  useEffect(() => { void loadResumes(); }, [loadResumes]);

  /** 列表到货后保证有选中项。 */
  useEffect(() => {
    if (resumes.length === 0) {
      setCurrentId("");
      return;
    }
    if (!currentId || !resumes.some((r) => r.resume_id === currentId)) {
      setCurrentId(resumes[0].resume_id);
    }
  }, [resumes, currentId]);

  const runsRef = useRef(runs);
  runsRef.current = runs;
  const currentIdRef = useRef(currentId);
  currentIdRef.current = currentId;

  /** 按当前选中项刷新详情。 */
  const refreshDetail = useCallback(async () => {
    const id = currentIdRef.current;
    if (!id) return;
    try {
      const d = await resumeApi.get(id);
      if (currentIdRef.current === id) setDetail(d as unknown as ResumeDetail);
    } catch {}
  }, []);

  /** 选中项变化时拉详情。 */
  useEffect(() => {
    if (!currentId) {
      setDetail(null);
      return;
    }
    let alive = true;
    setDetailLoading(true);
    resumeApi.get(currentId)
      .then((d) => { if (alive) setDetail(d as unknown as ResumeDetail); })
      .catch((e) => { if (alive) toast.toast(msgOf(e), "danger"); })
      .finally(() => { if (alive) setDetailLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  /** 解析任务单轮跟进度；终态收结果、刷新列表。 */
  const pollParse = useCallback(async (resumeId: string, run: ParseRun) => {
    try {
      const snap = await tasksApi.get(run.taskId);
      const status = String(snap.status || "");
      setRuns((prev) => ({
        ...prev,
        [resumeId]: {
          ...run,
          status,
          percent: snap.total > 0 ? Math.round((snap.done / snap.total) * 100) : undefined,
          current: String(snap.current || ""),
          error: String(snap.error || ""),
          events: toTaskEvents(snap.events, 20),
        },
      }));
      if (!PARSE_TERMINAL.has(status)) return;
      if (status === "done") {
        toast.toast("解析完成", "ok");
        void refreshDetail();
        void loadResumes();
      } else if (status === "error") {
        toast.toast(snap.error || "解析失败", "danger");
      } else {
        toast.toast("解析已取消", "warn");
      }
    } catch (e) {
      setRuns((prev) => ({ ...prev, [resumeId]: { ...run, status: "error", error: msgOf(e) } }));
      toast.toast(msgOf(e), "danger");
    }
  }, [loadResumes, refreshDetail, toast]);

  /** 定时推进未完成的解析任务。 */
  useEffect(() => {
    const timer = window.setInterval(() => {
      for (const [resumeId, run] of Object.entries(runsRef.current)) {
        if (PARSE_TERMINAL.has(run.status)) continue;
        void pollParse(resumeId, run);
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [pollParse]);

  /**
   * 提交 LLM 解析（异步任务，多份可并行；同名重复提交由后端 409 挡）。
   * 没拿到 task_id（测试桩简写回包）就静默跳过，不挂假进度。
   */
  const runParse = useCallback(async (item: ResumeListItem) => {
    const run = runsRef.current[item.resume_id];
    if (run && !PARSE_TERMINAL.has(run.status)) {
      toast.toast("这份简历正在解析中", "warn");
      return;
    }
    if (parseBusyId === item.resume_id) return;
    setParseBusyId(item.resume_id);
    try {
      const r = await resumeApi.startParse(item.resume_id);
      if (!r.task_id) return;
      setRuns((prev) => ({
        ...prev,
        [item.resume_id]: { taskId: r.task_id, status: "running", current: "启动…", error: "", events: [] },
      }));
      toast.toast("解析任务已提交", "ok");
    } catch (e) {
      toast.toast(msgOf(e), "danger");
    } finally {
      setParseBusyId(null);
    }
  }, [parseBusyId, toast]);

  /** 拉原文并打开侧栏。 */
  const viewRaw = useCallback(async (item: ResumeListItem) => {
    if (rawBusyId === item.resume_id) return;
    setRawBusyId(item.resume_id);
    try {
      const d = await resumeApi.get(item.resume_id);
      const full = d as unknown as ResumeDetail;
      setRawItem({ title: full.title || item.title, raw: full.raw || "" });
    } catch (e) {
      toast.toast(msgOf(e), "danger");
    } finally {
      setRawBusyId(null);
    }
  }, [rawBusyId, toast]);

  /** 首屏恢复在跑的优化任务。 */
  useEffect(() => {
    let alive = true;
    resumeApi.reviseStatus()
      .then((r) => {
        const s = r as unknown as ReviseSnapshot;
        if (alive && s.task_id && !reviseTerminal(s)) setReviseTask(s);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  /** 定时推进优化任务并收口终态。 */
  useEffect(() => {
    const timer = window.setInterval(() => {
      const t = reviseTaskRef.current;
      if (!t || !t.task_id || reviseTerminal(t)) return;
      void (async () => {
        try {
          const snap = (await resumeApi.reviseTask(t.task_id as string)) as unknown as ReviseSnapshot;
          if (!snap.task_id) return;
          setReviseTask(snap);
          if (reviseTerminal(snap)) {
            if (snap.status === "done") toast.toast("优化稿已生成，可以查看修改稿", "ok");
            else if (snap.status === "cancelled") toast.toast("优化已取消", "warn");
            else toast.toast(snap.error || "优化失败", "danger");
          }
        } catch (e) {
          setReviseTask((prev) => (prev && prev.task_id === t.task_id ? { ...prev, status: "error", error: msgOf(e) } : prev));
        }
      })();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const current = resumes.find((r) => r.resume_id === currentId) ?? null;
  const currentRun = currentId ? runs[currentId] : undefined;

  return (
    <Box sx={pageRootSx}>
      <PageHeader
        title="简历"
      />

      {loadError ? (
        <Box sx={{ flex: "0 0 auto" }}>
          <InlineAlert tone="danger">{loadError}</InlineAlert>
        </Box>
      ) : null}

      <Box sx={{ my: 2.5, flex: "0 0 auto" }}>
        <SegmentedControl
          aria-label="简历分区"
          value={tab}
          options={[
            ...TABS.map((t) =>
              t.value === "parse" && currentRun && !PARSE_TERMINAL.has(currentRun.status)
                ? { ...t, status: "busy" as const }
                : t.value === "revise" && reviseTask && !reviseTerminal(reviseTask)
                  ? { ...t, status: "busy" as const }
                  : t,
            ),
          ]}
          onChange={setTab}
        />
      </Box>

      {tab === "revise" ? (
        <ViewFade slotKey={tab}>
          <ReviseSection
            resumes={resumes}
            currentId={currentId}
            task={reviseTask}
            onTaskChange={setReviseTask}
            onViewRevision={openRevisionFromTask}
          />
        </ViewFade>
      ) : tab === "parse" ? (
        <ViewFade slotKey={tab}>
          <ParseSection
            current={current}
            detail={detail}
            run={currentRun}
            loading={detailLoading}
            rawBusyId={rawBusyId}
            parseBusyId={parseBusyId}
            onRunParse={runParse}
            onViewRaw={viewRaw}
          />
        </ViewFade>
      ) : (
        <ScrollArea>
          <ViewFade slotKey={tab}>
            {tab === "library" ? (
              <LibrarySection
                resumes={resumes}
                currentId={currentId}
                runs={runs}
                loading={resumesLoading}
                rawBusyId={rawBusyId}
                parseBusyId={parseBusyId}
                onSelect={setCurrentId}
                onChanged={loadResumes}
                onRunParse={runParse}
                onViewRaw={viewRaw}
              />
            ) : null}

            {tab === "records" ? (
              <RecordsSection openRevisionId={pendingRevision} onOpened={clearPendingRevision} />
            ) : null}
          </ViewFade>
        </ScrollArea>
      )}

      <Sheet open={rawItem != null} onClose={() => setRawItem(null)} title={`原文 · ${rawItem?.title ?? ""}`} width={640}>
        <Box
          component="pre"
          sx={{
            m: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
            fontFamily: fontFamilyMono, ...typeScale.s,
          }}
        >
          {rawItem?.raw || "（空原文）"}
        </Box>
      </Sheet>
    </Box>
  );
}
