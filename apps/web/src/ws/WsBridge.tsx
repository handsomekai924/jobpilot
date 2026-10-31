/**
 * WS 桥：一条 `/api/ws` 连接 → `applyWsEvent` → store（docs 5.5）。
 *
 * 断线降级：`ws.status` 变 `"down"` 就起 60s 慢轮询兜底（沿用 legacy `app.js` 行为），
 * 连回来即停。挂载一次就够，全局只此一条连接。
 */

import { useEffect } from "react";

import { api } from "@/api/client";
import { useTaskStore, type TaskSnapshot } from "@/stores/taskStore";
import * as ws from "@/ws/client";
import { applyWsEvent } from "@/ws/dispatch";

/** 断线兜底轮询间隔（毫秒）。 */
const FALLBACK_POLL_MS = 60_000;

/** 轮询全量任务快照并替换 store；失败等下一轮。 */
async function pollTasks(): Promise<void> {
  try {
    const body = await api.get<{ tasks?: TaskSnapshot[] }>("/api/tasks");
    useTaskStore.getState().replaceAll(Array.isArray(body.tasks) ? body.tasks : []);
  } catch {
  }
}

/** 挂载全局 WS 连接与断线降级轮询；不渲染任何东西。 */
export function WsBridge(): null {
  /** 订阅事件、建立连接，卸载时全部回收。 */
  useEffect(() => {
    const off = ws.on("*", applyWsEvent);
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    /** 停掉降级轮询。 */
    const stopPoll = (): void => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    /** 启动降级轮询（立即拉一次，之后每 60s）。 */
    const startPoll = (): void => {
      if (pollTimer) return;
      void pollTasks();
      pollTimer = setInterval(() => void pollTasks(), FALLBACK_POLL_MS);
    };

    /** `ws.status` 变 down 起轮询，恢复即停。 */
    const offStatus = ws.on("ws.status", (msg) => {
      const status = String((msg.data as Record<string, unknown>).status ?? "");
      if (status === "down") startPoll();
      else stopPoll();
    });

    void ws.connect();

    return () => {
      off();
      offStatus();
      stopPoll();
      ws.disconnect();
    };
  }, []);

  return null;
}
