"""接口地址、请求头、业务码等常量配置。

路径与表单形状的核实状态、协议细节见 `notes/boss_login/config.md`。
线上变更时用 `probe` 或命令行参数覆盖。
"""

from __future__ import annotations

from typing import Final

BASE_URL: Final[str] = "https://www.zhipin.com"

ENDPOINTS: Final[dict[str, str]] = {
    "send_sms_code": "/wapi/zppassport/send/smsCode",
    "send_sms_code_v2": "/wapi/zppassport/send/smsCodeV2",
    "login_by_sms": "/wapi/zppassport/login/phone",
    "login_by_sms_v2": "/wapi/zppassport/login/phoneV2",
    "login_suggest": "/wapi/zppassport/validate/getLoginSuggest",
    "user_info": "/wapi/zpuser/wap/getUserInfo.json",
    "logout": "/wapi/zppassport/user/logout",
}

QR_ENDPOINTS: Final[dict[str, str]] = {
    "qr_randkey": "/wapi/zppassport/captcha/randkey",
    "qr_scan": "/wapi/zppassport/qrcode/scan",
    "qr_second_key": "/wapi/zppassport/captcha/getSecondKey",
    "qr_scan_second": "/wapi/zppassport/qrcode/scanSecond",
    "qr_head_img": "/wapi/zppassport/qrcode/getHeadImg",
    "qr_scan_login": "/wapi/zppassport/qrcode/scanLogin",
    "qr_dispatcher": "/wapi/zppassport/qrcode/dispatcher",
}

CANDIDATE_ENDPOINTS: Final[dict[str, list[str]]] = {
    "send_sms_code": [
        "/wapi/zppassport/send/smsCode",
        "/wapi/zppassport/send/smsCodeV2",
        "/wapi/zppassport/sms/sendSmsCode",
        "/wapi/zppassport/send/smsCodeByWy",
        "/wapi/zppassport/code/send",
    ],
    "login_by_sms": [
        "/wapi/zppassport/login/phone",
        "/wapi/zppassport/login/phoneV2",
        "/wapi/zppassport/user/smsLogin",
        "/wapi/zppassport/login/sms",
        "/wapi/zppassport/user/login",
    ],
    "qr_randkey": [
        "/wapi/zppassport/captcha/randkey",
        "/wapi/zppassport/qrcode/randkey",
    ],
    "qr_scan": [
        "/wapi/zppassport/qrcode/scan",
    ],
    "qr_dispatcher": [
        "/wapi/zppassport/qrcode/dispatcher",
    ],
}

SMS_SCENES: Final[dict[str, int]] = {
    "login": 1,
    "register": 2,
    "bind": 7,
}

SMS_TYPE_V2: Final[int] = 7
SMS_VERSION_V2: Final[int] = 1
DEFAULT_PK: Final[str] = "cpc_user_sign_up"
IDENTITY_JOB_SEEKER: Final[int] = 0
IDENTITY_RECRUITER: Final[int] = 1

QR_EXPIRE_SECONDS: Final[int] = 30
QR_POLL_TIMEOUT: Final[float] = 100.0
QR_CONFIRM_DELAY_SECONDS: Final[float] = 1.0
QR_CONFIRM_TIMEOUT_SECONDS: Final[float] = 180.0
QR_CONTENT_PREFER_SECOND: Final[bool] = True

QR_LOGIN_LIMIT_CODES: Final[frozenset[int]] = frozenset(
    {4563, 4567, 4912, 4918, 4930, 4999, 5004}
)
QR_LOGIN_LIMIT_RANGE: Final[tuple[int, int]] = (4942, 4950)

QR_DEFAULT_PK: Final[str] = "cpc_user_sign_up"

DEFAULT_USER_AGENT: Final[str] = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

DEFAULT_HEADERS: Final[dict[str, str]] = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Origin": BASE_URL,
    "Referer": f"{BASE_URL}/web/user/",
    "X-Requested-With": "XMLHttpRequest",
}

CODE_OK: Final[int] = 0

CODE_MESSAGES: Final[dict[int, str]] = {
    1001: "发送太频繁了，请稍后再试",
    1002: "请先完成安全验证",
    1003: "该手机号暂时无法接收短信，请联系客服",
    1004: "验证码发送失败，请稍后重试",
    2001: "验证码错误，请重新输入",
    2002: "验证码已过期，请重新获取",
    2003: "错误次数过多，请重新获取验证码",
    2004: "该账号存在异常，请联系客服 400-065-5799",
    9000: "系统繁忙，请稍后重试",
}

