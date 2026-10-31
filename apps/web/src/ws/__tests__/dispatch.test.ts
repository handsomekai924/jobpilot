/** WS 事件落 store 的单测。 */

import { beforeEach, describe, expect, it } from "vitest";

import { applyWsEvent, resetStores } from "../dispatch";
import type { WsEnvelope } from "../client";
import { useTaskStore, selectTasks, selectRunning } from "../../stores/taskStore";
import { useSessionStore, selectFeeds } from "../../stores/sessionStore";

/** 造一帧事件信封，未指定的字段用默认值。 */
function frame(partial: Partial<WsEnvelope> & { type: string }): WsEnvelope {
  return {
    ts: 1700000000,
    task_type: "",
    task_id: "",
    site: "",
    data: {},
    ...partial,
  };
}

/** 当前任务 store 的全量快照列表。 */
function tasks() {
  return selectTasks(useTaskStore.getState().tasks);
}

/** 当前待喂料列表。 */
function feeds() {
  return selectFeeds(useSessionStore.getState().feeds);
}

/** 验各类 WS 事件落到任务/会话/喂料 store。 */
describe("WS 事件 → store", () => {
  /** 每个用例前清空 store。 */
  beforeEach(() => {
    resetStores();
  });

  /** 验 hello 全量写任务与各站点会话。 */
  it("hello 是全量快照：任务 + 各站点会话", () => {
    applyWsEvent(
      frame({
        type: "hello",
        data: {
          tasks: {
            tasks: [
              { task_id: "ct_1", task_type: "crawl", site: "boss", title: "抓取", status: "running", current: "第 2 页", done: 1, total: 3, events: [] },
            ],
          },
          sessions: {
            boss: { logged_in: true, phone_masked: "138****8000", busy: true },
            "51job": { logged_in: false, phone_masked: "", busy: false },
          },
        },
      }),
    );

    expect(tasks()).toHaveLength(1);
    expect(tasks()[0].task_id).toBe("ct_1");
    expect(useSessionStore.getState().sessions.boss).toEqual({
      logged_in: true,
      phone_masked: "138****8000",
      busy: true,
    });
    expect(useSessionStore.getState().sessions["51job"].logged_in).toBe(false);
  });

  /** 验 hello 的 tasks 也收数组形状。 */
  it("hello 的 tasks 也收 list_snapshots() 的数组形状", () => {
    applyWsEvent(
      frame({
        type: "hello",
        data: {
          tasks: [{ task_id: "a", task_type: "login", site: "boss", title: "登录", status: "running", done: 0, total: 0, events: [] }],
          sessions: {},
        },
      }),
    );
    expect(tasks().map((t) => t.task_id)).toEqual(["a"]);
  });

  /** 验重连后的 hello 是快照，旧任务不残留。 */
  it("重连后的 hello 是快照：旧任务不残留", () => {
    applyWsEvent(frame({ type: "task.progress", task_id: "old", data: { task_id: "old", task_type: "crawl", site: "boss", title: "旧", status: "running", done: 0, total: 1, events: [] } }));
    expect(tasks()).toHaveLength(1);

    applyWsEvent(frame({ type: "hello", data: { tasks: { tasks: [] }, sessions: {} } }));
    expect(tasks()).toHaveLength(0);
  });

  /** 验同一 task_id 的进度/完成事件原地更新，不新增。 */
  it("task.progress / task.finished 同一 task_id 原地更新，不新增", () => {
    applyWsEvent(frame({ type: "task.progress", task_id: "ct_1", site: "boss", data: { task_id: "ct_1", task_type: "crawl", site: "boss", title: "抓取", status: "running", done: 1, total: 3, events: [] } }));
    applyWsEvent(frame({ type: "task.finished", task_id: "ct_1", site: "boss", data: { task_id: "ct_1", task_type: "crawl", site: "boss", title: "抓取", status: "done", done: 3, total: 3, events: [] } }));

    expect(tasks()).toHaveLength(1);
    expect(tasks()[0].status).toBe("done");
    expect(tasks()[0].done).toBe(3);
  });

  /** 验 task.removed 摘掉任务。 */
  it("task.removed 摘掉任务", () => {
    applyWsEvent(frame({ type: "task.progress", task_id: "ct_1", data: { task_id: "ct_1", task_type: "crawl", site: "boss", title: "抓取", status: "running", done: 0, total: 1, events: [] } }));
    applyWsEvent(frame({ type: "task.removed", task_id: "ct_1" }));
    expect(tasks()).toHaveLength(0);
  });

  /** 验 session.changed 按信封的 site 增量更新。 */
  it("session.changed 按信封的 site 增量更新", () => {
    applyWsEvent(
      frame({
        type: "session.changed",
        site: "boss",
        data: { logged_in: true, phone_masked: "138****8000", task: { status: "logging_in" } },
      }),
    );
    expect(useSessionStore.getState().sessions.boss).toEqual({
      logged_in: true,
      phone_masked: "138****8000",
      busy: true,
    });

    applyWsEvent(
      frame({
        type: "session.changed",
        site: "boss",
        data: { logged_in: true, phone_masked: "138****8000", task: { status: "done" } },
      }),
    );
    expect(useSessionStore.getState().sessions.boss.busy).toBe(false);
  });

  /** 验 session.changed 没带 site 就不动 store。 */
  it("session.changed 没带 site 就不动 store（共用帧不冒充会话）", () => {
    applyWsEvent(frame({ type: "session.changed", data: { logged_in: true } }));
    expect(useSessionStore.getState().sessions).toEqual({});
  });

  /** 验喂料三态各登记一种表单，auth.state 收起。 */
  it("喂料三态各登记一种表单，auth.state 收起", () => {
    applyWsEvent(frame({ type: "auth.need_code", task_id: "lt_1", site: "boss", data: { task_id: "lt_1", phone_masked: "138****8000" } }));
    expect(feeds()).toHaveLength(1);
    expect(feeds()[0]).toMatchObject({ task_id: "lt_1", kind: "code", site: "boss", phone_masked: "138****8000" });

    applyWsEvent(frame({ type: "auth.need_slider", task_id: "lt_1", site: "boss", data: { task_id: "lt_1", slider: { gt: "gt1", challenge: "c1" } } }));
    expect(feeds()).toHaveLength(1);
    expect(feeds()[0].kind).toBe("slider");
    expect(feeds()[0].challenge).toEqual({ gt: "gt1", challenge: "c1" });

    applyWsEvent(frame({ type: "auth.need_scan", task_id: "lt_2", site: "boss", data: { task_id: "lt_2", qr: { url: "https://x" } } }));
    expect(feeds()).toHaveLength(2);
    expect(feeds().find((f) => f.task_id === "lt_2")?.kind).toBe("scan");
    expect(feeds().find((f) => f.task_id === "lt_2")?.challenge).toEqual({ url: "https://x" });

    applyWsEvent(frame({ type: "auth.state", task_id: "lt_1", site: "boss", data: { task_id: "lt_1", status: "done" } }));
    expect(feeds().map((f) => f.task_id)).toEqual(["lt_2"]);
  });

  /** 验认不出的 type 放过不崩，也不落脏数据。 */
  it("认不出的 type 放过不崩，也不落脏数据", () => {
    applyWsEvent(frame({ type: "some.future.event", data: { a: 1 } }));
    expect(tasks()).toHaveLength(0);
    expect(useSessionStore.getState().sessions).toEqual({});
    expect(feeds()).toHaveLength(0);
  });

  /** 验 selectRunning 只留未结束的任务。 */
  it("selectRunning 只留未结束的", () => {
    for (const [id, status, ended] of [
      ["a", "running", 0],
      ["b", "done", 1],
      ["c", "error", 1],
    ] as const) {
      applyWsEvent(frame({ type: "task.progress", task_id: id, data: { task_id: id, task_type: "crawl", site: "boss", title: id, status, done: 1, total: 1, events: [], ended_at: ended || null } }));
    }
    expect(selectRunning(useTaskStore.getState().tasks).map((t) => t.task_id)).toEqual(["a"]);
  });
});
