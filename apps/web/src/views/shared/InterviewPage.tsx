/**
 * 面试题（共用路由 `#/interview`）：出题 / 生成记录 两段。
 *
 * 旧壳两块拼成一页：`views/interview.js`（岗位列表批量出题 + 生成记录）与
 * `interview_prep.js`（单岗题目弹窗 → 这里的 Sheet）。共用页不带站点语义——
 * 出题跟的是岗位与简历分析，不跟平台。
 *
 * 按设置页的分段范式拆分：`TABS` + 每段一个自包含组件。原「生成任务」段 2026-10-29
 * 迁任务中心（`#/tasks`，类型「面试题」）：取消 / 重试 / 删除 / 全部停止在那边做，本页只留路标。
 *
 * 任务态照旧从统一 WS store（`useTasks()`）读——在跑任务占着的岗位标「任务中」、收尾对账
 * 「已生成」徽章都靠它；首屏与 WS 断线时用 `interviewApi.tasks()` 兜底（照 TasksPage 的口径，
 * 5s 轮询只在断线时跑）。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";

import { PageHeader, pageRootSx, SegmentedControl, ViewFade } from "../../components";
import { useTaskStore, useTasks } from "../../stores/taskStore";
import { getStatus } from "../../ws/client";
import { interviewApi } from "./repos";
import { busyJobIds, toTaskSnapshot, type InterviewTaskSnap } from "./interview/types";
import { GenerateSection } from "./interview/GenerateSection";
import { RecordsSection } from "./interview/RecordsSection";

const TABS = [
  { value: "generate", label: "出题" },
  { value: "records", label: "生成记录" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

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
      // repos 标 {items}，后端实际 {tasks, busy_job_ids}——两个键都认
      const raw = data as unknown as { items?: unknown; tasks?: unknown };
      const snaps = (
        Array.isArray(raw.tasks) ? raw.tasks : Array.isArray(raw.items) ? raw.items : []
      ) as InterviewTaskSnap[];
      for (const s of snaps) upsert(toTaskSnapshot(s));
    } catch {
      // 兜底失败不打断页面；WS 连着的话 store 里还有数据
    }
  }, [upsert]);

  useEffect(() => {
    void refreshTasks();
    // WS 断线才轮询；连着就让 WS 推（与 TasksPage 同一口径）
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
