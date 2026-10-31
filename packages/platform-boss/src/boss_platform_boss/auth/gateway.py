"""登录网关：平台适配器访问登录任务中心的注入点。

平台包不 import server；server 的任务中心实现 `AuthGateway` 并在模块加载时
`bind_gateway()`，适配器只认这里。
"""

from __future__ import annotations

from typing import Any, Mapping, Protocol

__all__ = ["AuthGateway", "bind_gateway", "get_gateway"]


class AuthGateway(Protocol):
    """登录任务中心的最小面：起流、喂料、查快照。"""

    def start_send(self, phone: str, *, dial_code: str = "86") -> Any:
        """起短信登录，回任务对象（有 `task_id`）。"""
        ...

    def submit_code(self, task_id: str, code: str) -> Any:
        """塞验证码。"""
        ...

    def solve_slider(self, task_id: str, payload: Mapping[str, Any]) -> Any:
        """塞滑块票据。"""
        ...

    def start_qr(self, *, pk: str = "") -> Any:
        """起 APP 扫码登录，回任务对象。"""
        ...

    def snapshot(self, task_id: str) -> Mapping[str, Any]:
        """按 id 取任务快照。"""
        ...

    def status_payload(self) -> Mapping[str, Any]:
        """本地会话 + 当前任务的总览。"""
        ...


_GATEWAY: AuthGateway | None = None


def bind_gateway(gateway: AuthGateway) -> None:
    """把 server 的登录任务中心挂进来（模块加载时调用一次）。"""
    global _GATEWAY
    _GATEWAY = gateway


def get_gateway() -> AuthGateway | None:
    """取已绑定的网关；没绑（如纯平台包单测）回 `None`。"""
    return _GATEWAY
