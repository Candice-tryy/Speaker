# Speaker 微信小程序

Taro + React + TypeScript 微信小程序。

## 题库读取规则

小程序正式运行时不依赖开发电脑、本地 IP 或同一局域网。当前题库读取顺序是：

```text
微信云开发数据库 current 题库
-> 小程序本地缓存
-> 小程序包内置 current fallback JSON
```

含义：

- 云数据库是正式数据源，包含 current 题目和答案。
- 本地缓存保存上一次成功读取到的云端题库，云端短暂失败时可继续使用。
- 包内 fallback 位于 `src/assets/question-bank.generated.json`，只保留 current 题目，不内置长答案，避免增大小程序 JS 包体。
- 本地 `/api/bank` 只用于开发调试，正式题库更新不走本地 API。

## 运行

```bash
cd miniprogram
npm install
npm run dev:weapp
```

微信开发者工具导入目录：

```text
D:\vibe\Speaker\miniprogram
```

不要单独导入 `miniprogram/dist`，因为 `project.config.json` 已设置：

```json
"miniprogramRoot": "dist/"
```

## 云端题库

构建小程序时需要带上云开发环境 ID：

```bash
$env:CLOUD_ENV_ID="cloud1-d9g4ihxcx7878af8c"
npm run build:weapp
```

这个值会被写入小程序构建产物，用来初始化：

```ts
Taro.cloud.init({ env: __CLOUD_ENV_ID__ })
```

云数据库集合结构（`bank_manifest` / `bank_parts`）、权限规则和发布脚本的完整说明见 [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) 的 Cloud Bank Workflow 一节。要点：用户端只读，题库由本地发布脚本用腾讯云管理端密钥写入。

## 更新题库

日常更新题库只需要在仓库根目录运行：

```bash
cd D:\vibe\Speaker
npm.cmd run bank:publish
```

具体步骤和上传顺序见 [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)。不需要重新构建小程序，除非：

- 换了 `CLOUD_ENV_ID`。
- 改了小程序代码。
- 改了包内 fallback 结构。
- 要发布新的小程序版本。

## 本地 API 调试

题库默认不走本地 API。只有需要调试 Next `/api/bank` 时，才显式开启：

```bash
$env:USE_LOCAL_BANK_API="1"
$env:CLOUD_ENV_ID="none"
npm run build:weapp
```

`CLOUD_ENV_ID` 不设置时构建会使用内置的默认云环境 ID（云题库集合只读，该 ID 不算秘密）；设为 `none` 才会真正关闭云端读取（PowerShell 里把环境变量赋成空串等于删除，表达不了"关闭"）。

此时 `src/lib/api.ts` 会尝试访问：

```text
http://172.20.10.3:3000/api/bank
```

这个通道只适合开发，不作为正式数据更新方案。

## 包体策略

内置 fallback 以静态 JSON 形式复制到小程序包内，不进入 `common.js`。

当前构建结果中：

```text
common.js 约 77 KB
assets/question-bank.generated.json 约 121 KB
```

正常用户优先读取云数据库；只有云端和缓存都不可用时才读取备用 JSON。
