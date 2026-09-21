# 与上游对比的审计（2026-09-21）

- 本 fork 基线：上游 **v0.6.8**（commit `7d4fde5`）
- 对照：上游 **v0.6.9**（`d01fc3f`）、**v0.6.10**（`93528e0`）
- 本 fork 当前 HEAD：`31d5c75`；工作区另有 1 个未提交改动（下拉修复）

---

## 0. 结论速览

1. **没有误改上游代码**：所有 Provider / 凭据 / 配置 / 落盘 / 路由模块与 v0.6.8 **逐字节相同**；我改动的文件只有 7 个 + 5 个测试。
2. **没有悬空引用**：客户端只调 3 条路由，服务端都还注册着。
3. **确实缺失 4 项上游改动**（其中 1 项正好是你现在的用法：**DashScope 图生图最多 3 张参考图**的守卫）。
4. **我引入了 6 项缺陷/风险**，其中最有价值的一条是：**上游 v0.6.9 已经官方把设置卡搬到 `settings.plugins.tab`，而我手写了一个非官方座位 `plugins.row.config`** —— 我在动手前没有先对比新版上游。
5. 建议：**以 v0.6.10 重做裁剪**，而不是继续在 v0.6.8 上手补（可一次性消掉第 3 节全部 4 项 + 第 4 节第 1 项）。

---

## 1. 没有误改（证据）

```
git diff --numstat 7d4fde5 HEAD -- src/dashscope.ts src/google.ts src/openai-compatible.ts \
  src/seedream.ts src/comfyui.ts src/comfyui-workflow.ts src/credentials.ts src/config.ts \
  src/reference-image.ts src/redact.ts src/workspace-save.ts src/image-route.ts src/shared.ts \
  src/subscription.ts
```
→ 全部 `untouched`（空输出）。也就是说：**7 家 Provider 的请求实现、凭据解析、配置 schema、工作区落盘、`imageAttachmentFromMeta` 全部是上游原样**。

我相对上游实际改动的文件：
```
M cordis.patch.yml        （provider 默认值 google→dashscope）
M package.json            （注入清单 / files / private / 版本号 / 依赖）
M src/index.ts            （只删注册，未动两个工具的实现）
M src/client/index.tsx    （槽位注册裁剪 + 座位适配 + 下拉）
M src/test-route.ts       （DashScope /models 回落，fork 独有）
M tsdown.config.ts        （删画布时间戳 define、lucide alias）
A src/client/locale.ts    （LocaleService 类型搬家）
M tests/{index,index-legacy-settings,index-unsupported-settings,test-route,workspace-save}.spec.ts
```

保留代码的修改面很小，是可审计的；两个工具（`generate_image` / `edit_image`）的**实现体**在上游与我的版本之间只有 `edit_image` 的 canvas 分支差异（见第 3 节）。

## 2. 没有悬空引用（证据）

客户端 `fetch` 只打 3 个常量（`src/client/index.tsx` L964/1017/1043/1220/1238）：
`SUBSCRIPTION_STATUS_ROUTE`、`SUBSCRIPTION_LOGIN_ROUTE`、`TEST_CONNECTION_ROUTE`。
服务端注册：`src/index.ts` 有 `TEST_CONNECTION_ROUTE`；`registerSubscriptionRoutes()` 注册 login/status。
→ **一一对应，无悬空调用**；被我删掉的 image / delete / save-workspace / canvas-state / studio / inspiration 六条路由，客户端已无任何引用。

## 3. 上游有而我没有（v0.6.8 → v0.6.10）

| 上游提交 | 内容 | 对我的影响 | 我的状态 |
| :-- | :-- | :-- | :-- |
| `8e15713` feat(client) | **设置卡搬到插件页，座位 = `settings.plugins.tab`** | 我用的是 `plugins.row.config`（同代另一个座位）。两者都可用，但**官方路径正是你找的「设置 → 插件 → 插件配置 → 图形生成」**；我这条还逼我多写了 summary/page 分支 | **缺失（自造替代）** |
| `d9a58cd`（其中一处） | `src/dashscope.ts`：**DashScope 图生图最多 3 张参考图**的守卫（超出直接给出可读报错） | 你的硬需求是"多图参考"。**我的 fork 没有这个守卫**：传 4–5 张会走到 API 才失败，报错不可读；也说明 **DashScope 上游最多 3 张**，5 张必须换通道 | **缺失（且是行为缺陷）** |
| `bc01d5b` feat(seedream) | Ark 输出控件（format / watermark / background）+ `config.ts`/`shared.ts`/新测试 | 只影响 Seedream 行的 UI 与参数；我没做 | 缺失（功能） |
| `51132bb` fix(settings) | **拉取模型/测试连接前提示先保存 Key** | 正好是你这台机器上遇到的一类困惑（改了不保存就点探测） | 缺失（UX 修复） |
| `0d3e24e` chore | **许可证 MIT → Apache-2.0** | 我 vendored 的是 MIT 时期的 v0.6.8，LICENSE 仍是 MIT，**与基线一致**；但后续同步要按 Apache-2.0 保留版权/NOTICE | 合规提示 |
| `4396ec8` test/docs | 覆盖 legacy 设置座位、写明两条设置路径；新增 `tests/settings-card.spec.ts` | 我删了 `tests/client-compat.spec.ts`（它覆盖的就是这张卡），且没有替代 → **卡片这块目前零自动化覆盖** | 缺失（测试） |

