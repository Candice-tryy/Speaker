# Speaker 项目结构梳理

更新时间：2026-07-02

这份文档用于回答一个核心问题：现在仓库里有好几套页面和工程，它们分别是什么阶段、谁是当前可用版本、后续网页/小程序/App 上线应该改哪里。

## 一句话结论

当前仓库不是单一版本，而是三层并行：

- `preview/`：历史静态原型，也是视觉和交互的最重要参照。
- `app/` + `lib/` + `Resource/`：当前最完整的 Web/PWA 版本，同时提供小程序复用的后端 API。
- `miniprogram/`：微信小程序工程，当前正在从“独立简化版”改回“复刻 Web/preview 体验”的阶段，还不是最终完成版。

如果要继续打磨产品体验，优先以 `preview/` 和 `app/` 现有效果为参照；如果要做可上线后端和真实数据，以 `app/api/*`、`lib/*`、`Resource/*` 为准；如果要发布微信小程序，改 `miniprogram/src/*`，构建到 `miniprogram/dist/`。

## 当前在用版本

### 1. Web/PWA 当前主版本

位置：

- `app/page.tsx`
- `app/map/page.tsx`
- `app/map/ClimbingMap.tsx`
- `app/practice/page.tsx`
- `app/practice/CardPractice.tsx`
- `app/profile/page.tsx`
- `app/api/bank/route.ts`
- `app/api/score/route.ts`
- `lib/question-bank.ts`
- `lib/iflytek-ise.ts`
- `lib/llm.ts`
- `Resource/`

运行方式：

```bash
npm.cmd run dev
```

访问：

```text
http://localhost:3000
```

定位：

- 这是目前功能最完整、最接近真实产品的版本。
- `/map` 是登山地图主入口。
- `/practice` 是卡片练习页。
- `/profile` 是设置/目标分/人设/进度页。
- `/api/bank` 把本地题库整理成前端和小程序可消费的 `parts -> peaks -> cards -> questions` 结构。
- `/api/score` 是评分接口：有讯飞 ISE 配置时走真实跟读评分，否则走 mock。

注意：

- `app/` 里仍有部分历史中文乱码文案，尤其是评分接口和部分 UI 文案，需要后续集中清理。
- 根目录 `tsconfig.json` 目前包含 `**/*.ts` 和 `**/*.tsx`，所以 `npm.cmd run build` 也会扫到 `miniprogram/src`。这能提前暴露类型问题，但也会让 Web 构建被小程序源码影响。

### 2. 微信小程序当前工作版本

位置：

- `miniprogram/package.json`
- `miniprogram/config/index.ts`
- `miniprogram/project.config.json`
- `miniprogram/src/app.config.ts`
- `miniprogram/src/pages/map/index.tsx`
- `miniprogram/src/pages/practice/index.tsx`
- `miniprogram/src/pages/profile/index.tsx`
- `miniprogram/src/lib/api.ts`
- `miniprogram/src/lib/store.ts`
- `miniprogram/src/lib/recorder.ts`

运行/构建方式：

```bash
cd miniprogram
npm.cmd run dev:weapp
```

或一次性构建：

```bash
cd miniprogram
npm.cmd run build:weapp
```

微信开发者工具导入目录：

```text
D:\vibe\Speaker\miniprogram
```

不要单独导入 `miniprogram/dist`，因为 `project.config.json` 已经配置：

```json
"miniprogramRoot": "dist/"
```

定位：

- 小程序使用 Taro 4 + React 18。
- 源码在 `miniprogram/src/`。
- 构建产物在 `miniprogram/dist/`，这个目录是生成物，不应该手工改。
- 小程序通过 `miniprogram/src/lib/api.ts` 请求 Next 后端的 `/api/bank` 和 `/api/score`。
- 目前为了避免开发者工具里后端超时导致空屏，`miniprogram/src/lib/api.ts` 带了 `FALLBACK_PARTS` 演示题库。

当前状态：

- 小程序主链路已经开始往 Web/preview 体验回迁，但还不是完全复刻。
- 地图页目前是 Taro 原生 View/SCSS 近似版，不是 Web 版 SVG 几何的完整搬运。
- 练习页已改回卡片练习器方向，但还需要继续对齐 Web 版的交互细节和视觉比例。
- profile 页已从紫色独立风格改回设置/目标分/人设/进度方向。

开发者工具如果仍显示旧报错：

1. 先确认 `npm.cmd run build:weapp` 已经跑过。
2. 微信开发者工具点“清缓存并编译”，选择“清除全部缓存”。
3. 如果页面仍卡在旧状态，打开 `miniprogram/dist/pages/map/index.js`，确认产物是最新的。

手机真机预览注意：

- 模拟器可以访问 `http://localhost:3000` 的场景较多，但真机不能把你的电脑当作自己的 `localhost`。
- 真机预览前，要把 `miniprogram/src/lib/api.ts` 的 `BASE_URL` 换成电脑局域网 IP，例如：

