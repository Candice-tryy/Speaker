# Speaker 微信小程序

雅思口语练习小程序（Taro + React + TS）。后端复用仓库根目录的 Next.js `/api/*`。

## 运行（工具链已建好，不用再 taro init）

工程配置（`package.json` / `config/` / `babel.config.js` / `tsconfig.json` / `project.config.json`）和全部源码都已就绪，已验证 `build:weapp` 编译通过。

1. `cd miniprogram && npm install`
2. `npm run dev:weapp`（生成/监听 `dist/`）
3. 用**微信开发者工具**导入项目，目录选 `miniprogram/dist`

## 页面

- `pages/map/index` — 登山地图（三段 Part 切换、节点点亮、tabBar 首页）
- `pages/practice/index` — 跟读练习（录音→讯飞打分→反馈），由地图节点带参数进入
- `pages/profile/index` — 我的（目标分、进度概览）

## 微信开发者工具里

- 新建/导入项目，目录选 `miniprogram/dist`，AppID 填你注册拿到的，没注册可先选「测试号」。
- **详情 → 本地设置 → 勾选「不校验合法域名」**：开发阶段可直连未备案后端（如本机 `http://localhost:3000` 或临时地址）。正式发布前必须换成已备案 HTTPS 域名并加进「服务器域名」白名单。

## 后端地址配置

改 `src/lib/api.ts` 里的 `BASE_URL`：
- 本机联调：先让电脑跑 `npm run dev`（仓库根），手机/工具同网访问电脑局域网 IP，如 `http://192.168.x.x:3000`。
- 上线：换成备案域名 `https://your-domain.com`。

## 已接通的后端接口（无需改后端）

- `GET /api/bank` → 题库（parts/peaks/cards/questions）
- `POST /api/score` → `{ mode:'follow', recited:true, refText, audio(base64 16k PCM) }` → `{ band, pronunciation, fluency, advice, source, rejected }`
