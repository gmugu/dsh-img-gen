# VENDOR — 本地裁剪基线

| 项 | 值 |
| :-- | :-- |
| 上游 | https://github.com/shanliuling/dsh-image-gen |
| 基线 tag | **`v0.6.10`**（此前一版基线是 v0.6.8） |
| 基线 commit | `93528e0d474d4b30c99ffdfa140d70c87c3cef53` |
| 许可证 | **Apache-2.0**（上游在 v0.6.9 由 MIT 改为 Apache-2.0，本 fork 沿用并保留 LICENSE） |
| 本 fork 版本 | `0.6.10-local.1`（`private: true`） |
| 分支 | `local-v0610`（基线 v0.6.10）；旧分支 `local` 是 v0.6.8 版裁剪，已被取代，仅作回滚参考 |
| 远端 | `upstream`（全部 branch/tag 已 fetch，可 merge 同步） |

## 为什么改用 v0.6.10 作基线

上游在 v0.6.9 已经官方解决了"设置卡放哪"的问题——**搬进 `settings.plugins.tab`（设置 → 插件 → 插件配置 → 图像生成）**。本地第一版是在 v0.6.8 上自己实现了另一套座位（`plugins.row.config`），属于重复造轮子。改用 v0.6.10 后一次性白拿：

- 官方座位（并保留对 ≤0.1.5 的 `settings.plugin.item` 兼容注册）；
- `fix(settings)`：拉取模型 / 测试连接前提示**先保存 API Key**；
- `feat(seedream)`：Ark 输出控件（format / watermark / background）+ 其 `config.ts`/`shared.ts` 改动与测试；
- **DashScope 图生图最多 3 张参考图**的守卫（v0.6.8 缺，属行为缺陷）；
- 上游新增测试 `tests/settings-card.spec.ts`、`tests/ark-output-options.spec.ts`。

## 这份 fork 是什么

保留 **对话生图/图生图** 与 **设置配置页**，移除整套工作台式 UI：

- **保留**：`generate_image` / `edit_image`、7 家云 Provider + ComfyUI、订阅通道（login/status 路由）、
  DSH Credentials BYOK、`image-generation` 设置命名空间、官方设置页页签、图片以附件回流对话
  （DSH 内置 `generic` 卡片渲染）、DashScope ≤3 张参考图守卫、Seedream Ark 控件。
- **移除**：tldraw 无限画布与 `canvas_state` / `view_canvas` 两个工具、Studio 工作台（含右栏页签）、
  灵感库、画廊（`conversation.view`）、对话内自定义图卡与版本切换/原位重生成、输入栏 provider pill，
  以及它们专属的 6 条 HTTP 路由（image / delete / save-workspace / canvas-state / canvas-asset / studio / inspiration）。
- **fork 专有（上游没有，同步时会冲突）**：
  1. `src/test-route.ts`：DashScope 的「测试连接 / 拉取模型」在原生 `GET <端点>/models` 返回 404/405 时，
     回落到 `<origin>/compatible-mode/v1/models`，再无目录则用原生图像路由做能力探测（400 = 可达且模型有效）；
  2. 设置卡里"已拉取模型"改用**原生 `<select>`**（上游仍是 `<datalist>`：Chrome 会按输入框当前值过滤，
     存了一个不在列表里的模型名就会弹出空列表，且它嵌在 `<label>` 里）；
  3. `cordis.patch.yml` 的组合默认 provider 改为 `dashscope`；
  4. `package.json`：`files` 收敛、`dsh.client.inject` 收敛为 5 个包、去掉 `prepare` 与全部运行时 `dependencies`。

## 构建与验证

```powershell
cd D:\ws\dsh-img-gen
pnpm install --no-frozen-lockfile     # tldraw/lucide 已不再需要
pnpm run typecheck                    # 0 错误
pnpm run build                        # tsc → lib/types，tsdown → lib/index.js + lib/client.js
pnpm test                             # 17 files / 227 tests 全绿
```

静态自检：两个 bundle 中 `tldraw|lucide|canvas_state|view_canvas|CanvasMirror|registerCanvasTools|StudioView|InspirationView|ProviderPill|dsh-ig-gallery-page|conversation.chat.node|conversation.input.right|sidebar.right.pane.tab|conversation.view|tool.call.toolview` 命中必须为 0；
`settings.plugins.tab` 与 `settings.plugin.item` 各至少 1 处；`dsh-ig-select` 至少 1 处（下拉修复在）。

## 部署形态（重要）

部署副本：`C:\Users\admin\.dsh\profiles\web\local\dsh-image-gen-noui\`，profile 里以
`"dsh-image-gen": "link:C:/Users/admin/.dsh/profiles/web/local/dsh-image-gen-noui"` 安装（与既有
`dsh-sidebar-git`、`dsh-file-editor` 同构），并已加入 `dsh.profile.bundles`。
副本内容严格等于 `files` 白名单：`package.json`、`cordis.patch.yml`、`lib/index.js`、`lib/client.js`、
`lib/types/**/*.d.ts`、`README.md`、`LICENSE`（不含 node_modules、不含 tsc 的 `.js`/`.map` 伴生文件）。

> 为什么放 profile 内而不是直接 link `D:\`：link 到 profile 内目录时，Node 向上解析
> `@deepseek-ai/cordis` 会命中 `profiles/node_modules`（宿主同一实例）；直接链 `D:\` 会用工作区
> `node_modules` 里的第二份 cordis，存在双实例风险。

## 上游同步

```powershell
git fetch upstream --tags
git log --oneline v0.6.10..upstream/main          # 先看上游又发了什么
git merge <new-tag>                               # 冲突按 trim/CHECKS.md 重新施加删除
pnpm install --no-frozen-lockfile
pnpm run typecheck; pnpm run build; pnpm test
# 重跑上面的静态自检 → 刷新部署副本（package.json/cordis.patch.yml/lib）→ 完全重启 DSH
```

版本号保持 `<上游版本>-local.N`；每个裁剪提交单独成 commit，提交信息即重建清单。
基线换成 v0.6.10 后，需**额外重现**的三处 fork 专有改动见 `trim/CHECKS.md` 第 6 节。