```ts
export const BASE_URL = "http://192.168.x.x:3000";
```

- 正式发布前必须换成备案 HTTPS 域名，并配置微信服务器域名白名单。

### 3. 静态原型版本

位置：

- `preview/climbing-map.html`
- `preview/card-practice.html`
- `preview/examiner.html`
- `preview/profile.html`
- `preview/question-bank.js`
- `preview/*.png`

运行方式：

```bash
python -m http.server 8000
```

访问：

```text
http://127.0.0.1:8000/preview/climbing-map.html
```

定位：

- 这是历史上最早被反复打磨的交互和视觉原型。
- 登山地图的视觉语言、轻导航、右上圆形入口、黄色麦克风、练习页节奏，都应该优先参考这里和 Web 版。
- `preview/question-bank.js` 已经能读取 `Resource/` 里的真实题库。
- 这套不是上线包，不承载真实后端，不直接发布给用户。

不要做的事：

- 不要把 `preview/` 当成唯一真实代码继续扩功能。
- 不要在 `preview/` 里修完体验后忘记同步到 `app/` 或 `miniprogram/`。

适合做的事：

- 快速验证产品交互。
- 对比小程序是否复刻到位。
- 当视觉发生争议时，把 `preview/` 当作参照物。

## 历史版本脉络

从 git 历史看，仓库大致经历了这些阶段：

1. 静态 HTML 原型阶段
   - `preview/` 里有登山地图、练习卡片、考官页、profile。
   - 典型提交包括 `6cd68ac Add examiner boss conversation page`、`02cddcb Redesign climbing map...`。

2. 题库接入静态原型阶段
   - `1748aaf Connect question bank to prototype`
   - 新增/使用 `preview/question-bank.js`。
   - 题库资源来自 `Resource/`。

3. Next.js Web/PWA 阶段
   - `6929a88 Add Next.js app baseline, question bank, and PWA setup`
   - `app/`、`lib/`、`public/`、`app/manifest.ts` 成为 Web 版本主体。

4. API + 小程序垂直切片阶段
   - `5d7390a Add /api/bank endpoint and WeChat mini program vertical slice`
   - 小程序开始复用 Next.js 后端 API。

5. 小程序独立工程完善阶段
   - `0caadf6`、`a41ceb4`、`5363874`、`b8f2f97`
   - 小程序有了地图、练习、我的页、录音和 streak。
   - 但这一阶段的小程序体验逐渐变成另一套简化 UI，和原型不完全匹配。

6. 当前未提交阶段
   - 正在把小程序从“简化独立版”拉回“复刻 Web/preview 体验”的方向。
   - 当前工作区有未提交改动，集中在 `miniprogram/src/*` 和小程序配置。

## 数据与后端关系

### 题库源头

位置：

- `Resource/PART1题库/`
- `Resource/PART2&3题库/`
- `Resource/PART2串题题库/`

其中 JSON 是程序读取主源，MD/CSV 用于人工查看和核对。

### Web 读取题库

代码：

- `lib/question-bank.ts`

职责：

- 读取 `Resource/`。
- 归一化 topic/question/sample answer。
- 生成地图需要的 `parts -> peaks -> cards`。
- 提供 `getQuestion()`、`fallbackAnswer()`、`splitCueCard()` 等工具。

### 小程序读取题库

代码：

- `miniprogram/src/lib/api.ts`

职责：

- 请求 `BASE_URL/api/bank`。
- 请求失败时返回 `FALLBACK_PARTS`，避免开发时空屏。

注意：

- 小程序不能直接读取仓库里的 `Resource/` 文件。
- 小程序正式上线时，需要部署 Next API 或等价后端服务。

### 评分链路

Web/API：

- `app/api/score/route.ts`
- `lib/iflytek-ise.ts`
- `lib/score-map.ts`
- `lib/llm.ts`

小程序：

- `miniprogram/src/lib/recorder.ts`
- `miniprogram/src/lib/api.ts`
- `miniprogram/src/pages/practice/index.tsx`

当前状态：

- 跟读评分设计上走讯飞 ISE。
- 环境变量未配置或无音频时走 mock/重试路径。
- `app/api/score/route.ts` 里有明显中文乱码，需要清理。

## 后续上线分别走哪里

### Web/PWA 上线

主要目录：

- `app/`
- `lib/`
- `Resource/`
- `public/`
- `.env.example` / 部署环境变量

构建：

```bash
npm.cmd run build
```

适合部署到：

- Vercel
- 自己的 Node 服务器
- 任何支持 Next.js App Router 的平台

上线前要做：

- 清理中文乱码。
- 确认 `Resource/` 数据是否应该随包部署。
- 配置讯飞 ISE 环境变量。
- 配置 LLM 环境变量。
- 检查 `app/api/score` 不要在有真实评分配置时静默 mock。

### 微信小程序上线

主要目录：

- `miniprogram/src/`
- `miniprogram/config/`
- `miniprogram/project.config.json`

生成目录：

- `miniprogram/dist/`

