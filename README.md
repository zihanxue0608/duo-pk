# DUO PK · 2048 Battle

一个纯前端 + Firebase Realtime Database 的双人实时 2048 PK 网站。

## 已完成

- 昵称进入，无需注册
- 创建 5 位房间码 / 输入房间码加入
- Firebase Anonymous Auth
- 双人在线状态与 Ready
- 双方 Ready 后 3 秒同步倒计时
- 90 秒 2048 实时 PK
- 手机滑动 + 电脑方向键
- 实时同步双方分数、最高数字、棋盘
- 冻结 / 垃圾块 / 护盾三个技能
- 胜负结算 + 再来一局
- 响应式手机界面

## 1. 创建 Firebase 项目

在 Firebase Console 创建项目，然后添加一个 Web App。

复制 Web 配置，替换 `firebase-config.js` 中的占位内容。

## 2. 开启 Anonymous Authentication

Firebase Console -> Authentication -> Sign-in method -> Anonymous -> Enable。

## 3. 创建 Realtime Database

Firebase Console -> Realtime Database -> Create database。

然后把 `database.rules.json` 的内容粘贴到 Realtime Database -> Rules，点击 Publish。

> 不建议长期使用 Test mode。这个项目自带的 rules 至少要求用户通过 Firebase Authentication 匿名登录后才能读写。

## 4. 本地运行

由于项目使用 ES Modules，不要直接双击 `index.html` 用 `file://` 打开。

任选一种：

```bash
python3 -m http.server 8000
```

然后浏览器打开 `http://localhost:8000`。

或者直接部署到 GitHub Pages / Vercel / Netlify。

## 5. GitHub Pages

把这几个文件放到 GitHub 仓库根目录，Settings -> Pages -> Deploy from a branch -> main / root。

## 说明

当前版本是“朋友局 MVP”，主要保证实时联机体验。游戏状态与技能判定仍由客户端执行，因此不是反作弊架构。如果以后要做公开匹配、排行榜、奖励或真钱相关机制，应把关键判定迁移到可信服务器 / Cloud Functions。
