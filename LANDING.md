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
| `pnpm test` | **19 files / 260 tests 全绿**（新增 `alibaba-size` / `edit-size` 两个 spec） |
| 静态 token 自检 | 两个 bundle 的 `tldraw/lucide/canvas_state/view_canvas/CanvasMirror/StudioView/InspirationView/ProviderPill/gallery-page/conversation.*/tool.call.toolview` **全为 0** |
| 官方座位（运行时） | `settings.plugins.tab` occupants 含 `{ id: "image-generation", order: 30, active: true }` ✔ |
| 旧弯路座位 | `plugins.row.config` occupants **已空**（v0.6.8 版手写的非官方座位已消失） |
| 上游特性保留 | `saveKeyFirst`（4 处）、`seedreamWatermark/OutputFormat/Background`（3 处）均在客户端 bundle |
| 部署一致性 | repo 与部署副本的 `package.json`/`cordis.patch.yml`/`lib/index.js`/`lib/client.js` 哈希一致 |

> 客户端已热更新（座位可见）；**服务端 bundle 换了基线，仍需一次完全重启**才会加载（3 张参考图守卫、Ark 控件的服务端半边）。

## 4. 配置入口与已验证的 DashScope 参数

入口：**设置 → 插件 → 插件配置 → 图像生成**（官方页签，与内置 `all` 页签并列）。旧版 DSH（≤0.1.5）上仍走
「设置 → 插件 → 插件配置」列表（两个座位都注册，各自只在存在时生效）。

千问 Token Plan 行读取的凭据 ref 是 **`QWEN_TOKEN_PLAN_CN_API_KEY`**（与 `llm-pi-ai` 聊天路由同一个凭据；
本机 `~/.dsh/.credentials.yaml` 里已有该 ref，因此开箱即用）。若某 ref 由环境变量提供（本机另有
`DASHSCOPE_API_KEY`，属百炼那行），卡片会显示「Key 已配置 / 由 env 提供且只读」并禁用输入框——env 层优先级最高且只读，属设计行为。
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

### 尺寸（`parameters.size`）的官方依据

