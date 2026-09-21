# trim/CHECKS — 裁剪清单与上游同步预案（基线 v0.6.10）

基线 `v0.6.10`（commit `93528e0`）。本文件是**重建清单**：merge 上游新版本后，按此逐条重新施加删除/修改。
原则：改动以「删除式」为主，解冲突时永远是"把删除重新表达一遍，其余全接受上游"。

## 1. 删除的服务端文件

| 路径 | 原因 |
| :-- | :-- |
| `src/canvas-state.ts` | 画布镜像（host 侧），所有读取方已移除 |
| `src/canvas-state-route.ts` | `/plugins/dsh-image-gen/canvas-state` |
| `src/canvas-asset-route.ts` | `/plugins/dsh-image-gen/canvas-asset`（v0.6.10 新增） |
| `src/canvas-tools.ts` | `canvas_state` / `view_canvas` 两个工具 |
| `src/studio.ts` / `src/studio-route.ts` | Studio 批量生成（UI-only） |
| `src/inspiration.ts` / `src/inspiration-route.ts` | 灵感库（UI-only） |
| `src/system-prompt-service.d.ts` | 画布 systemPrompt 上下文的类型增强 |
| `src/inspiration/data/` | 1.3MB 灵感库数据集 |
| `docs/` | ~17MB README 截图 |

## 2. 删除的客户端文件

`src/client/`：`tl/`（tldraw 画布 + CSS/CSS shim + `canvas-selection.ts`）、`gallery-view.tsx`、`gallery-store.ts`、
`studio-view.tsx`、`studio-style.ts`、`inspiration-view.tsx`、`inspiration-style.ts`、`inspiration-catalog-cache.ts`、
`inspiration-image-cache.ts`、`provider-pill.tsx`、`image-result-node.ts`、`conversation-image-revisions.ts`、
`conversation-regenerate.ts`、`multi-model-compare.ts`、`browser-image-utils.ts`、`image-cache.ts`、`image-ref.ts`。

## 3. `src/index.ts`

- 删 import：`CanvasMirror`、`serveCanvasState`、`serveCanvasAsset` + `CANVAS_ASSET_ROUTE`、`registerCanvasTools`、
  `resolveCanvasSelectionReferences`、`serveImage/serveDelete/serveSaveWorkspace` + 三个 ROUTE、`createInspirationRoute`、
  `generateFromStudio/describeStudio/serveStudio`、`deleteImageFromWorkspace/getDshWorkspaceRoots/getDshWorkspacesFull`、
  `CANVAS_STATE_ROUTE/INSPIRATION_ROUTE/STUDIO_ROUTE`。
- `image-route` 只 import `imageAttachmentFromMeta`；`workspace-save` 只 import `saveImageToWorkspace`。
- 顶层 re-export 只留 `Config`、`imageAttachmentFromMeta`、`TEST_CONNECTION_ROUTE`。
- `apply()` 内删除：`canvasMirror` 常量；`IMAGE_ROUTE`/`DELETE_ROUTE`/`SAVE_WORKSPACE_ROUTE`/`CANVAS_STATE_ROUTE`/
  `CANVAS_ASSET_ROUTE` 五个 `webServer.register` 块；`ctx.inject(['systemPrompt'])` 画布上下文；`registerCanvasTools(...)`；
  `STUDIO_ROUTE` 与 `INSPIRATION_ROUTE` 注册块。
- **保留**：`TEST_CONNECTION_ROUTE`（设置页测试连接/拉取模型）、`registerSubscriptionRoutes` + `SubscriptionManager`、
  `saveImageToWorkspace`（工具自动落盘）、`resolveReferenceImages`（多图参考）、
  `imageAttachmentFromMeta`/`imagePresentation`/`presentResult`。`inject` 仍含 `webServer`。
- `edit_image`：删 `source: 'canvas_selection'` 参数与整个 canvas 分支、描述里的 canvas 句子；
  **保留** `source_attachment_id/ids`、`source_path/ids`。

## 4. `src/client/index.tsx`（只留设置卡）

- **沿用上游 v0.6.10 的 `injectSettingsItem`**（它同时注册 `settings.plugins.tab` 与旧的 `settings.plugin.item`）——
  这是官方座位，**不要改成 `plugins.row.config`**（v0.6.8 版 fork 走过这个弯路）。
- `apply()` 删除：`chatScope`/`isCompactTranscript`、`ctx.inject(['sessions'])`+`startConversationLandings`、
  `promotion`、`ctx.inject(['uiConversation'])` 整块（`createImageResultDefinition`/`PromotedImageResultNode`/
  `asModernUiConversation`）、`conversation.chat.node`、`injectComposerPill`+`conversation.input.right`、
  `tool.call.toolview`×2、`conversation.view`、`sidebarRightTabs`+`sidebar.right.pane.tab`、
  `indexedDB.deleteDatabase('dsh_image_gen_canvas')`、多份样式拼接（只留 `STYLE`）。