RISK_CODE_IP_BLOCK: Final[frozenset[int]] = frozenset({31, -1000031})
RISK_CODE_UID_BLOCK: Final[frozenset[int]] = frozenset({32, -1000032})
RISK_CODE_IP_GRAY: Final[frozenset[int]] = frozenset({35, -1000035})
RISK_CODE_UID_GRAY: Final[frozenset[int]] = frozenset({36, -1000036})
RISK_CODE_SECURITY_CHECK: Final[frozenset[int]] = frozenset({37, -1000037})
RISK_CODE_ANTI_SPIDER: Final[frozenset[int]] = frozenset({38})
RISK_CODE_SLIDER: Final[frozenset[int]] = frozenset({400061})

RISK_MESSAGE_KEYWORDS: Final[tuple[str, ...]] = (
    "滑块",
    "安全验证",
    "人机验证",
    "图形验证",
)

SLIDER_MESSAGE_KEYWORDS: Final[tuple[str, ...]] = (
    "滑块",
    "人机验证",
    "图形验证",
)

ALL_RISK_CODES: Final[frozenset[int]] = (
    RISK_CODE_IP_BLOCK
    | RISK_CODE_UID_BLOCK
    | RISK_CODE_IP_GRAY
    | RISK_CODE_UID_GRAY
    | RISK_CODE_SECURITY_CHECK
    | RISK_CODE_ANTI_SPIDER
    | RISK_CODE_SLIDER
)

TOKEN_FIELDS: Final[tuple[str, ...]] = (
    "token",
    "zpToken",
    "zp_token",
    "accessToken",
    "access_token",
)

SMS_TOKEN_FIELD: Final[str] = "token"

AUTH_COOKIES: Final[tuple[str, ...]] = ("zp_at", "wt2", "bst", "at", "zp_token")

VERIFY_ENDPOINTS: Final[dict[str, str]] = {
    "get_type_v2": "/wapi/zppassport/captcha/getTypeV2",
    "randkey": "/wapi/zppassport/captcha/randkey",
    "get_type": "/wapi/zpsecureflow/captcha/gettype",
    "validate": "/wapi/zpsecureflow/captcha/validate",
    "get_redirect": "/wapi/zpsecureflow/captcha/getredirect",
}

SLIDER_CHALLENGE_ENDPOINT_KEY: Final[str] = "get_type_v2"

CAPTCHA_TYPE_JIYAN: Final[int] = 1
CAPTCHA_TYPE_ALI: Final[int] = 2
CAPTCHA_TYPE_PICTURE: Final[int] = 3
CAPTCHA_TYPE_YIDUN: Final[int] = 4

CAPTCHA_TYPE_NAMES: Final[dict[int, str]] = {
    CAPTCHA_TYPE_JIYAN: "极验验证",
    CAPTCHA_TYPE_ALI: "阿里云验证码",
    CAPTCHA_TYPE_PICTURE: "图片验证码",
    CAPTCHA_TYPE_YIDUN: "网易易盾",
}

GEETEST_LOADER_URL: Final[str] = (
    "https://static.zhipin.com/assets/zhipin/geek/verify-sdk/jiyan/gt.0.5.0.js"
)

GEETEST_API_SERVERS: Final[tuple[str, ...]] = ("api.geetest.com", "api.geevisit.com")

CAPTCHA_HEADER_TYPE: Final[str] = "Zp-Captcha-Type"
CAPTCHA_HEADER_CHALLENGE: Final[str] = "Zp-Captcha-Challenge"
CAPTCHA_HEADER_VALIDATE: Final[str] = "Zp-Captcha-Validate"
CAPTCHA_HEADER_SECCODE: Final[str] = "Zp-Captcha-Seccode"
CAPTCHA_HEADER_RANDKEY: Final[str] = "Zp-Captcha-Randkey"

REDIRECT_SKIP_VERIFY: Final[str] = "redirect"

SLIDER_HELPER_HOST: Final[str] = "127.0.0.1"
SLIDER_HELPER_PORT: Final[int] = 8766
SLIDER_HELPER_TIMEOUT: Final[int] = 300

RESEND_COOLDOWN_SECONDS: Final[int] = 60

CODE_LENGTH: Final[int] = 6

MAX_CODE_ATTEMPTS: Final[int] = 5

MAX_RESEND_WAIT_SECONDS: Final[int] = 120

CN_PHONE_PREFIX_LENGTH: Final[int] = 11
