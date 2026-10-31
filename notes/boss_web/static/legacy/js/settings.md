# `boss_web.static.legacy.js.views.settings` 协议笔记

> 摘自 `boss_web/static/legacy/js/views/settings.js` 的 JSDoc / 注释。

## 「版本更新」页签圆点

- 后端 `should_prompt = has_update && !suppressed`——`ignored` 是忽略水位线，
  新版比水位高时照亮，所以判断只看 `should_prompt`，不能再拿 `!ignored` 卡一道。
- 圆点要一直挂着：关掉弹窗 ≠ 忽略，只要还有没被忽略的新版就不灭。
- 因此进页面得先按缓存（`peekUpdateStatus`）画上，不能只等 WS 推送——关完弹窗
  进设置页那会儿正好没推送，圆点会是灭的，看着就像「关掉就没提示了」。
