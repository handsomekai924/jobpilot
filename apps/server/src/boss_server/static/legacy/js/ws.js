/**
 * 统一 WebSocket 客户端：全应用只开一条 `/api/ws`。
 *
 * 连接后服务端先推 `hello` 快照，之后按事件推送。断线自动重连；
 * 连不上时 `status` 为 `"down"`，各面板自行回落 HTTP 轮询。
 */

/** 消息类型 → 订阅回调集合。 */
const listeners = new Map();
/** 通配（`*`）订阅回调集合。 */
const anyListeners = new Set();

let socket = null;
/** 连接状态：connecting / open / down。 */
let status = "connecting";
let retryMs = 1000;
let retryTimer = null;
let pingTimer = null;
let openedOnce = false;

/**
 * 改连接状态并广播一帧 `ws.status`（各面板靠它启动/停掉降级轮询）。
 *
 * @param {string} next 新状态
 */
function setStatus(next) {
  if (status === next) return;
  status = next;
  dispatch({ type: "ws.status", ts: Date.now() / 1000, data: { status: next } });
}

/** 毫秒级 sleep。 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 订阅某类消息。
 *
 * @param {string} type 消息 type，`"*"` 表示全部
 * @param {(msg: Object) => void} handler 回调
 * @returns {() => void} 退订函数
 */
export function on(type, handler) {
  if (type === "*") {
    anyListeners.add(handler);
    return () => anyListeners.delete(handler);
  }
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(handler);
  return () => {
    const set = listeners.get(type);
    if (set) set.delete(handler);
  };
}

/** @returns {string} 连接状态：connecting / open / down */
export function getStatus() {
  return status;
}

/**
 * 发一条客户端消息（如 ping / resync）。
 *
 * @param {Object} payload 消息体
 */
export function send(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(payload));
    } catch {
    }
  }
}

/** 请求服务端重推全量快照。 */
export function resync() {
  send({ type: "resync" });
}

/**
 * 建立连接（幂等）；旧的半死连接先关掉，避免服务端留僵尸连接。
 *
 * @returns {Promise<void>} 连上或失败后都 resolve
 */
export function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return Promise.resolve();
  }
  status = "connecting";
  return new Promise((resolve) => {
    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws`;
    let settled = false;
    if (socket) {
      try {
        socket.close();
      } catch {
      }
      socket = null;
    }
    try {
      socket = new WebSocket(url);
    } catch {
      setStatus("down");
      scheduleReconnect();
      resolve();
      return;
    }
    socket.onopen = () => {
      console.info("[ws] 已连接");
      setStatus("open");
      retryMs = 1000;
      openedOnce = true;
      startPing();
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    socket.onmessage = (msg) => {
      let data = null;
      try {
        data = JSON.parse(msg.data);
      } catch {
        return;
      }
      dispatch(data);
    };
    const down = () => {
      stopPing();
      setStatus("down");
      scheduleReconnect();
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    socket.onerror = () => {
      console.warn("[ws] 连接出错");
      down();
    };
    /** 连接关闭：记下 code/reason（1006 异常断开、1000 正常关闭）便于排查，再走降级重连。 */
    socket.onclose = (ev) => {
      console.warn(`[ws] 连接关闭 code=${ev.code} reason=${ev.reason || "-"}`);
      down();
    };
    setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve();
      }
    }, 3000);
  });
}

/** 主动断开（测试用）。 */
export function disconnect() {
  stopPing();
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  try {
    socket && socket.close();
  } catch {
  }
  socket = null;
  setStatus("down");
}

/**
 * 分发一帧消息：跳过 pong，先给通配订阅、再给按 type 的订阅。
 *
 * hello 不管是首连还是重连收到，都当快照交给订阅方。
 *
 * @param {Object} data 解析后的消息体（含 type）
 */
function dispatch(data) {
  const type = data && data.type;
  if (type === "pong") return;
  if (type === "hello" && openedOnce) {
  }
  for (const h of anyListeners) {
    try {
      h(data);
    } catch (e) {
      console.error("[ws] handler error", e);
    }
  }
  const set = type ? listeners.get(type) : null;
  if (set) {
    for (const h of set) {
      try {
        h(data);
      } catch (e) {
        console.error("[ws] handler error", e);
      }
    }
  }
}

/** 指数退避重连：1s 起步、每次翻倍、封顶 15s；已有排队就不再排。 */
function scheduleReconnect() {
  if (retryTimer) return;
  console.warn(`[ws] ${retryMs}ms 后重连`);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connect();
    retryMs = Math.min(retryMs * 2, 15000);
  }, retryMs);
}

/** 每 25s 发一次 ping 保活，先清掉旧定时器避免重复。 */
function startPing() {
  stopPing();
  pingTimer = setInterval(() => send({ type: "ping" }), 25000);
}

/** 停掉心跳定时器。 */
function stopPing() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

export default { on, connect, disconnect, send, resync, getStatus, sleep };