- 删除组件：`GeneratedImageCard`、`PromotedImageResultNode`、`PromotedResultNotice`、`ImageResultCard`、
  `usePluginLanguage`、`imageResultFromBlock`（剪除前先证明这些名字在范围内**外部引用为 0**）。
- 删除类型/常量：`ImageCardFace`、`ImageCardProps`、`ImageResultNodeProps`、`ModernUiConversation`、
  `SIDEBAR_STUDIO_TAB_ID/KIND`、`SidebarRightTabsFace`；`LocaleService` 迁到 `src/client/locale.ts`。
- 删除已失效的 pill 开关：`showPill`/`uiMessage`/`uiMessageIsError` 状态、`toggleShowPill`、DICT 的
  `uiSection`/`showPill`/`showPillHint`、以及其 JSX 区块（pill 已删，留着就是无效开关）。
- 已知无害残留：`STYLE` 常量里仍有已删界面的死 CSS（`.dsh-ig-studio-*`、`.dsh-ig-gallery-card/grid/empty`、
  `.dsh-ig-lightbox-*`）。与设置卡样式同处一个共享常量、不参与渲染；gallery 页面外壳与 `:has()` 隐藏规则已删。

## 5. 清单、构建面与测试

- `package.json`：`version` → `0.6.10-local.1`；`private: true`；`files` 收敛为 `lib/index.js`、`lib/client.js`、
  `lib/types/**/*.d.ts`、`cordis.patch.yml`、`README.md`、`README.en.md`、`LICENSE`；
  `dsh.client.inject` 收敛为 `dsh-client-connection`、`dsh-api-remotes`、`dsh-client-ui-settings`、
  `dsh-client-ui-settings-plugins`、`dsh-client-locale`；删 `prepare`；删整段 `dependencies`（tldraw/lucide 已无引用）。
- `tsdown.config.ts`：删 `__CANVAS_BUILD_TS__` define 与 `lucide-react` alias（host + client 两份配置保留）。
- `cordis.patch.yml`：`config.provider` → `dashscope`。
- **同时删除**（不再发布）：`skills/install-dsh-image-gen/`（描述的是 0.1.6 之前的设置路径，已过时）、
  `README.zh-CN.md`（132 字节跳转存根）。
- 测试：删 `canvas-state`、`canvas-sync`、`client-compat`、`css-supports-shim`、`gallery-store`、`image-result-node`、
  `inspiration`、`provider-pill`、`studio` 各 spec；`workspace-save.spec.ts` 删掉整段 "gallery items" describe
  （依赖已删的 gallery-store）；三个 `index*.spec.ts` 的工具断言改为 `['generate_image','edit_image']`，
  并删掉 `ctx.inject(['systemPrompt'], …)` 断言。
- **保留并跑通**：`settings-card.spec.ts`（上游新增，覆盖设置卡）、`ark-output-options.spec.ts`（上游新增）、
  `comfyui`、`config`、`dashscope`、`dashscope-edit`、`google`、`openai-compatible`、`redact`、`reference-image`、
  `seedream`、`subscription-edit`、`test-route`、`workspace-save`（其余部分）。当前 **17 files / 227 tests**。

## 6. 换基线后必须重新施加的 fork 专有改动

1. `src/test-route.ts` + `tests/test-route.spec.ts`：从旧分支整份取回即可
   （`git checkout local -- src/test-route.ts tests/test-route.spec.ts`），因为上游在这两个文件上尚未改动。
   内容 = DashScope 的 `/models` 404/405 回落 + 原生图像路由能力探测 + 4 个新测试。
2. `src/client/index.tsx` 的模型下拉修复：`pickOptions` 常量 + `<label>` 之外的原生 `<select>` +
   DICT 的 `modelPick`/`modelPickPlaceholder`/`modelPickCurrent` + CSS `.dsh-ig-select{appearance:auto;cursor:pointer}`。
3. `cordis.patch.yml` 默认 provider、`package.json` 的 4 项收敛（见第 5 节）。

## 7. 验证门槛（每次同步后必跑）

1. `pnpm run typecheck && pnpm run build && pnpm test` 全绿。
2. `lib/` 只有 `index.js`、`client.js`（`client.js.map` 仅本地，`files` 不发布，部署时也不复制）。
3. 静态 token 自检（见 `VENDOR.md`）全为 0；`settings.plugins.tab`、`settings.plugin.item`、`dsh-ig-select` 均在。
4. 启用后：host 工具表只有 `generate_image`/`edit_image`（无 `canvas_state`/`view_canvas`）；
   client 侧 `settings.plugins.tab` 的 occupants 含 `id: image-generation`，而
   `conversation.view`/`sidebar.right.pane.tab`/`conversation.input.right`/`tool.call.toolview`/`plugins.row.config` 均无。
5. 注意 `factory:<包名>` **不是**客户端插件的探针（那是 slot factory；`factory:dsh-sidebar-git` 同样返回 false）。
   判断客户端半边是否加载，用第 4 条的槽位 occupants。