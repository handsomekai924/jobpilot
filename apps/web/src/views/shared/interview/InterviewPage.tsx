/**
 * 面试题（共用路由 `#/interview`）：出题 / 生成记录两段。
 *
 * 任务态从统一 WS store 读，断线时用 `interviewApi.tasks()` 兜底；
 * 历史与接口细节见 `notes/apps/web/src/views/shared/interview/InterviewPage.md`。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";

import { PageHeader, pageRootSx, SegmentedControl, ViewFade } from "@/components";
import { useTaskStore, useTasks } from "@/stores/taskStore";
import { getStatus } from "@/ws/client";
import { interviewApi } from "@/api/shared";
import { busyJobIds, toTaskSnapshot, type InterviewTaskSnap } from "@/views/shared/interview/types";
import { GenerateSection } from "@/views/shared/interview/GenerateSection";
import { RecordsSection } from "@/views/shared/interview/RecordsSection";

const TABS = [
  { value: "generate", label: "出题" },
  { value: "records", label: "生成记录" },
] as const;

/** 分段取值。 */
type TabValue = (typeof TABS)[number]["value"];

/** 面试题页壳：分段切换，并把统一任务快照与占位岗位集合喂给两段。 */
export function InterviewPage() {
  const allTasks = useTasks();
  const upsert = useTaskStore((s) => s.upsert);

  const [tab, setTab] = useState<TabValue>("generate");

  const interviewTasks = useMemo(
    () => allTasks.filter((t) => t.task_type === "interview"),
    [allTasks],
  );
  const busy = useMemo(() => busyJobIds(interviewTasks), [interviewTasks]);

  /** 任务列表兜底：interviewApi.tasks() → 统一形状 upsert 进 WS store（占位与徽章对账都认 store）。 */
  const refreshTasks = useCallback(async () => {
    try {
      const data = await interviewApi.tasks();
      const raw = data as unknown as { items?: unknown; tasks?: unknown };
      const snaps = (
        Array.isArray(raw.tasks) ? raw.tasks : Array.isArray(raw.items) ? raw.items : []
      ) as InterviewTaskSnap[];
      for (const s of snaps) upsert(toTaskSnapshot(s));
    } catch {}
  }, [upsert]);

  /** 首屏拉任务快照；WS 断开时每 5 秒兜底。 */
  useEffect(() => {
    void refreshTasks();
    const timer = setInterval(() => {
      if (getStatus() !== "open") void refreshTasks();
    }, 5000);
    return () => clearInterval(timer);
  }, [refreshTasks]);

  return (
    <Box sx={pageRootSx}>
      <PageHeader
        title="面试题"
      />

      <Box sx={{ my: 2.5, flex: "0 0 auto" }}>
        <SegmentedControl<TabValue>
          aria-label="面试题分区"
          value={tab}
          options={[...TABS]}
          onChange={setTab}
        />
      </Box>

      <ViewFade slotKey={tab}>
        {tab === "generate" && (
          <GenerateSection
            busy={busy}
            interviewTasks={interviewTasks}
            onTaskStarted={() => void refreshTasks()}
          />
        )}

        {tab === "records" && (
          <RecordsSection busy={busy} onTaskStarted={() => void refreshTasks()} />
        )}
      </ViewFade>
    </Box>
  );
}
