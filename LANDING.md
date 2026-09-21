# LANDING — 裁剪落地与验收（基线 v0.6.10，版本 0.6.10-local.1）

## 1. 本次做了什么

以**上游 v0.6.10** 为基线重做裁剪（第一版基于 v0.6.8，已取代）：保留对话生图/图生图与**设置配置页**，
移除工作台式 UI。相对 v0.6.10 的改动量：**81 个文件，+925 / −27,672 行**，其中我手写的新代码约 **211 行**，
其余是删除上游界面代码与生成物（pnpm-lock 重写）。

| 面 | 上游 v0.6.10 | 本 fork |
| :-- | :-- | :-- |
| Agent 工具 | 4（含 `canvas_state`/`view_canvas`） | **2** |
| 客户端槽位注册 | 7 处（图卡×2、聊天节点、pill、画廊、工作台、设置） | **2 处，都是设置卡座位**（官方 `settings.plugins.tab` + 兼容 `settings.plugin.item`） |
| HTTP 路由注册 | 9 条 | **4 条**（`test-connection` + 订阅 `login`/`status`；另有 4 条 UI-only 不再注册） |
| 运行时依赖 | tldraw + lucide-react | **无**（react 仅 peer） |
| 体积 | lib 约 14.8MB（含 17MB 文档、8.3MB map） | **lib 约 0.5MB** |

**白拿到的上游修复/特性**（第一版缺失）：官方设置页页签座位、Key 先保存再探测的提示、Seedream Ark 输出控件、
**DashScope 图生图最多 3 张参考图**的守卫、上游新增的两套测试。

## 2. 装在哪