## 4. 我引入的缺陷 / 风险

| # | 内容 | 性质 | 影响 | 现状 |
| :-- | :-- | :-- | :-- | :-- |
| 1 | 座位选了非官方的 `plugins.row.config`，而没先对比上游 v0.6.9 的 `settings.plugins.tab` | **设计缺陷**（重复造轮子 + 偏离上游） | 位置与官方/你的预期不一致；同步上游时冲突面更大；多写了 summary/page 分支 | 待你决定是否改座位 |
| 2 | 缺 DashScope 3 张参考图守卫 | **行为缺陷** | 4+ 张参考图时报错不可读；你的"2–5 张多图参考"在 DashScope 上实际上限是 3 | 未修 |
| 3 | `git add -A` 把你生成的两张图（2.8MB）扫进提交，也把我自己的 `.probe/qwen-image-3.0-pro.png`（513KB）扫进 `31d5c75` | **流程错误 / 仓库污染** | 你的图已随 b61f327 回退清除（磁盘文件完好）；`.probe` 那张**仍在历史里** | 后者待你决定 |
| 4 | 删测试时连带删掉 `client-compat.spec.ts`（覆盖设置卡）且无替代 | **覆盖缺失** | 卡片相关回归无法被自动化发现（这次下拉问题就是你先发现的） | 未补 |
| 5 | 文档两处错判：`factory:<包名>` 当客户端探针（错）；"只有 qwen-image-2.0 存在"（探测不全） | **结论错误** | 曾误导你；均已在后续文档更正 | 已更正 |
| 6 | 过程中两次自伤：重复插入 CSS 规则、误删仍在用的 state | **低级错误** | 均在 typecheck/提交前修回，未留在提交里 | 已修 |
| 7 | `src/test-route.ts` 的 /models 回落是 **fork 专有**，上游没有 | 偏离上游 | 同步时会冲突；`/compatible-mode/v1/models` 是启发式路径，理论上存在误判为 ok 的可能（低） | 已由你实测（拉取成功）间接验证 |
| 8 | 次要：`files` 里去掉 `skills/**`（打包的安装技能不再随包分发）；删 `docs/`（README 图片链接失效）；加 `private`；去 `prepare` | 有意裁掉的边角 | 纯文档/分发面 | 已记录 |

## 5. 建议

**A（推荐）：以 v0.6.10 为基线重做裁剪。**
- 直接白拿：官方 `settings.plugins.tab` 座位、Key 保存提示、Ark 输出控件、**3 张参考图守卫**、上游的 `settings-card.spec.ts` 覆盖；
- 我的 `trim/CHECKS.md` 就是为此写的重建清单，删改动作基本可照搬；
- 代价：重做一遍（多数是机械删除），以及我手写的座位适配/下拉修复要重新评估是否还需要。

**B：继续停在 v0.6.8，只 cherry-pick 那 4 项。**
- 改动小、见效快；但 fork 会永久落后，且我的手写座位仍与上游不一致，将来合并会更痛。

无论选哪个，第 4 节的 #2（3 张守卫）与 #4（卡片测试）都应当补。

## 6. 复现命令

```powershell
cd D:\ws\dsh-img-gen
git diff --numstat 7d4fde5 HEAD -- src/dashscope.ts src/config.ts src/shared.ts   # 1 节
git log --oneline v0.6.8..v0.6.10                                                 # 3 节全貌
git diff v0.6.8 v0.6.10 -- src/dashscope.ts src/client/slots-service.d.ts         # 3 节 1/2 项
git ls-tree -r HEAD --name-only | Select-String '\.probe/|dsh-image-gen/'         # 4 节 #3
git status --short                                                                # 未提交改动
```