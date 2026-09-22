<div align="center">

# 🎨 dsh-image-gen (trimmed fork)

### Conversation generation/editing + the settings card — no canvas, no workbench

<p>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-f5c542?style=flat-square" alt="License: Apache-2.0" /></a>
  <a href="https://github.com/shanliuling/dsh-image-gen"><img src="https://img.shields.io/badge/upstream-v0.6.10-4f6ef7?style=flat-square" alt="Upstream v0.6.10" /></a>
</p>

<p><a href="README.md">简体中文</a></p>

</div>

> **What this is**: a trimmed fork of [shanliuling/dsh-image-gen](https://github.com/shanliuling/dsh-image-gen)
> **v0.6.10** (Apache-2.0). Upstream ships both in-chat generation and a full creative workbench
> (infinite canvas, Studio, inspiration library, gallery); this fork keeps **only the former**.
>
> **Kept**: `generate_image` / `edit_image`, all cloud providers plus local ComfyUI, the subscription
> (no-API-key) channels, DSH Credentials (BYOK), multi-reference editing, the settings configuration
> page, and automatic saving of generated images into the session workspace.
>
> **Removed**: the infinite canvas (and the `canvas_state` / `view_canvas` tools), Studio, the
> inspiration library, the gallery view, the in-chat image cards/version switcher, and the composer
> provider pill.
>
> For the canvas / Studio / inspiration / multi-model-compare documentation and screenshots, see the
> [upstream README](https://github.com/shanliuling/dsh-image-gen#readme).

## Install

Build artifacts (`lib/index.js`, `lib/client.js`, the `.d.ts` types) are committed, so installing
needs **no build step**:

```sh
dsh plugin --profile <your profile> add github:gmugu/dsh-img-gen
```

Then **fully quit and restart DSH** (not a page refresh). The configuration page appears at
**Settings → Plugins → Plugin configuration → Image generation** (on DSH ≤ 0.1.5 it is a card inside
the plugin-configuration list).

## Configure

| Item | Notes |
| :-- | :-- |
| Provider | Pick it on the provider row; some providers need a Base URL / model name |
| API key | Entered per provider row and stored in DSH Credentials. The **Qwen Token Plan row resolves `QWEN_TOKEN_PLAN_CN_API_KEY`** (the same credential the `llm-pi-ai` chat route uses). A reference already supplied by an environment variable makes that row **read-only**; change it at that source |
| Test connection / Fetch models | Probes the endpoint with the stored key and lists usable models; pulled models become a dropdown |
| Output size | Generation always sends an explicit `1024*1024` on both Alibaba rows. Editing resolves one value in the order `size` > `aspect_ratio` > reference image size: a known reference image inside `512*512 … 2048*2048` keeps its own `W*H` (and its original resolution); when none applies, no `size` is sent at all and the service keeps the reference aspect ratio at roughly 1024×1024 pixels |
| Aspect ratio | `aspect_ratio` (e.g. `16:9`) is forwarded as-is on the Google row and translated into the service's documented resolution on both Alibaba rows (`16:9 → 1280*720`, `9:16 → 720*1280`, `4:3 → 1280*960`, `3:4 → 960*1280`, `3:2 → 1152*768`, `2:3 → 768*1152`, `1:1 → 1024*1024`) — that native route only accepts `WIDTH*HEIGHT`, so it cannot carry a ratio. Other providers ignore `aspect_ratio`; pass `size` instead |
| Size check | Whenever a concrete `WIDTH*HEIGHT` was requested, the returned image is checked against the pixel size the attachment store recorded. Beyond the slack the service needs for rounding to a multiple of 16, the result text carries a `WARNING` instead of silently handing back a differently-shaped image |
| Save to workspace | With `saveToWorkspace` on, generated images are written to `dsh-image-gen/` in the session workspace |
| Per-call override | `provider` / `model` tool arguments switch upstream for one call without touching the default |

## Provider support

| Provider | Generate | Edit | Notes |
| :-- | :--: | :--: | :-- |
| Google Gemini | ✅ | ✅ | `aspect_ratio` / `image_size` |
| OpenAI | ✅ | ✅ | `gpt-image` family |
| OpenAI-compatible relay | ✅ | ✅ | Needs a Base URL; multipart or `jsonImageUrlArray` edit bodies |
| Volcengine Seedream (Ark) | ✅ | ✅ | Output format / watermark / background controls |
| Alibaba DashScope (Qwen-Image / Wan) | ✅ | ✅ | DashScope native image route; **editing accepts at most 3 reference images** |
| Qwen Token Plan (Alibaba MaaS gateway) | ✅ | ✅ | Same native route, its own endpoint and credential (`QWEN_TOKEN_PLAN_CN_API_KEY`); default model `qwen-image-2.0`, also serves `wan2.7-image` (editing sends no `size` for it, since that route publishes no size window) |
| xAI Grok | ✅ | ✅ | OpenAI-compatible protocol |
| Zhipu GLM-Image | ✅ | — | Upstream model does not support editing |
| Local ComfyUI | ✅ | ✅ (one) | Needs a reachable base URL and an API-format workflow containing `{{prompt}}` |
| Subscription (ChatGPT / Grok / Google) | ✅ | ✅ | Sign in from the settings page; no API key; up to 5 reference images for editing |

## Differences from upstream

1. **UI**: only the settings card remains (official `settings.plugins.tab` seat, plus the legacy
   `settings.plugin.item` for older hosts); the canvas/workbench/inspiration/gallery/in-chat cards and
   the composer pill — and all their UI-only HTTP routes — are gone.
2. **Tools**: only `generate_image` and `edit_image` are registered.
3. **Dependencies**: no tldraw / lucide-react.
4. **Two behavioural additions** not present upstream: the connection probe and model pull fall back to
   the OpenAI-style catalog (`<origin>/compatible-mode/v1/models`) when an endpoint serves no native
   `/models` route, and pulled models are offered through a real `<select>` instead of a `<datalist>`
   (Chrome filters datalist suggestions by the current value, so a stored model that is not in the list
   opens an empty dropdown).
5. Inherited from upstream v0.6.9/0.6.10: the official settings seat, the "save the key before probing"
   prompt, the Seedream Ark output controls, and the DashScope editing limit guard.

See [`trim/CHECKS.md`](trim/CHECKS.md) for the trim inventory and upstream-sync steps, and
[`VENDOR.md`](VENDOR.md) for the baseline, license and fork-only changes.

## License and credits

Based on [shanliuling/dsh-image-gen](https://github.com/shanliuling/dsh-image-gen) **v0.6.10**
(commit `93528e0`), modified, under its **Apache-2.0** license (see [`LICENSE`](LICENSE)).
Upstream author: [@shanliuling](https://github.com/shanliuling) — please star upstream; this repository
only provides the trimmed build.