- 源码仓库：`D:\ws\dsh-img-gen`，分支 **`local-v0610`**（基线 v0.6.10）；旧分支 `local`（v0.6.8 版）保留作回滚参考。
- 部署副本：`C:\Users\admin\.dsh\profiles\web\local\dsh-image-gen-noui\`（**无 node_modules**，内容严格等于 `files` 白名单）。
- profile：`"dsh-image-gen": "link:…local/dsh-image-gen-noui"`，且已列入 `dsh.profile.bundles`（Junction 指向部署目录）。

## 3. 已验证的（证据）

| 检查 | 结果 |
| :-- | :-- |
| `pnpm run typecheck` / `build` | exit 0 |
| `pnpm test` | **17 files / 227 tests 全绿** |
| 静态 token 自检 | 两个 bundle 的 `tldraw/lucide/canvas_state/view_canvas/CanvasMirror/StudioView/InspirationView/ProviderPill/gallery-page/conversation.*/tool.call.toolview` **全为 0** |
| 官方座位（运行时） | `settings.plugins.tab` occupants 含 `{ id: "image-generation", order: 30, active: true }` ✔ |
| 旧弯路座位 | `plugins.row.config` occupants **已空**（v0.6.8 版手写的非官方座位已消失） |
| 上游特性保留 | `saveKeyFirst`（4 处）、`seedreamWatermark/OutputFormat/Background`（3 处）均在客户端 bundle |
| 部署一致性 | repo 与部署副本的 `package.json`/`cordis.patch.yml`/`lib/index.js`/`lib/client.js` 哈希一致 |

> 客户端已热更新（座位可见）；**服务端 bundle 换了基线，仍需一次完全重启**才会加载（3 张参考图守卫、Ark 控件的服务端半边）。

## 4. 配置入口与已验证的 DashScope 参数

入口：**设置 → 插件 → 插件配置 → 图像生成**（官方页签，与内置 `all` 页签并列）。旧版 DSH（≤0.1.5）上仍走
「设置 → 插件 → 插件配置」列表（两个座位都注册，各自只在存在时生效）。

本机 `DASHSCOPE_API_KEY` 是 **Windows User 级环境变量**（`sk-sp-…`，与 `QWEN_TOKEN_PLAN_CN_API_KEY` 同前缀），
所以卡片显示「Key 已配置 / 由 env 提供且只读」并禁用输入框——env 层优先级最高且只读，属设计行为。
实测（都用插件同款请求体直连）：

| 项 | 值 / 结果 |
| :-- | :-- |
| 接口地址 | `https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1` |
| 模型 | `qwen-image-3.0-pro` 与 `qwen-image-2.0` 均 **200**；上游默认的 `qwen-image-3.0`（无 `-pro`）→ 404 `Model not exist.` |
| 网关公布的图像模型 | `qwen-image-2.0`、`qwen-image-2.0-pro`、`wan2.7-image`、`wan2.7-image-pro`（列表在 `/compatible-mode/v1/models`） |
| 文生图 / 图生图 | 该端点原生路由 `POST …/services/aigc/multimodal-generation/generation` → **200 / 1024×1024** |
| 图生图参考图上限 | **3 张**（v0.6.10 起有守卫，超出会给出可读报错） |
| 「测试连接」/「拉取模型」 | 该网关**没有** `/api/v1/models`（404），但有 `/compatible-mode/v1/models`（200）——本 fork 的回落逻辑就是为此 |
| 百炼官方端点 | 用这个 key → 401 `InvalidApiKey`（它是 Token Plan 订阅 key，不要把端点重置回 `dashscope.aliyuncs.com`） |

若想改为在 UI 里手填 Key：删掉（或改掉）User 级环境变量 `DASHSCOPE_API_KEY`，再**完全重启 DSH**。

## 5. 已知偏差与残留（如实记录）

1. `src/image-route.ts`、`src/workspace-save.ts`、`src/shared.ts` **整文件保留**，只解除 `index.ts` 里的路由注册：
   删它们会牵连仍在使用的 `imageAttachmentFromMeta`（图片回流）与 `saveImageToWorkspace`（自动落盘）。
   残留的是"无调用方的导出"，不进入 bundle（入口不可达 → 不打包）；这样换基线时 merge 冲突最小。
2. 保留的 `STYLE` 常量内仍有已删界面的死 CSS（见 `trim/CHECKS.md` 第 4 节末）。
3. 设置卡里原「在对话输入栏显示生图切换胶囊」开关已移除（pill 已删）；`showProviderPill` 字段仍留在客户端
   设置类型里（兼容已持久化的旧值），但没有控件会写它。
4. fork 专有改动三处（`test-route` 回落、下拉改原生 `select`、默认 provider）不在上游，同步时会冲突，
   重建步骤见 `trim/CHECKS.md` 第 6 节。
5. 旧分支 `local` 里仍留有第一版文档与一张 `.probe` 探针图（`local:.probe/qwen-image-3.0-pro.png`），
   本分支已无该文件；如需彻底清历史再单独处理。

## 6. 回滚

1. 仅停用插件：`plugin_manager set_bundle dsh-image-gen enabled:false`（+ 重启）。
2. 回到 npm 原版：还原 `profiles/web/{package.json,cordis.patch.yml,pnpm-workspace.yaml}`、
   `~/.dsh/{settings.yaml,.env}` 的 `*.bak-20260921-144628` 备份，然后 `dsh plugin --profile web add dsh-image-gen@0.6.10`（+ 重启）。
3. 回到基线源码：`git checkout v0.6.10`（本分支改动全部未提交，也可只 `git checkout -- <file>` 逐文件丢弃）。

## 7. 当前状态与下一步

- **全部改动未提交**（81 个文件 + 3 个未跟踪文件：`VENDOR.md`、`LANDING.md`、`trim/CHECKS.md`、
  以及 `AUDIT-vs-upstream.md`、`src/client/locale.ts`），等你验证后再决定提交粒度。
- 审阅：`git diff --stat`；重点看 `git diff -- src/index.ts src/client/index.tsx src/test-route.ts`。
- 下一步：**完全重启 DSH** → 打开「设置 → 插件 → 插件配置 → 图像生成」确认表单可用 →
  拉取模型后从新下拉里选一个模型 → 保存 → 在普通会话里出一张图、再用 2–3 张参考图做图生图。