构建：

```bash
cd miniprogram
npm.cmd run build:weapp
```

上传：

- 微信开发者工具打开 `D:\vibe\Speaker\miniprogram`
- 使用工具栏“上传”

上线前要做：

- 把 `miniprogram/src/lib/api.ts` 的 `BASE_URL` 改成备案 HTTPS 域名。
- 微信后台配置 request 合法域名。
- 真机测试录音权限和评分请求。
- 继续复刻 Web/preview 的地图和练习页。
- 决定是否保留 `FALLBACK_PARTS`。开发期建议保留，上线期可以保留但要弱化演示感。

### 原生 App / React Native 后续方向

当前仓库里还没有真正的原生 App 工程。

后续如果要做 App，有两条路：

1. 新建独立 App 工程，例如 `mobile/`
   - React Native / Expo。
   - 复用 `app/api/*` 后端。
   - 复用 `Resource/` 转出来的 API 数据。

2. 先把 Web/PWA 做好，再包装或迁移
   - 短期成本低。
   - 但录音、音频处理、真实评分体验可能受 Web 能力限制。

建议：

- 先把 Web/PWA 和小程序的核心体验跑顺。
- App 不要现在混进 `miniprogram/`，应该以后单独建 `mobile/`。

## 哪些文件夹该改，哪些不要直接改

### 继续改产品体验

优先改：

- `app/map/ClimbingMap.tsx`
- `app/map.module.css`
- `app/practice/CardPractice.tsx`
- `app/practice/card.module.css`
- `app/profile/page.tsx`
- `app/profile/profile.module.css`

小程序复刻改：

- `miniprogram/src/pages/map/index.tsx`
- `miniprogram/src/pages/map/index.scss`
- `miniprogram/src/pages/practice/index.tsx`
- `miniprogram/src/pages/practice/index.scss`
- `miniprogram/src/pages/profile/index.tsx`
- `miniprogram/src/pages/profile/index.scss`

### 继续改数据/题库

改：

- `Resource/`
- `lib/question-bank.ts`
- `preview/question-bank.js`（只有需要同步静态原型时）
- `miniprogram/src/lib/api.ts`（只处理小程序请求和 fallback）

### 继续改评分

改：

- `app/api/score/route.ts`
- `lib/iflytek-ise.ts`
- `lib/score-map.ts`
- `lib/llm.ts`
- `miniprogram/src/lib/recorder.ts`
- `miniprogram/src/pages/practice/index.tsx`

### 不要手工改

- `.next/`
- `node_modules/`
- `miniprogram/node_modules/`
- `miniprogram/dist/`
- `miniprogram/.swc/`
- `tsconfig.tsbuildinfo`

这些都是生成物或依赖目录。

## 当前问题清单

### P0：小程序可预览稳定性

- 微信开发者工具可能缓存旧 `dist`。
- 当前已经将地图页改为内置题库初始渲染，降低后端超时影响。
- 若仍打不开，优先看控制台第一条红色错误，不要先调视觉。

### P1：小程序复刻不完整

- 地图页还不是 Web 版 SVG 精准复刻。
- 练习页还需要继续对齐 Web 版细节。
- 下一步应该以 `app/map/ClimbingMap.tsx` 和 `preview/climbing-map.html` 为参照，逐项迁移山体、路线、节点、HUD、底部补给卡。

### P1：中文乱码

明显位置：

- `app/api/score/route.ts`
- 部分旧小程序源文件曾经出现乱码，当前已清了一部分。
- README/miniprogram README 在 PowerShell 里可能也会显示乱码，需要用 UTF-8 工具核验。

处理建议：

- 单独开一次“清理中文文案/编码”的任务。
- 不要在大改 UI 时顺手半清半留，容易漏。

### P2：根 tsconfig 扫小程序

根目录 `tsconfig.json` include 了 `**/*.ts` 和 `**/*.tsx`，所以 Next 构建会检查 `miniprogram/src`。

优点：

- 能提前发现小程序 TS 错误。

缺点：

- Web 构建可能被小程序类型问题卡住。

后续可选：

- 保持现状。
- 或把根 `tsconfig.json` 排除 `miniprogram/`，让 Web 和小程序构建隔离。

## 推荐下一步顺序

1. 先修小程序“能稳定打开”
   - 每次改完跑 `npm.cmd run build:weapp`。
   - 微信开发者工具清缓存编译。

2. 再做小程序地图完全复刻
   - 以 `app/map/ClimbingMap.tsx` 的坐标和路径为准。
   - 小程序端尽量使用可控的 View/CSS 或 Canvas，不要继续做另一套卡片列表。

3. 再做练习页复刻
   - 对齐 `app/practice/CardPractice.tsx`。
   - 优先保证录音、评分、反馈抽屉链路。

4. 清理中文乱码
   - 尤其是 `app/api/score/route.ts`。

5. 最后准备上线
   - Web：部署 Next。
   - 小程序：配置 HTTPS 后端域名，真机测试，上传审核。
