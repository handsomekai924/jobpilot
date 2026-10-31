# `apps/web/src/views/platform/login/LoginPage` 笔记

> 摘自 `apps/web/src/views/platform/login/LoginPage.tsx` 的模块说明与注释。

## 一句话

平台作用域登录页：发码 / 扫码两个主动入口 + 三种人机喂料表单。

## 细节

### 人机协作不是绕过（docs 拍板）

滑块是**你本人拖**，后端只把票据递回来；所以滑块这档新壳只给一个入口开后端帮助页（`authApi.sliderPageUrl`），不在壳里再造一套极验组件。

### 喂料三态

吃 `useFeeds()`（WS `auth.need_code` / `auth.need_slider` / `auth.need_scan` 登记、`auth.state` 清掉），所以这页不轮询任务状态——`auth.*` 一到就换表单，`auth.state` 一到就收起。

- 只看当前站点的待喂料；别的站点的料归它们自己的页面管。
- 站点换了就清掉上个站点留下的表单状态，免得把手机号带给别的平台。

### 细节

- 二维码白底是扫码识别的前提（暗色主题下也得白），底色走 `common.white` 不随主题；`revision` 变了才重新取图，省得每次进度推送都刷一遍。
- 手机号打码只做展示（`maskPhone`），提交用原值。
- 发码 / 提交验证码 / 取消登录都有在飞旗标：按钮转文案并禁用，防连点。
