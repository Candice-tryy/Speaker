# Speaker 微信小程序

雅思口语练习小程序（Taro + React + TS）。后端复用仓库根目录的 Next.js `/api/*`。

## 一次性脚手架（在你本机做，因为要配合微信开发者工具验证）

1. 安装 Taro CLI：`npm i -g @tarojs/cli@4.2.0`
2. 在仓库根目录生成工程（覆盖到本目录）：
   ```
   taro init miniprogram
   ```
   选项：框架 **React**、语言 **TypeScript**、CSS **Sass**、模板 **default**、包管理 **npm**。
3. 生成后，把本目录下我已写好的源码覆盖进去：
   - `src/app.config.ts`
   - `src/lib/api.ts`
   - `src/lib/recorder.ts`
   - `src/pages/practice/index.tsx`
   - `src/pages/practice/index.config.ts`
4. `cd miniprogram && npm install`
5. `npm run dev:weapp`（生成 `dist/`，用微信开发者工具打开 `dist/` 这个目录）

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