| 事实 | 来源 |
| :-- | :-- |
| Token Plan 官方 skill 的默认：`size` **默认 1024\*1024**、默认模型 `qwen-image-2.0`，curl 始终带 `parameters.size` | [接入多模态生成模型](https://help.aliyun.com/zh/model-studio/token-plan-multimodal-gen) |
| qwen-image-2.0 系列图生图：**不传 `size` 时总像素接近 `1024*1024`、宽高比与输入图（多图取最后一张）相似**；自定义范围 `512*512 … 2048*2048`；显式指定时输出取整到 16 的倍数 | [Qwen-Image Edit API reference](https://www.alibabacloud.com/help/en/model-studio/qwen-image-edit-api) |
| 百炼 qwen-image-3.0：不指定 `size` 时由模型按提示词自动推荐分辨率 | [千问-图像生成与编辑 3.0](https://help.aliyun.com/zh/model-studio/qwen-image-generation-and-editing-api-reference) |
| `wan2.7-image` 与 qwen 系模型同处这条 `multimodal-generation` 路由（故"放行 wan"是行级能力，不是另一套协议） | Token Plan 文档的模型列表 |
| 各比例的官方推荐分辨率（1:1 1024\*1024 / 1536\*1536、2:3 768\*1152 / 1024\*1536、3:2 1152\*768 / 1536\*1024、3:4 960\*1280 / 1080\*1440、4:3 1280\*960 / 1440\*1080、9:16 720\*1280 / 1080\*1920、16:9 1280\*720 / 1920\*1080、21:9 1344\*576 / 2048\*872） | 同上（本 fork 取每对里较小的那个） |

**落地策略（不加任何 size 配置项）**：

1. **生成**：两条阿里行各自用 profile 常量 `DEFAULT_DASHSCOPE_SIZE = '1024*1024'` 显式发送。
2. **比例换算**：`aspect_ratio` 是 Google 形状的参数，这条路由只能收 `WIDTH*HEIGHT`。**实测的坑**（2026-09-22 飞书会话）：agent 传 `aspect_ratio: "16:9"` → 被静默丢弃、回落到 1024×1024 正方形，且返回值没有任何异常信号，白烧一次生成。现在两条阿里行把比例按上表换算（`16:9 → 1280*720` 等，取较小的推荐值以贴近 ~1MP 默认），表外的比例（如 `21:9`）报可读错误；工具 schema 的 enum 本身也拦得住这类值。
3. **图生图**：优先级 `size` > `aspect_ratio` > 参考图尺寸 —— 参考图尺寸已知且总像素在 `512*512 … 2048*2048` 内就发送原图 `W*H`（保持原分辨率），三者都没有就**完全不发送 `size`**（交给服务端按参考图比例输出 ≈1MP）；`wan` 系模型图生图一律不发 `size`（该网关未公布其尺寸窗口，不猜）。
4. **返回尺寸校验**：只要请求了具体 `WIDTH*HEIGHT`，就用附件记录的真实 `width/height` 复核；差值超过 16px（服务端会把 size 取整到 16 的倍数）就在结果文本里加 `WARNING: the requested size was … but the provider returned …`，并写入 presentation meta 的 `sizeWarning`。这条与供应商无关，将来接新上游时"静默返回错误比例"都会变成显式信号。
5. 其他 provider 保持上游行为：`aspect_ratio` / `image_size` 仍被静默忽略（若也要改，需另行决定）。

若想改为在 DSH 凭据库里手填/替换这个 Key：改 `~/.dsh/.credentials.yaml` 的 `QWEN_TOKEN_PLAN_CN_API_KEY`（或在设置卡里填，若该 ref 不是 env 来源），改完**完全重启 DSH** 最稳。

## 5. 已知偏差与残留（如实记录）

1. `src/image-route.ts`、`src/workspace-save.ts`、`src/shared.ts` **整文件保留**，只解除 `index.ts` 里的路由注册：
   删它们会牵连仍在使用的 `imageAttachmentFromMeta`（图片回流）与 `saveImageToWorkspace`（自动落盘）。
   残留的是"无调用方的导出"，不进入 bundle（入口不可达 → 不打包）；这样换基线时 merge 冲突最小。
2. 保留的 `STYLE` 常量内仍有已删界面的死 CSS（见 `trim/CHECKS.md` 第 4 节末）。
3. 设置卡里原「在对话输入栏显示生图切换胶囊」开关已移除（pill 已删）；`showProviderPill` 字段仍留在客户端
   设置类型里（兼容已持久化的旧值），但没有控件会写它。
4. fork 专有改动**四处**（`test-route` 回落、下拉改原生 `select`、默认 provider、**新增 `qwen-token-plan` 行**）不在上游，
   同步时会冲突，重建步骤见 `trim/CHECKS.md` 第 6 节。
5. **size 不是配置项**（本轮决定）：没有任何 size 设置字段/控件，尺寸来自 profile 常量 + 工具参数 `size`；
   早期版本曾写入 `dashscopeSize` / `qwenTokenPlanSize`，已删除。schemastery 的 `object` 非 strict，历史持久化里的
   这两个键会被原样忽略（不报错、不迁移）。`size` 只接受 `WIDTH*HEIGHT`（`x`/`×`/`X` 会被折叠成 `*`），
   其他值（含 `auto`）在本地就报错——该原生路由没有 `auto`。
6. 图生图的尺寸：只有**会话/附件**路径能拿到参考图宽高（`StoredImageAttachment.ref.width/height`）；
   `source_path(s)` 走本地文件读取，**不解析图片头**，因此这条路径拿不到原图尺寸，只能走"不发 size、由服务端按比例输出"的降级路径。
   若要本地文件也严格等于原图分辨率，需要另加 PNG/JPEG/WebP/GIF 头部尺寸解析器。
7. **比例换算只覆盖两条阿里行**：Google 行本来就吃 `aspect_ratio`；`openai` / `openai-compat` / `seedream` / `xai` / `zhipu`
   仍然静默忽略 `aspect_ratio` 与 `image_size`（上游行为，本轮明确不动）。若也要给它们做换算或报错，需要单独决定。
8. 尺寸校验用的是 DSH 附件服务记录的 `width/height`（`saveImage` 的返回值），因此**没有引入任何图片解码依赖**；
   代价是它只能校验"实际落库的像素"，不能区分"服务端改错了"和"上游返回的图本身就是那样"。
9. 旧分支 `local` 里仍留有第一版文档与一张 `.probe` 探针图（`local:.probe/qwen-image-3.0-pro.png`），
   本分支已无该文件；如需彻底清历史再单独处理。

## 6. 回滚

1. 仅停用插件：`plugin_manager set_bundle dsh-image-gen enabled:false`（+ 重启）。
2. 回到 npm 原版：还原 `profiles/web/{package.json,cordis.patch.yml,pnpm-workspace.yaml}`、
   `~/.dsh/{settings.yaml,.env}` 的 `*.bak-20260921-144628` 备份，然后 `dsh plugin --profile web add dsh-image-gen@0.6.10`（+ 重启）。
3. 回到基线源码：`git checkout v0.6.10`（本分支改动全部未提交，也可只 `git checkout -- <file>` 逐文件丢弃）。

## 7. 当前状态与下一步

- **全部改动未提交**（81 个文件 + 3 个未跟踪文件：`VENDOR.md`、`LANDING.md`、`trim/CHECKS.md`、
  以及 `AUDIT-vs-upstream.md`、`src/client/locale.ts`），等你验证后再决定提交粒度。
- 审阅：`git diff --stat`；重点看 `git diff -- src/index.ts src/client/index.tsx src/test-route.ts src/shared.ts`。
- 下一步：**完全重启 DSH** → 打开「设置 → 插件 → 插件配置 → 图像生成」确认表单可用 →
  拉取模型后从新下拉里选一个模型 → 保存 → 在普通会话里出一张图、再用 2–3 张参考图做图生图。
- 尺寸相关的验证（重启后）：① 生成 → 响应 `usage.width/height` 应为 1024×1024；
  ② 直接说「生成 16:9 的图」（**不传 `size`**）→ 应得到 1280×720，用来复验本轮的比例换算；
  ③ 编辑一张宽高都是 16 倍数的参考图（如 1280×960）→ 输出应与原图一致；
  ④ 编辑一张超出 `2048*2048` 的大图 → 请求体应不带 `size`，输出为 ≈1MP 且比例与原图一致（读 `usage.width/height` 复核）。
  这几条把"服务端省略 size 时的行为"从文档推断变成实测；②还把本次飞书会话暴露的坑锁进了验收步骤。