/**
 * 人岗匹配（共用路由 `#/match`）：匹配工作台 / 分析历史 / 招呼语三段。
 *
 * 页面级状态挂在壳上，切段不丢；历史与取舍见
 * `notes/apps/web/src/views/shared/match/MatchPage.md`。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";

import {
  PageHeader, pageRootSx, ScrollArea, SegmentedControl, useToast, ViewFade,
} from "@/components";
import { useTasks } from "@/stores/taskStore";
import {
  matchApi, resumeApi, type ResumeItem,
} from "@/api/shared";
import { rank, TASK_TERMINAL, type AnalysisRow, type MatchItem, type MatchTaskSnap } from "@/views/shared/match/types";
import { WorkbenchSection } from "@/views/shared/match/WorkbenchSection";
import { HistorySection } from "@/views/shared/match/HistorySection";
import { GreetingSection } from "@/views/shared/match/GreetingSection";

const TABS = [
  { value: "workbench", label: "匹配工作台" },
  { value: "history", label: "分析历史" },
  { value: "greeting", label: "招呼语" },
] as const;

/** 分段取值。 */
type TabValue = (typeof TABS)[number]["value"];

/** 匹配页壳：持有跨段状态，按段渲染工作台 / 历史 / 招呼语。 */
export function MatchPage() {
  const toast = useToast();
  const tasks = useTasks();

  const [tab, setTab] = useState<TabValue>("workbench");

  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [resumeId, setResumeId] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskSnap, setTaskSnap] = useState<MatchTaskSnap | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  /** 历史详情在途：结果区摆骨架屏占位（缺陷清单「匹配结果展开预占空间」）。 */
  const [resultsLoading, setResultsLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyJid, setBusyJid] = useState<string | null>(null);
  const [expandedJid, setExpandedJid] = useState<string | null>(null);
  /** 历史摘要行：壳上留一份，任务跑完要刷；历史段自己也会进段时拉一次。 */
  const [rows, setRows] = useState<AnalysisRow[]>([]);

  /** 首屏拉简历列表，并恢复现场任务。 */
  useEffect(() => {
    void (async () => {
      try {
        const data = await resumeApi.list();
        setResumes(data.items ?? []);
        if (data.items?.length) setResumeId((prev) => prev || data.items[0].resume_id);
      } catch {}
    })();
    void (async () => {
      try {
        const snap = (await matchApi.status()) as unknown as MatchTaskSnap;
        if (snap?.task_id) adoptTask(snap);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 把一份任务快照接进工作台（启动 / 恢复现场共用）。 */
  const adoptTask = useCallback((snap: MatchTaskSnap) => {
    if (!snap?.task_id) return;
    setTaskSnap(snap);
    setAnalysisId(snap.analysis_id || snap.task_id);
    setMatches(Array.isArray(snap.matches) ? rank(snap.matches) : []);
    setDrafts({});
    setActiveTaskId(TASK_TERMINAL.has(snap.status) ? null : snap.task_id);
    setTab("workbench");
  }, []);

  const watchId = taskSnap?.task_id ?? activeTaskId ?? "";
  const liveTask = useMemo(
    () => tasks.find((t) => t.task_id === watchId) ?? null,
    [tasks, watchId],
  );

  /** 匹配任务在跑时每 2 秒拉快照，终态后刷新历史并提示。 */
  useEffect(() => {
    if (!activeTaskId) return undefined;
    let dead = false;
    /** 拉一次任务快照并收口终态。 */
    const tick = async () => {
      try {
        const snap = (await matchApi.task(activeTaskId)) as unknown as MatchTaskSnap;
        if (dead) return;
        setTaskSnap(snap);
        if (snap.analysis_id) setAnalysisId(snap.analysis_id);
        if (Array.isArray(snap.matches) && snap.matches.length) setMatches(rank(snap.matches));
        if (TASK_TERMINAL.has(snap.status)) {
          setActiveTaskId(null);
          void (async () => {
            try {
              const data = await matchApi.analyses();
              setRows(() => (data.items ?? []) as unknown as AnalysisRow[]);
            } catch {}
          })();
          if (snap.status === "done") toast.toast("匹配完成", "ok");
          else if (snap.status === "error") toast.toast(snap.error || "匹配失败", "danger");
          else toast.toast("匹配已取消", "warn");
        }
      } catch {}
    };
    void tick();
    const timer = setInterval(() => { void tick(); }, 2000);
    return () => { dead = true; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTaskId]);

  /** 载入一份历史分析：先切工作台清结果，再在背后拉详情。 */
  const loadAnalysis = useCallback(async (id: string) => {
    setTab("workbench");
    setActiveTaskId(null);
    setTaskSnap(null);
    setAnalysisId(null);
    setMatches([]);
    setDrafts({});
    setResultsLoading(true);
    try {
      const data = (await matchApi.analysis(id)) as unknown as { matches?: MatchItem[] };
      setAnalysisId(id);
      setMatches(Array.isArray(data.matches) ? rank(data.matches) : []);
    } finally {
      setResultsLoading(false);
    }
  }, []);

  /** 删除历史分析；若删的是当前工作台那份，顺手清掉结果。 */
  const onDeleteAnalysis = useCallback((id: string) => {
    setAnalysisId((prev) => {
      if (prev !== id) return prev;
      setMatches([]);
      setDrafts({});
      return null;
    });
  }, []);

  /** 清空工作台结果与任务态。 */
  const clearResults = useCallback(() => {
    setAnalysisId(null);
    setMatches([]);
    setDrafts({});
    setTaskSnap(null);
    setActiveTaskId(null);
    setResultsLoading(false);
  }, []);

  /** 稳定引用的 matches setter：避免列表重渲染。 */
  const setMatchesFn = useCallback((fn: (prev: MatchItem[]) => MatchItem[]) => setMatches(fn), []);
  /** 稳定引用的 drafts setter：避免列表重渲染。 */
  const setDraftsFn = useCallback(
    (fn: (prev: Record<string, string>) => Record<string, string>) => setDrafts(fn),
    [],
  );
  /** 稳定引用的展开项 setter：避免列表重渲染。 */
  const setExpandedJidFn = useCallback((fn: (prev: string | null) => string | null) => setExpandedJid(fn), []);

  return (
    <Box sx={pageRootSx}>
      <PageHeader
        title="匹配"
      />

      <Box sx={{ my: 2.5, flex: "0 0 auto" }}>
        <SegmentedControl<TabValue>
          aria-label="匹配分区"
          value={tab}
          options={[...TABS]}
          onChange={setTab}
        />
      </Box>

      {tab === "workbench" && (
        <ViewFade slotKey={tab}>
          <WorkbenchSection
            resumes={resumes as unknown as { resume_id: string; title: string; parsed?: boolean }[]}
            resumeId={resumeId}
            onResumeId={setResumeId}
            taskSnap={taskSnap}
            liveTask={liveTask as unknown as { title?: string; status: string; done: number; total: number; current?: string; error?: string | null; events?: unknown[] } | null}
            activeTaskId={activeTaskId}
            resultsLoading={resultsLoading}
            analysisId={analysisId}
            matches={matches}
            drafts={drafts}
            busyJid={busyJid}
            expandedJid={expandedJid}
            onAdoptTask={adoptTask}
            onSetMatches={setMatchesFn}
            onSetDrafts={setDraftsFn}
            onSetBusyJid={setBusyJid}
            onSetExpandedJid={setExpandedJidFn}
            onClearResults={clearResults}
          />
        </ViewFade>
      )}

      {tab === "history" && (
        <ViewFade slotKey={tab}>
          <HistorySection
            rows={rows}
            setRows={(fn) => setRows(fn)}
            onLoadAnalysis={loadAnalysis}
            onDelete={onDeleteAnalysis}
          />
        </ViewFade>
      )}

      {tab === "greeting" && (
        <ScrollArea>
          <ViewFade slotKey={tab}>
            <GreetingSection />
          </ViewFade>
        </ScrollArea>
      )}
    </Box>
  );
}
