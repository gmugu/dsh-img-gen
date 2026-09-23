<div align="center">

# 🎨 dsh-image-gen（精简 fork）

### 只保留「对话生图 / 图生图」+ 设置页，去掉画布与工作台

<p>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-f5c542?style=flat-square" alt="License: Apache-2.0" /></a>
  <a href="https://github.com/shanliuling/dsh-image-gen"><img src="https://img.shields.io/badge/upstream-v0.6.10-4f6ef7?style=flat-square" alt="Upstream v0.6.10" /></a>
</p>

<p><a href="README.en.md">English</a></p>

</div>

> **这是什么**：本仓库是 [shanliuling/dsh-image-gen](https://github.com/shanliuling/dsh-image-gen) **v0.6.10** 的精简 fork
> （Apache-2.0）。上游同时提供"对话生图"和"AI 创作画布 / Studio 工作台 / 灵感库 / 图库"两套用法；
> 本 fork **只保留前者**：两个 Agent 工具、全部云 Provider、订阅通道、以及设置配置页。
>
> **保留**：`generate_image` / `edit_image`、7 家云 Provider + 本地 ComfyUI、订阅免 Key 通道、
> DSH 凭据（BYOK）、图生图多图参考、设置页配置卡片、生成的图片自动落盘到工作区。
>
> **移除**：无限画布（含 `canvas_state` / `view_canvas` 两个工具）、Studio 工作台、灵感库、图库（画廊）、
> 对话内自定义图卡与版本切换、输入栏 provider 快速切换胶囊。
>
> 因此本 README 只描述保留下来的部分；**画布/工作台/灵感库/多模型对比的完整文档与截图请看
> [上游 README](https://github.com/shanliuling/dsh-image-gen#readme)**。
>
> **最低版本**：自 0.6.11 起，本 fork 需要 **DSH ≥ 0.1.6**（volatile 配置 + `configForms` 客户端
> 服务 + 顶层 `role: 'tool'` 消息）。旧版 DSH 上客户端插件不会加载，参考图识别也不完整。

## 安装

构建产物（`lib/index.js`、`lib/client.js`、类型声明）已随仓库提交，**安装时不需要构建**：

```sh
dsh plugin --profile <你的 profile> add github:gmugu/dsh-img-gen
```

装完**完全退出并重启 DSH**（不是刷新页面），然后确认配置入口出现：
**设置 → 插件 → 插件配置 → 图像生成**（旧版 DSH 为「设置 → 插件 → 插件配置」列表里的一张卡片）。

> 若 pnpm 提示该 git 依赖有构建脚本需要放行：本 fork 已移除 `prepare` 脚本，正常情况下不会触发。

## 配置

| 项 | 说明 |
| :-- | :-- |
| Provider | 在配置页的 Provider 行里选定；部分 Provider 需要填 Base URL / 模型名 |
| API Key | 填在对应 Provider 行内，写入 DSH Credentials（不落明文）。**千问 Token Plan 行读取的 ref 是 `QWEN_TOKEN_PLAN_CN_API_KEY`**（与 `llm-pi-ai` 聊天路由同一个凭据）；某 ref 若已由环境变量提供，该行会显示为**只读**，需在环境变量来源处修改 |
| 测试连接 / 拉取模型 | 按当前 Key 探测端点并拉取可用模型；拉取成功后可从新增的下拉中选择 |
| 输出尺寸 | 生成时两条阿里行始终显式发送 `1024*1024`；图生图按 `size` > `aspect_ratio` > 参考图尺寸 的优先级取一个值——参考图尺寸已知且总像素在 `512*512 … 2048*2048` 内就沿用原图 `W*H`（保持原分辨率），都取不到就完全不发送 `size`，由服务端按参考图比例输出总像素≈1024×1024 |
| 比例换算 | `aspect_ratio`（`16:9` 等）在 Google 行原样使用，在两条阿里行换算成官方推荐分辨率（`16:9 → 1280*720`、`9:16 → 720*1280`、`4:3 → 1280*960`、`3:4 → 960*1280`、`3:2 → 1152*768`、`2:3 → 768*1152`、`1:1 → 1024*1024`）——该原生路由只认 `WIDTH*HEIGHT`，不能转发比例。其他 provider 会忽略 `aspect_ratio`，需要尺寸请直接传 `size` |
| 尺寸校验 | 只要请求了具体的 `WIDTH*HEIGHT`，返回后会按附件记录的真实像素尺寸复核；超出"服务端取整到 16 的倍数"的容差，就在结果文本里给出 `WARNING`，不再静默返回比例不对的图 |
| 落盘 | `saveToWorkspace` 打开后，生成的图片会自动写入当前会话工作区的 `dsh-image-gen/` 目录 |
| 单次覆盖 | 调用工具时可传 `provider` / `model` 临时切换上游，不改动默认配置 |

在普通对话里直接说"画一张…"即可生成；"参考这几张图改成…"即走图生图（`source_path(s)` / `source_attachment_id(s)`）。

## Provider 支持

| Provider | 文生图 | 图生图 | 备注 |
| :-- | :--: | :--: | :-- |
| Google Gemini | ✅ | ✅ | 支持 `aspect_ratio` / `image_size` |
| OpenAI 官方 | ✅ | ✅ | `gpt-image` 系列 |
| OpenAI 兼容中转 | ✅ | ✅ | 需自填 Base URL；可切换 multipart / `jsonImageUrlArray` 两种编辑体 |
| 火山 Seedream (Ark) | ✅ | ✅ | 可控制输出格式 / 水印 / 背景 |
| 阿里 DashScope（通义万相 / Qwen-Image） | ✅ | ✅ | 走 DashScope 原生 `services/aigc/multimodal-generation/generation`；**图生图最多 3 张参考图** |
| 千问 Token Plan（阿里云 MaaS 网关） | ✅ | ✅ | 同一条原生路由，独立端点/凭据（`QWEN_TOKEN_PLAN_CN_API_KEY`）；默认模型 `qwen-image-2.0`，也支持 `wan2.7-image`（图生图不发 `size`，因为该路由未公布其尺寸窗口） |
| xAI Grok | ✅ | ✅ | 走 OpenAI 兼容协议 |
| 智谱 GLM-Image | ✅ | — | 上游本身不支持图生图 |
| 本地 ComfyUI | ✅ | ✅（单张） | 需填 Host 可访问地址并导入 API Format 工作流（含 `{{prompt}}`） |
| 订阅通道（ChatGPT / Grok / Google） | ✅ | ✅ | 在配置页点「登录」完成授权，免 API Key；图生图最多 5 张参考图 |

> 各家默认模型、默认端点、以及更细的参数说明见[上游 README 的 Provider 支持情况](https://github.com/shanliuling/dsh-image-gen#provider-支持情况)。

## 本 fork 与上游的差异

1. **界面**：只保留设置配置页（官方座位 `settings.plugins.tab`，兼容旧版 `settings.plugin.item`）；
   移除画布/工作台/灵感库/图库/对话图卡/provider pill 及其全部 UI-only HTTP 路由。
2. **工具**：只注册 `generate_image` 与 `edit_image`。
3. **依赖**：不再需要 tldraw / lucide-react 等界面依赖。
4. **两处行为增强**（上游没有，便于受限网关与更好用的模型下拉）：
   - 「测试连接 / 拉取模型」在端点没有原生 `/models` 路由时（例如 Qwen Token Plan MaaS 网关），
     会自动回落到 OpenAI 兼容目录 `<origin>/compatible-mode/v1/models`，再不行就用原生图像路由做能力探测；
   - 拉取到的模型改用**原生下拉**选择（上游用 `<datalist>`：当已存模型名不在列表里时会弹出空列表）。
5. 沿用上游 v0.6.9/0.6.10 的修复：官方设置页座位、保存 Key 后再探测的提示、Seedream Ark 输出控件、
   **DashScope 图生图 ≤3 张参考图**的守卫。

维护者视角的裁剪清单与上游同步步骤见 [`trim/CHECKS.md`](trim/CHECKS.md)；
基线、许可证与 fork 专有改动见 [`VENDOR.md`](VENDOR.md)。

## 常见问题

- **配置入口找不到**：本 fork 用官方座位，需要 DSH ≥ 0.1.6（`settings.plugins.tab`）；旧版会在「插件配置」列表里。
  装完必须**完全重启** DSH。
- **测试连接/拉取模型报 404**：多数是端点没有 `/models` 目录（见上文第 4 条回落逻辑），不代表生成不可用。
- **401 / InvalidApiKey**：Key 与端点不匹配。例如 DashScope 官方端点（`dashscope.aliyuncs.com/api/v1`）
  只接受百炼 API Key；订阅类（Token Plan）网关的 Key 要用它自己的端点。
- **图生图报"最多 3 张参考图"**：DashScope 上游限制；需要更多参考图请改用订阅通道（≤5 张）或其他 Provider。

## 许可与致谢

- 本 fork 基于 [shanliuling/dsh-image-gen](https://github.com/shanliuling/dsh-image-gen) **v0.6.10**（commit `93528e0`）修改，
  遵循其 **Apache-2.0** 许可（见 [`LICENSE`](LICENSE)）。
- 上游作者：[@shanliuling](https://github.com/shanliuling)。请优先给上游点 Star；本仓库只提供裁剪版本。