# DUO PK Arena V3.3

本版重点：

- 新增比赛中 `↩ 退出` 菜单：继续比赛 / 认输本局 / 结束系列赛 / 离开长期房间。
- `认输本局` 只判当前局负，3 秒后系列赛继续下一局。
- 重新实现经典舒尔特：固定 5×5、1–25 随机排列、按升序寻找、整张过程中不自动洗牌、不高亮下一个目标。
- 原“动态舒尔特”改名为“动态数字追踪”，明确标注为衍生玩法，不冒充经典规则。
- 渲染循环改为 `requestAnimationFrame`，跑酷/飞机/动画更顺滑；新增屏幕、弹窗、按钮、舒尔特微动效。
- Firebase 配置沿用现有 duo-pk 项目。

## 部署

覆盖 GitHub 仓库根目录中的 `index.html` 和 `app.js` 后：

```bash
git add .
git commit -m "V3.3 exit and Schulte refresh"
git push
```

GitHub Pages 会自动重新部署。

若仍遇到 `PERMISSION_DENIED`，请确认粘贴的是本目录 `database.rules.json` 到 **Firebase → Realtime Database → Rules**，不是 Firestore Rules。
