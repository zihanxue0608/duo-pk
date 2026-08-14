# DUO PK Arena V3.2 Hotfix

修复首页“创建房间没有反应 / 一直显示正在连接”的问题。

## 更新方式
只需覆盖 GitHub 仓库根目录的 `index.html` 和 `app.js`。
Firebase Rules 不需要因为这个 hotfix 再改一次（如果你已经用了 V3/V3.1 Rules）。

## 改动
- `app.js` 不再静态依赖 `firebase-config.js` 才能启动页面。
- Firebase SDK 改为运行时动态加载，失败会直接在页面显示错误。
- 初始化完成前创建/加入按钮禁用，完成后自动启用。
- 增加 runtime / promise 错误提示。
- `index.html` 给 app.js 增加版本参数，绕过旧缓存。
