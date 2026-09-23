import { defineTool } from "@deepseek-ai/dsh-tools";
import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { mkdir, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import http from "node:http";
//#region lib/types/shared.js
/** Browser route the settings card probes provider connectivity through. */
const TEST_CONNECTION_ROUTE = "/plugins/dsh-image-gen/test";
const SUBSCRIPTION_LOGIN_ROUTE = "/plugins/dsh-image-gen/subscription-login";
const SUBSCRIPTION_STATUS_ROUTE = "/plugins/dsh-image-gen/subscription-status";
/** Supported providers. */
const IMAGE_PROVIDERS = [
	"google",
	"openai",
	"openai-compat",
	"seedream",
	"dashscope",
	"qwen-token-plan",
	"xai",
	"zhipu",
	"comfyui",
	"chatgpt-sub",
	"grok-sub",
	"google-sub"
];
/**
* Providers that generate through a logged-in subscription account instead
* of an API key. They use no credential reference and never join the
* cloud/BYOK sets.
*/
const SUBSCRIPTION_PROVIDERS = [
	"chatgpt-sub",
	"grok-sub",
	"google-sub"
];
/** True when the provider generates through a logged-in subscription account. */
function isSubscriptionProvider(provider) {
	return SUBSCRIPTION_PROVIDERS.includes(provider);
}
[...SUBSCRIPTION_PROVIDERS];
/** Timeout for one subscription image call, shared by the tool path and the
* studio route so neither drifts from the other. */
const SUBSCRIPTION_TIMEOUT_MS = 3e5;
/**
* Credential references resolved through the DSH Credentials service (BYOK).
* These are POSIX-style reference names, not environment variables: the host
* layers the process environment and its managed store behind them, so a name
* like OPENAI_API_KEY is shared with any other plugin resolving the same ref.
*/
const GOOGLE_API_KEY_ENV = "GEMINI_API_KEY";
/** OpenAI Platform credential reference. */
const OPENAI_API_KEY_ENV = "OPENAI_API_KEY";
/**
* OpenAI-compatible relay credential reference. Deliberately distinct from
* OPENAI_API_KEY so an official key and a relay key can coexist without
* overwriting each other.
*/
const OPENAI_COMPAT_API_KEY_ENV = "DSH_IMAGE_GEN_OPENAI_COMPAT_KEY";
/** Volcengine Ark credential reference. */
const SEEDREAM_API_KEY_ENV = "ARK_API_KEY";
/** DashScope credential reference. */
const DASHSCOPE_API_KEY_ENV = "DASHSCOPE_API_KEY";
/**
* Qwen Token Plan credential reference. It matches the reference the plan's own
* LLM route uses (`llm-pi-ai` resolves `QWEN_TOKEN_PLAN_CN_API_KEY`), so the
* image row and the chat row share one credential.
*/
const QWEN_TOKEN_PLAN_API_KEY_ENV = "QWEN_TOKEN_PLAN_CN_API_KEY";
/** xAI credential reference; matches the official xAI SDK environment name. */
const XAI_API_KEY_ENV = "XAI_API_KEY";
/** Zhipu credential reference; matches the official Zhipu SDK environment name. */
const ZHIPU_API_KEY_ENV = "ZHIPUAI_API_KEY";
/** The credential reference each cloud provider's API key is stored under. */
const CLOUD_CREDENTIAL_REFS = {
	google: GOOGLE_API_KEY_ENV,
	openai: OPENAI_API_KEY_ENV,
	"openai-compat": OPENAI_COMPAT_API_KEY_ENV,
	seedream: SEEDREAM_API_KEY_ENV,
	dashscope: DASHSCOPE_API_KEY_ENV,
	"qwen-token-plan": QWEN_TOKEN_PLAN_API_KEY_ENV,
	xai: XAI_API_KEY_ENV,
	zhipu: ZHIPU_API_KEY_ENV
};
/** Locale-neutral provider names for user-facing errors and status lines. */
const PROVIDER_DISPLAY_NAMES = {
	google: "Google Gemini",
	openai: "OpenAI",
	"openai-compat": "OpenAI 兼容",
	seedream: "Seedream",
	dashscope: "DashScope",
	"qwen-token-plan": "千问 Token Plan",
	xai: "xAI Grok",
	zhipu: "智谱 GLM",
	comfyui: "ComfyUI",
	"chatgpt-sub": "ChatGPT 订阅",
	"grok-sub": "Grok 订阅",
	"google-sub": "Google 订阅"
};
/** Display names for the subscription providers, separate from the BYOK table. */
const SUBSCRIPTION_PROVIDER_DISPLAY_NAMES = {
	"chatgpt-sub": "ChatGPT 订阅",
	"grok-sub": "Grok 订阅",
	"google-sub": "Google 订阅"
};
/** Default endpoints and base URLs. */
const DEFAULT_GOOGLE_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_SEEDREAM_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_DASHSCOPE_ENDPOINT = "https://dashscope.aliyuncs.com/api/v1";
/**
* Qwen Token Plan (Alibaba MaaS) endpoint. Same DashScope-native
* `/services/aigc/multimodal-generation/generation` route as Bailian, but a
* different host, key family and model set; see the zcode text-to-image skill.
*/
const DEFAULT_QWEN_TOKEN_PLAN_ENDPOINT = "https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1";
const DEFAULT_XAI_BASE_URL = "https://api.x.ai/v1";
const DEFAULT_ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
const DEFAULT_COMFYUI_BASE_URL = "http://127.0.0.1:8188";
const DEFAULT_COMFYUI_TIMEOUT_MS = 3e5;
const DEFAULT_COMFYUI_WORKFLOW_LABEL = "API workflow";
/** Content types Ark's Seedream endpoint can return. */
const ARK_OUTPUT_FORMATS = ["png", "jpeg"];
/** Whether Ark stamps an "AI generated" watermark on the result. */
const ARK_BACKGROUND_MODES = ["opaque", "transparent"];
/**
* Map the Ark output controls onto request-body fields.
*
* `background` is opt-in per call site because Ark restricts `transparent` to
* image-to-image with a single alpha-bearing reference and rejects the whole
* request otherwise:
*
*   text-to-image + transparent → 400 InvalidParameter
*     "transparent background requires exactly one input image"
*
* So the generation endpoint must never carry it, and that caller passes
* `{ background: false }`. `background: opaque` is never emitted anywhere: it
* is already Ark's default, so sending it would change nothing while adding a
* field only the edit path can act on.
*/
function arkOutputBody(options, { background = true } = {}) {
	if (options === void 0) return {};
	const body = {};
	if (options.outputFormat !== void 0) body.output_format = options.outputFormat;
	if (options.watermark !== void 0) body.watermark = options.watermark;
	if (background && options.background === "transparent") body.background = "transparent";
	return body;
}
/** Default model names. */
const DEFAULT_GOOGLE_MODEL = "gemini-3.1-flash-image";
const DEFAULT_OPENAI_MODEL = "gpt-image-2";
const DEFAULT_SEEDREAM_MODEL = "doubao-seedream-5-0-260128";
const DEFAULT_DASHSCOPE_MODEL = "qwen-image-3.0";
/** Qwen Token Plan default image model (the zcode text-to-image skill's default). */
const DEFAULT_QWEN_TOKEN_PLAN_MODEL = "qwen-image-2.0";
/**
* Alibaba-native `parameters.size` form: `WIDTH*HEIGHT`, never `WxH`. Both the
* Bailian and the Qwen Token Plan rows send it explicitly on generation; the
* Qwen Token Plan skill documents `1024*1024` as its default. Omitting `size`
* instead lets the service keep the input image's aspect ratio at roughly the
* same total pixel count, which is what the editing path relies on.
*/
const DEFAULT_DASHSCOPE_SIZE = "1024*1024";
const DEFAULT_XAI_MODEL = "grok-imagine-image";
const DEFAULT_ZHIPU_MODEL = "glm-image";
/** Named workflows, falling back to the legacy single-workflow fields when the list is empty. */
function resolveComfyUIWorkflows(source) {
	const named = [];
	for (const entry of source.comfyuiWorkflows ?? []) {
		const name = typeof entry?.name === "string" ? entry.name.trim() : "";
		const json = typeof entry?.json === "string" ? entry.json : "";
		if (name.length > 0 && json.trim().length > 0) {
			const presetPrompt = typeof entry.presetPrompt === "string" ? entry.presetPrompt.trim() : "";
			named.push(presetPrompt.length > 0 ? {
				name,
				json,
				presetPrompt
			} : {
				name,
				json
			});
		}
	}
	if (named.length > 0) return named;
	const legacyJson = typeof source.comfyuiWorkflowJson === "string" ? source.comfyuiWorkflowJson : "";
	if (legacyJson.trim().length === 0) return [];
	const legacyName = typeof source.comfyuiWorkflowName === "string" ? source.comfyuiWorkflowName.trim() : "";
	return [{
		name: legacyName.length > 0 ? legacyName : DEFAULT_COMFYUI_WORKFLOW_LABEL,
		json: legacyJson
	}];
}
/** The workflow ComfyUI calls use by default: the configured active name, else the first entry. */
function activeComfyUIWorkflow(source) {
	const workflows = resolveComfyUIWorkflows(source);
	if (workflows.length === 0) return void 0;
	const activeName = typeof source.comfyuiActiveWorkflow === "string" ? source.comfyuiActiveWorkflow.trim() : "";
	return workflows.find((workflow) => workflow.name === activeName) ?? workflows[0];
}
/**
* Combine a workflow's preset with the user prompt: preset first, user second,
* joined by one comma — never doubled when the preset already ends in a
* separator, and reduced to the non-empty side when the other is blank.
*/
function mergeComfyUIPrompt(preset, user) {
	const presetText = typeof preset === "string" ? preset.trim().replace(/[,;\s]+$/, "") : "";
	const userText = user.trim();
	if (presetText.length === 0) return userText;
	if (userText.length === 0) return presetText;
	return `${presetText}, ${userText}`;
}
/**
* Total-pixel window the Alibaba-native editing route documents for an explicit
* `size`: `512*512` to `2048*2048` (qwen-image-2.0 series and qwen-image-3.0).
*/
const ALIBABA_EDIT_SIZE_RANGE = {
	minTotalPixels: 262144,
	maxTotalPixels: 4194304
};
/**
* The service's documented recommended resolutions for the aspect ratios this
* plugin accepts, kept in the tool's own ratio order. Each ratio publishes a
* second, larger option (for example 1:1 also allows `1536*1536`); the smaller
* one is used so a ratio request stays near the plugin's ~1MP default size.
*
* This table exists because `aspect_ratio` is a Google-shaped parameter the
* Alibaba rows cannot forward: they take `WIDTH*HEIGHT` and nothing else, so a
* ratio used to be dropped on the floor and the request fell back to a square.
*/
const ALIBABA_RATIO_SIZES = {
	"1:1": "1024*1024",
	"3:2": "1152*768",
	"2:3": "768*1152",
	"4:3": "1280*960",
	"3:4": "960*1280",
	"16:9": "1280*720",
	"9:16": "720*1280"
};
/**
* Translate a caller's `aspect_ratio` into the Alibaba-native `size` the route
* actually accepts. `undefined` means the caller did not ask for a ratio; an
* unsupported ratio throws with the accepted list instead of quietly returning
* a differently-shaped image.
*/
function alibabaAspectSize(aspectRatio) {
	if (aspectRatio === void 0) return void 0;
	const ratio = aspectRatio.trim();
	if (ratio.length === 0) return void 0;
	const size = ALIBABA_RATIO_SIZES[ratio];
	if (size === void 0) throw new Error(`Unsupported aspect_ratio ${JSON.stringify(aspectRatio)} for the Alibaba rows. Use one of ${Object.keys(ALIBABA_RATIO_SIZES).join(", ")}, or pass size as "WIDTH*HEIGHT" (for example 1280*720).`);
	return size;
}
/**
* Compare the image that came back against the size the caller asked for.
*
* The service may round an explicit size to a nearby multiple of 16, so a few
* pixels of slack are expected and harmless; anything beyond that means the
* upstream ignored or altered the request, and the caller must be told rather
* than left trusting a label the image does not match.
*/
function sizeMismatch(requested, actual, tolerancePixels = 16) {
	const normalized = requested.trim().replace(/[x×X*]/g, "*");
	const match = /^(\d+)\*(\d+)$/.exec(normalized);
	if (match === null) return void 0;
	const width = Number(match[1]);
	const height = Number(match[2]);
	if (Math.abs(actual.width - width) <= tolerancePixels && Math.abs(actual.height - height) <= tolerancePixels) return void 0;
	return `the requested size was ${String(width)}*${String(height)} but the provider returned ${String(actual.width)}×${String(actual.height)}, so the upstream ignored or altered it.`;
}
/**
* Output size for an Alibaba-native edit call, derived from the reference image
* the service will actually see.
*
* `size` is sent only when it can faithfully match the original: a known,
* in-range reference image. Otherwise `undefined` leaves the field out, and the
* service keeps the input image's aspect ratio at roughly the same total pixel
* count — which is the documented default and never an out-of-range 400.
*
* Multi-image edits follow the last image's aspect ratio, so the last reference
* decides. The Wan family is excluded: the gateway documents no size window for
* it on this route, so guessing one would risk a rejection.
*/
function alibabaEditSize(sources, model) {
	if (model.trim().toLowerCase().startsWith("wan")) return void 0;
	const last = sources[sources.length - 1];
	const width = last?.width;
	const height = last?.height;
	if (typeof width !== "number" || typeof height !== "number") return void 0;
	if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return void 0;
	const totalPixels = width * height;
	if (totalPixels < ALIBABA_EDIT_SIZE_RANGE.minTotalPixels || totalPixels > ALIBABA_EDIT_SIZE_RANGE.maxTotalPixels) return void 0;
	return `${String(width)}*${String(height)}`;
}
/** Default models for the subscription channels; fixed by the bridge protocol. */
const DEFAULT_SUBSCRIPTION_MODELS = {
	"chatgpt-sub": "gpt-image-2.5-flare",
	"grok-sub": "grok-imagine-image-2.0",
	"google-sub": "gemini-3-pro-image"
};
DEFAULT_SUBSCRIPTION_MODELS["chatgpt-sub"], DEFAULT_SUBSCRIPTION_MODELS["grok-sub"], DEFAULT_SUBSCRIPTION_MODELS["google-sub"];
/**
* Cordis configuration schema. The root is volatile: DSH 0.1.6+ derives the
* settings form from it and applies edits live (the plugin receives one
* reference cell whose `.get()` always yields the current values); the
* plain-object shape only appears in unit tests that call `apply` directly.
*/
const Config = z.object({
	provider: z.union(IMAGE_PROVIDERS).default("google"),
	googleModel: z.string().default(DEFAULT_GOOGLE_MODEL),
	googleEndpoint: z.string().default(DEFAULT_GOOGLE_ENDPOINT),
	openaiBaseURL: z.string().default(DEFAULT_OPENAI_BASE_URL),
	openaiModel: z.string().default(DEFAULT_OPENAI_MODEL),
	openaiCompatBaseURL: z.string().default(""),
	openaiCompatModel: z.string().default(""),
	openaiCompatEditFormat: z.union([z.const("multipart"), z.const("jsonImageUrlArray")]).default("multipart"),
	openaiCompatEditExtra: z.dict(z.any()).default({}),
	seedreamBaseURL: z.string().default(DEFAULT_SEEDREAM_BASE_URL),
	seedreamModel: z.string().default(DEFAULT_SEEDREAM_MODEL),
	seedreamOutputFormat: z.union(ARK_OUTPUT_FORMATS).default("jpeg"),
	seedreamWatermark: z.boolean().default(true),
	seedreamBackground: z.union(ARK_BACKGROUND_MODES).default("opaque"),
	dashscopeEndpoint: z.string().default(DEFAULT_DASHSCOPE_ENDPOINT),
	dashscopeModel: z.string().default(DEFAULT_DASHSCOPE_MODEL),
	qwenTokenPlanEndpoint: z.string().default(DEFAULT_QWEN_TOKEN_PLAN_ENDPOINT),
	qwenTokenPlanModel: z.string().default(DEFAULT_QWEN_TOKEN_PLAN_MODEL),
	xaiBaseURL: z.string().default(DEFAULT_XAI_BASE_URL),
	xaiModel: z.string().default(DEFAULT_XAI_MODEL),
	zhipuBaseURL: z.string().default(DEFAULT_ZHIPU_BASE_URL),
	zhipuModel: z.string().default(DEFAULT_ZHIPU_MODEL),
	comfyuiBaseURL: z.string().default(DEFAULT_COMFYUI_BASE_URL),
	comfyuiWorkflows: z.array(z.object({
		name: z.string(),
		json: z.string(),
		presetPrompt: z.string().default("")
	})).default([]),
	comfyuiActiveWorkflow: z.string().default(""),
	comfyuiWorkflowJson: z.string().default(""),
	comfyuiWorkflowName: z.string().default(""),
	comfyuiTimeoutMs: z.number().min(1e3).max(36e5).default(DEFAULT_COMFYUI_TIMEOUT_MS),
	saveToWorkspace: z.boolean().default(true),
	workspaceFolder: z.string().default("dsh-image-gen")
}).volatile();
/** Resolve exactly one provider profile for a tool call. */
function resolveProvider(config) {
	switch (config.provider ?? "google") {
		case "openai": return {
			provider: "openai",
			apiKeyEnv: OPENAI_API_KEY_ENV,
			model: config.openaiModel ?? "gpt-image-2",
			baseURL: config.openaiBaseURL ?? "https://api.openai.com/v1",
			imageSize: "1024x1024"
		};
		case "openai-compat": {
			const baseURL = config.openaiCompatBaseURL?.trim();
			if (baseURL === void 0 || baseURL.length === 0) throw new Error("OpenAI 兼容 provider requires a base URL; set it in Settings > Plugins > Image generation.");
			const model = config.openaiCompatModel?.trim();
			if (model === void 0 || model.length === 0) throw new Error("OpenAI 兼容 provider requires a model name; set it in Settings > Plugins > Image generation.");
			return {
				provider: "openai-compat",
				apiKeyEnv: OPENAI_COMPAT_API_KEY_ENV,
				model,
				baseURL,
				imageSize: "1024x1024",
				editFormat: config.openaiCompatEditFormat ?? "multipart",
				editExtra: config.openaiCompatEditExtra ?? {}
			};
		}
		case "seedream": {
			const seedreamBackground = config.seedreamBackground ?? "opaque";
			return {
				provider: "seedream",
				apiKeyEnv: SEEDREAM_API_KEY_ENV,
				model: config.seedreamModel ?? "doubao-seedream-5-0-260128",
				baseURL: config.seedreamBaseURL ?? "https://ark.cn-beijing.volces.com/api/v3",
				imageSize: "2K",
				arkOptions: {
					outputFormat: seedreamBackground === "transparent" ? "png" : config.seedreamOutputFormat ?? "jpeg",
					watermark: config.seedreamWatermark ?? true,
					background: seedreamBackground
				}
			};
		}
		case "dashscope": return {
			provider: "dashscope",
			apiKeyEnv: DASHSCOPE_API_KEY_ENV,
			model: config.dashscopeModel ?? "qwen-image-3.0",
			endpoint: config.dashscopeEndpoint ?? "https://dashscope.aliyuncs.com/api/v1",
			imageSize: DEFAULT_DASHSCOPE_SIZE,
			allowWanModels: false
		};
		case "qwen-token-plan": return {
			provider: "qwen-token-plan",
			apiKeyEnv: QWEN_TOKEN_PLAN_API_KEY_ENV,
			model: config.qwenTokenPlanModel ?? "qwen-image-2.0",
			endpoint: config.qwenTokenPlanEndpoint ?? "https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1",
			imageSize: DEFAULT_DASHSCOPE_SIZE,
			allowWanModels: true
		};
		case "xai": return {
			provider: "xai",
			apiKeyEnv: XAI_API_KEY_ENV,
			model: config.xaiModel ?? "grok-imagine-image",
			baseURL: config.xaiBaseURL ?? "https://api.x.ai/v1",
			imageSize: "1024x1024"
		};
		case "zhipu": return {
			provider: "zhipu",
			apiKeyEnv: ZHIPU_API_KEY_ENV,
			model: config.zhipuModel ?? "glm-image",
			baseURL: config.zhipuBaseURL ?? "https://open.bigmodel.cn/api/paas/v4",
			imageSize: "1024x1024"
		};
		case "comfyui": {
			const workflows = resolveComfyUIWorkflows(config);
			const workflow = activeComfyUIWorkflow(config);
			return {
				provider: "comfyui",
				baseURL: config.comfyuiBaseURL ?? "http://127.0.0.1:8188",
				workflows,
				...workflow === void 0 ? {} : { workflow },
				timeoutMs: config.comfyuiTimeoutMs ?? 3e5
			};
		}
		case "chatgpt-sub": return {
			provider: "chatgpt-sub",
			model: DEFAULT_SUBSCRIPTION_MODELS["chatgpt-sub"]
		};
		case "grok-sub": return {
			provider: "grok-sub",
			model: DEFAULT_SUBSCRIPTION_MODELS["grok-sub"]
		};
		case "google-sub": return {
			provider: "google-sub",
			model: DEFAULT_SUBSCRIPTION_MODELS["google-sub"]
		};
		case "google": return {
			provider: "google",
			apiKeyEnv: GOOGLE_API_KEY_ENV,
			model: config.googleModel ?? "gemini-3.1-flash-image",
			endpoint: config.googleEndpoint ?? "https://generativelanguage.googleapis.com/v1beta/interactions",
			aspectRatio: "1:1",
			imageSize: "1K"
		};
	}
}
/**
* Apply a per-call provider and/or model override on top of the saved config.
* `model` is ignored for ComfyUI, whose per-call equivalent is `workflow`.
*/
function withProviderOverrides(config, provider, model) {
	const base = provider === void 0 ? { ...config } : {
		...config,
		provider
	};
	if (model === void 0) return base;
	const trimmed = model.trim();
	if (trimmed.length === 0) return base;
	switch (base.provider ?? "google") {
		case "google": return {
			...base,
			googleModel: trimmed
		};
		case "openai": return {
			...base,
			openaiModel: trimmed
		};
		case "openai-compat": return {
			...base,
			openaiCompatModel: trimmed
		};
		case "seedream": return {
			...base,
			seedreamModel: trimmed
		};
		case "dashscope": return {
			...base,
			dashscopeModel: trimmed
		};
		case "qwen-token-plan": return {
			...base,
			qwenTokenPlanModel: trimmed
		};
		case "xai": return {
			...base,
			xaiModel: trimmed
		};
		case "zhipu": return {
			...base,
			zhipuModel: trimmed
		};
		case "chatgpt-sub": return base;
		case "grok-sub": return base;
		case "google-sub": return base;
		case "comfyui": return base;
	}
}
/**
* One-time migration: when the legacy single OpenAI slot points at a relay
* (non-official base URL) and the compat row is empty, move the relay config
* to the compat row so both can coexist. Returns the input untouched when
* nothing needs moving.
*/
function migrateOpenAICompatConfig(config) {
	const legacyBase = config.openaiBaseURL?.trim() ?? "";
	if (legacyBase.length === 0 || legacyBase === "https://api.openai.com/v1") return config;
	if (hostOf(legacyBase) === "api.openai.com") return config;
	if ((config.openaiCompatBaseURL?.trim() ?? "").length > 0) return config;
	const compatModel = config.openaiCompatModel?.trim() ?? "";
	return {
		...config,
		openaiCompatBaseURL: legacyBase,
		...compatModel.length > 0 ? {} : { openaiCompatModel: config.openaiModel },
		openaiBaseURL: DEFAULT_OPENAI_BASE_URL,
		...config.provider === "openai" ? { provider: "openai-compat" } : {}
	};
}
/** Host part of a URL, or null when it cannot be parsed. */
function hostOf(raw) {
	try {
		return new URL(raw).host;
	} catch {
		return null;
	}
}
/** The workflow a ComfyUI call runs: the requested name when given, else the active one. */
function selectComfyUIWorkflow(active, requested) {
	if (active.workflow === void 0) throw new Error("ComfyUI image generation requires an imported workflow; import one in Settings > Plugins > Image generation.");
	if (typeof requested !== "string" || requested.trim().length === 0) return active.workflow;
	const name = requested.trim();
	const workflow = active.workflows.find((candidate) => candidate.name === name);
	if (workflow === void 0) throw new Error(`No ComfyUI workflow named "${name}" is configured. Available workflows: ${active.workflows.map((entry) => entry.name).join(", ")}.`);
	return workflow;
}
//#endregion
//#region lib/types/credentials.js
/** Shared BYOK credential resolution for the Agent tools and the Studio route. */
/**
* Resolve one provider's stored API key to a non-blank value. Blank values
* never count as configured: the host treats an empty stored value as absent,
* and a whitespace-only key is never sent to a provider.
*/
async function resolveApiKey(ctx, provider) {
	const value = (await ctx.credentials.resolve(credentialRef(CLOUD_CREDENTIAL_REFS[provider])))?.value.trim() ?? "";
	return value.length > 0 ? value : void 0;
}
/**
* Resolve one provider's API key or fail with a user-facing message that says
* where to configure it. Passing `tool` selects the Agent-facing English
* wording; without it the message is the browser-facing Chinese one used by
* the Studio route.
*/
async function requireApiKey(ctx, provider, tool) {
	const value = await resolveApiKey(ctx, provider);
	if (value !== void 0) return value;
	throw new Error(tool === void 0 ? `${PROVIDER_DISPLAY_NAMES[provider]} 尚未配置 API Key，请先到 设置 > 插件 > 图像生成 配置` : `${tool} requires the ${PROVIDER_DISPLAY_NAMES[provider]} API key; configure it in Settings > Plugins > Image generation.`);
}
//#endregion
//#region lib/types/comfyui-workflow.js
/** Pure ComfyUI API-workflow validation and placeholder injection. */
const COMFYUI_PROMPT_PLACEHOLDER = "{{prompt}}";
const COMFYUI_SEED_PLACEHOLDER = "{{seed}}";
const COMFYUI_IMAGE_PLACEHOLDER = "{{image}}";
/** Legacy single-percent placeholders from early releases, still accepted. */
const LEGACY_PROMPT_PLACEHOLDER = "%prompt%";
const LEGACY_SEED_PLACEHOLDER = "%seed%";
const LEGACY_IMAGE_PLACEHOLDER = "%image%";
/** LoadImage-style input key that receives the uploaded source image name. */
const IMAGE_INPUT_KEY = "image";
/**
* Parse, clone, and inject one prompt plus an optional randomized seed.
*
* Prompt and seed placeholders are replaced inside any string so existing
* workflows that embed them in longer text keep working. The image
* placeholder is stricter: it only matches a dedicated `inputs.image` field
* whose value is exactly the placeholder, and at most one may exist, because
* the field must carry a single uploaded file name.
*/
function prepareComfyUIWorkflow(workflowJson, prompt, seed = randomSeed(), image) {
	const workflow = parseWorkflow(workflowJson);
	let promptReplacements = 0;
	const inject = (value) => {
		if (typeof value === "string") {
			let replaced = value;
			if (replaced.includes("{{prompt}}") || replaced.includes(LEGACY_PROMPT_PLACEHOLDER)) {
				promptReplacements += 1;
				replaced = replaced.replaceAll(COMFYUI_PROMPT_PLACEHOLDER, prompt).replaceAll(LEGACY_PROMPT_PLACEHOLDER, prompt);
			}
			if (replaced === "{{seed}}" || replaced === LEGACY_SEED_PLACEHOLDER) return seed;
			if (replaced.includes("{{seed}}") || replaced.includes(LEGACY_SEED_PLACEHOLDER)) replaced = replaced.replaceAll(COMFYUI_SEED_PLACEHOLDER, String(seed)).replaceAll(LEGACY_SEED_PLACEHOLDER, String(seed));
			return replaced;
		}
		if (Array.isArray(value)) return value.map(inject);
		if (!isRecord(value)) return value;
		return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, inject(child)]));
	};
	let imageInputs = 0;
	const prepared = Object.fromEntries(Object.entries(workflow).map(([nodeId, value]) => {
		const node = record$6(value);
		const inputs = node === void 0 ? void 0 : record$6(node.inputs);
		if (inputs === void 0) return [nodeId, value];
		const nextInputs = inject(inputs);
		if (isImagePlaceholder(nextInputs[IMAGE_INPUT_KEY])) {
			imageInputs += 1;
			if (image !== void 0) nextInputs[IMAGE_INPUT_KEY] = image;
		}
		return [nodeId, {
			...node,
			inputs: nextInputs
		}];
	}));
	if (promptReplacements === 0) throw new Error(`ComfyUI workflow must contain ${COMFYUI_PROMPT_PLACEHOLDER} in a text input`);
	if (image === void 0) {
		if (imageInputs > 0) throw new Error(`ComfyUI workflow contains an ${COMFYUI_IMAGE_PLACEHOLDER} image input, which requires edit_image with a source image`);
		return prepared;
	}
	if (imageInputs === 0) throw new Error(`ComfyUI workflow must contain exactly one ${COMFYUI_IMAGE_PLACEHOLDER} image input to edit images`);
	if (imageInputs > 1) throw new Error(`ComfyUI workflow must contain exactly one ${COMFYUI_IMAGE_PLACEHOLDER} image input; found ${String(imageInputs)}`);
	return prepared;
}
/** Random seed in the 32-bit range ComfyUI samplers accept. */
function randomSeed() {
	return Math.floor(Math.random() * 4294967296);
}
function parseWorkflow(workflowJson) {
	if (workflowJson.trim().length === 0) throw new Error("Import a ComfyUI API workflow JSON file in Settings before generating");
	if (new TextEncoder().encode(workflowJson).byteLength > 5242880) throw new Error("ComfyUI workflow file must be no larger than 5 MB");
	let value;
	try {
		value = JSON.parse(workflowJson);
	} catch {
		throw new Error("ComfyUI workflow file is not valid JSON");
	}
	if (!isRecord(value) || Object.keys(value).length === 0) throw new Error("ComfyUI workflow must be a non-empty API-format JSON object");
	if (!Object.values(value).some((node) => {
		const inputs = record$6(node)?.inputs;
		return inputs !== void 0 && containsPromptPlaceholder(inputs);
	})) throw new Error(`ComfyUI workflow must contain ${COMFYUI_PROMPT_PLACEHOLDER} (or ${LEGACY_PROMPT_PLACEHOLDER}) in a text input`);
	return value;
}
function isImagePlaceholder(value) {
	return value === "{{image}}" || value === LEGACY_IMAGE_PLACEHOLDER;
}
function containsPromptPlaceholder(value) {
	if (typeof value === "string") return value.includes("{{prompt}}") || value.includes(LEGACY_PROMPT_PLACEHOLDER);
	if (Array.isArray(value)) return value.some(containsPromptPlaceholder);
	return isRecord(value) && Object.values(value).some(containsPromptPlaceholder);
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function record$6(value) {
	return isRecord(value) ? value : void 0;
}
//#endregion
//#region lib/types/redact.js
/**
* Redact secret-shaped content from provider error messages.
*
* Error bodies from providers and relays surface in the conversation and in
* the settings UI. A relay may echo request headers — including the API key —
* inside its error body, so every adapter passes response text through here
* before embedding it in a thrown error, and also passes the live key so its
* exact value cannot survive even in non-standard formats.
*/
const REDACTED = "[REDACTED]";
const KEY_SHAPED_PATTERNS = [
	/\bsk-[A-Za-z0-9_-]{8,}/g,
	/\bAIza[A-Za-z0-9_-]{10,}/g,
	/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
	/\b(?:api[_-]?key|apikey|token|secret)["']?\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{8,}/gi,
	/\b(?:api[_-]?key|apikey|token|secret)\s*["'][A-Za-z0-9._~+/=-]{8,}["']/gi
];
/** Replace every occurrence of a known secret plus key-shaped values. */
function redactSecrets(text, ...secrets) {
	let redacted = text;
	for (const secret of secrets) if (secret !== void 0 && secret.length >= 8) redacted = redacted.split(secret).join(REDACTED);
	for (const pattern of KEY_SHAPED_PATTERNS) redacted = redacted.replace(pattern, REDACTED);
	return redacted;
}
//#endregion
//#region lib/types/comfyui.js
const ERROR_LIMIT$3 = 4096;
const POLL_INTERVAL_MS = 500;
const MAX_HISTORY_BYTES = 16777216;
/** Run one ComfyUI text-to-image workflow and return its first final image. */
async function generateComfyUIImage(input) {
	const seed = randomSeed();
	const workflow = prepareComfyUIWorkflow(input.workflowJson, input.prompt, seed);
	return {
		...await runJob(input, async (baseURL, signal) => {
			return await downloadOutput(baseURL, await waitForOutput(baseURL, await submitWorkflow(baseURL, workflow, signal), signal), input.maxBytes, signal);
		}),
		seed
	};
}
/** Upload one source image, run the workflow, and return its first final image. */
async function editComfyUIImage(input) {
	const seed = randomSeed();
	return {
		...await runJob(input, async (baseURL, signal) => {
			const imageName = await uploadSourceImage(baseURL, input.sourceImage, signal);
			return await downloadOutput(baseURL, await waitForOutput(baseURL, await submitWorkflow(baseURL, prepareComfyUIWorkflow(input.workflowJson, input.prompt, seed, imageName), signal), signal), input.maxBytes, signal);
		}),
		seed
	};
}
/** Share abort forwarding, the single timeout, and error normalization. */
async function runJob(input, run) {
	input.signal.throwIfAborted();
	const baseURL = comfyUIBaseURL(input.baseURL);
	const controller = new AbortController();
	const forwardAbort = () => {
		controller.abort(input.signal.reason);
	};
	input.signal.addEventListener("abort", forwardAbort, { once: true });
	const timeout = setTimeout(() => {
		controller.abort(/* @__PURE__ */ new Error("ComfyUI generation timed out"));
	}, input.timeoutMs);
	try {
		return await run(baseURL, controller.signal);
	} catch (error) {
		input.signal.throwIfAborted();
		if (controller.signal.aborted) throw new Error(`ComfyUI generation timed out after ${String(input.timeoutMs)} ms`);
		if (error instanceof TypeError) throw new Error(`Could not connect to ComfyUI at ${baseURL.origin}`);
		throw error;
	} finally {
		clearTimeout(timeout);
		input.signal.removeEventListener("abort", forwardAbort);
	}
}
/** Upload the source image and return the LoadImage-compatible name ComfyUI stored it under. */
async function uploadSourceImage(baseURL, image, signal) {
	const filename = uploadFilename(image.mediaType);
	const bytes = new Uint8Array(image.data.byteLength);
	bytes.set(image.data);
	const form = new FormData();
	form.append("image", new Blob([bytes], { type: image.mediaType }), filename);
	const response = await fetch(endpoint(baseURL, "upload/image"), {
		method: "POST",
		redirect: "error",
		signal,
		headers: { accept: "application/json" },
		body: form
	});
	const text = await readBoundedText$3(response, ERROR_LIMIT$3);
	if (!response.ok) throw new Error(`ComfyUI image upload failed (${response.status}): ${redactSecrets(text)}`);
	const payload = parseJsonRecord(text, "ComfyUI /upload/image returned invalid JSON");
	if (typeof payload.name !== "string" || payload.name.length === 0) throw new Error(`ComfyUI /upload/image returned no name: ${redactSecrets(text)}`);
	const subfolder = typeof payload.subfolder === "string" ? payload.subfolder : "";
	return subfolder.length > 0 ? `${subfolder}/${payload.name}` : payload.name;
}
/** LoadImage-style inputs need a file name with a decodable extension. */
function uploadFilename(mediaType) {
	const extension = mediaType === "image/png" ? "png" : mediaType === "image/jpeg" ? "jpg" : mediaType === "image/webp" ? "webp" : void 0;
	if (extension === void 0) throw new Error(`ComfyUI edit_image accepts PNG, JPEG, or WebP source images; got ${mediaType}`);
	return `dsh-image-gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
}
async function submitWorkflow(baseURL, workflow, signal) {
	const response = await fetch(endpoint(baseURL, "prompt"), {
		method: "POST",
		redirect: "error",
		signal,
		headers: {
			"content-type": "application/json",
			accept: "application/json"
		},
		body: JSON.stringify({ prompt: workflow })
	});
	const text = await readBoundedText$3(response, ERROR_LIMIT$3);
	if (!response.ok) throw new Error(`ComfyUI rejected the workflow (${response.status}): ${redactSecrets(text)}`);
	const payload = parseJsonRecord(text, "ComfyUI /prompt returned invalid JSON");
	if (typeof payload.prompt_id !== "string" || payload.prompt_id.length === 0) throw new Error(`ComfyUI /prompt returned no prompt_id: ${redactSecrets(text)}`);
	return payload.prompt_id;
}
async function waitForOutput(baseURL, promptId, signal) {
	for (;;) {
		signal.throwIfAborted();
		const response = await fetch(endpoint(baseURL, `history/${encodeURIComponent(promptId)}`), {
			redirect: "error",
			signal,
			headers: { accept: "application/json" }
		});
		const text = await readBoundedText$3(response, MAX_HISTORY_BYTES);
		if (!response.ok) throw new Error(`ComfyUI history request failed (${response.status}): ${redactSecrets(text).slice(0, ERROR_LIMIT$3)}`);
		const entry = record$5(parseJsonRecord(text, "ComfyUI history returned invalid JSON")[promptId]);
		if (entry !== void 0) {
			const status = record$5(entry.status);
			if (status?.status_str === "error") throw new Error(`ComfyUI workflow failed: ${redactSecrets(JSON.stringify(status.messages ?? status)).slice(0, ERROR_LIMIT$3)}`);
			const output = firstOutputImage(entry.outputs);
			if (output !== void 0) return output;
			if (status?.completed === true) throw new Error("ComfyUI workflow completed without an output image");
		}
		await delay(POLL_INTERVAL_MS, signal);
	}
}
function firstOutputImage(value) {
	const outputs = record$5(value);
	if (outputs === void 0) return void 0;
	for (const nodeOutput of Object.values(outputs)) {
		const images = record$5(nodeOutput)?.images;
		if (!Array.isArray(images)) continue;
		for (const image of images) {
			const item = record$5(image);
			if (typeof item?.filename !== "string" || item.filename.length === 0) continue;
			const output = {
				filename: item.filename,
				subfolder: typeof item.subfolder === "string" ? item.subfolder : "",
				type: typeof item.type === "string" ? item.type : "output"
			};
			if (output.type === "output") return output;
		}
	}
}
async function downloadOutput(baseURL, output, maxBytes, signal) {
	const url = endpoint(baseURL, "view");
	url.searchParams.set("filename", output.filename);
	url.searchParams.set("subfolder", output.subfolder);
	url.searchParams.set("type", output.type);
	const response = await fetch(url, {
		redirect: "error",
		signal
	});
	if (!response.ok) throw new Error(`ComfyUI image download failed (${response.status})`);
	const mediaType = imageMediaType$3(response.headers.get("content-type")) ?? imageMediaTypeFromName(output.filename);
	if (mediaType === void 0) throw new Error("ComfyUI image download returned an unsupported content type");
	return {
		data: await readBoundedBytes$2(response, maxBytes),
		mediaType
	};
}
function comfyUIBaseURL(value) {
	let url;
	try {
		url = new URL(value.endsWith("/") ? value : `${value}/`);
	} catch {
		throw new Error("ComfyUI URL must be an absolute http:// or https:// URL");
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("ComfyUI URL must use http:// or https://");
	return url;
}
function endpoint(baseURL, path) {
	return new URL(path, baseURL);
}
function record$5(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function parseJsonRecord(text, message) {
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		throw new Error(message);
	}
	const parsed = record$5(value);
	if (parsed === void 0) throw new Error(message);
	return parsed;
}
function imageMediaType$3(value) {
	const mediaType = value?.split(";", 1)[0]?.trim().toLowerCase();
	return mediaType === "image/png" || mediaType === "image/jpeg" || mediaType === "image/webp" || mediaType === "image/gif" ? mediaType : void 0;
}
function imageMediaTypeFromName(filename) {
	const lower = filename.toLowerCase();
	if (lower.endsWith(".png")) return "image/png";
	if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
	if (lower.endsWith(".webp")) return "image/webp";
	if (lower.endsWith(".gif")) return "image/gif";
}
async function delay(milliseconds, signal) {
	await new Promise((resolve, reject) => {
		const timer = setTimeout(done, milliseconds);
		const abort = () => {
			clearTimeout(timer);
			signal.removeEventListener("abort", abort);
			reject(signal.reason);
		};
		function done() {
			signal.removeEventListener("abort", abort);
			resolve();
		}
		signal.addEventListener("abort", abort, { once: true });
	});
}
async function readBoundedText$3(response, maxBytes) {
	return new TextDecoder().decode(await readBoundedBytes$2(response, maxBytes));
}
async function readBoundedBytes$2(response, maxBytes) {
	if (response.body === null) return /* @__PURE__ */ new Uint8Array();
	const reader = response.body.getReader();
	const chunks = [];
	let bytes = 0;
	try {
		for (;;) {
			const next = await reader.read();
			if (next.done) break;
			bytes += next.value.byteLength;
			if (bytes > maxBytes) throw new Error(`ComfyUI response exceeded the ${String(maxBytes)} byte limit`);
			chunks.push(next.value);
		}
	} finally {
		reader.releaseLock();
	}
	const joined = new Uint8Array(bytes);
	let offset = 0;
	for (const chunk of chunks) {
		joined.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return joined;
}
//#endregion
//#region lib/types/dashscope.js
async function generateDashScopeImage(options) {
	assertImageModel(options.model, options.allowWanModels === true);
	const formattedSize = formatSize(options.size);
	return requestQwenImage({
		...options,
		requestBody: {
			model: options.model,
			input: { messages: [{
				role: "user",
				content: [{ text: options.prompt }]
			}] },
			parameters: { ...formattedSize === void 0 ? {} : { size: formattedSize } }
		},
		operation: "generation"
	});
}
async function editDashScopeImage(options) {
	if (options.sourceImages.length > 3) throw new Error(`DashScope image editing supports at most 3 reference images; this selection resolved ${options.sourceImages.length}. Select fewer images or choose a provider that supports more references. No images were omitted.`);
	assertImageModel(options.model, options.allowWanModels === true);
	const formattedSize = formatSize(options.size);
	return requestQwenImage({
		...options,
		requestBody: {
			model: options.model,
			input: { messages: [{
				role: "user",
				content: [...options.sourceImages.map((sourceImage) => ({ image: toDataUrl$3(sourceImage) })), { text: options.prompt }]
			}] },
			parameters: {
				prompt_extend: true,
				...formattedSize === void 0 ? {} : { size: formattedSize }
			}
		},
		operation: "editing"
	});
}
function assertImageModel(model, allowWanModels) {
	const id = model.toLowerCase();
	if (id.startsWith("qwen-image")) return;
	if (allowWanModels && id.startsWith("wan")) return;
	throw new Error(allowWanModels ? `Unsupported image model ${model} for this endpoint. Use a qwen-image or wan image model such as qwen-image-2.0 or wan2.7-image.` : `Unsupported DashScope image model ${model}. Configure a qwen-image model.`);
}
/**
* Normalize the output size to the form this route accepts. The service rejects
* anything but `WIDTH*HEIGHT` ("Invalid size format: 1024x1024, expected format:
* width*height"), so the common separators are folded to `*` and everything
* else fails loudly here instead of as an opaque 400 — or, worse, as a size the
* caller believes was applied. `auto` is deliberately not passed through: this
* route documents no such value, and omitting `size` is how a caller asks for
* the service's own default.
*/
function formatSize(size) {
	const raw = size?.trim() ?? "";
	if (raw.length === 0) return void 0;
	const normalized = raw.replace(/[x×X*]/g, "*");
	if (!/^\d+\*\d+$/.test(normalized)) throw new Error(`Invalid image size ${JSON.stringify(size)}: use "WIDTH*HEIGHT" such as 1024*1024 or 1280*720.`);
	return normalized;
}
function toDataUrl$3(image) {
	return `data:${image.mediaType};base64,${Buffer.from(image.data).toString("base64")}`;
}
async function requestQwenImage(options) {
	const base = options.endpoint.replace(/\/+$/, "");
	const response = await fetch(`${base}/services/aigc/multimodal-generation/generation`, {
		method: "POST",
		...options.signal ? { signal: options.signal } : {},
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${options.apiKey}`
		},
		body: JSON.stringify(options.requestBody)
	});
	if (!response.ok) {
		const errorText = redactSecrets(await response.text(), options.apiKey);
		throw new Error(`DashScope image ${options.operation} failed (${String(response.status)}): ${errorText}`);
	}
	const payload = await response.json();
	const imageUrl = extractImageUrl(payload);
	if (imageUrl === void 0) throw new Error(`DashScope image ${options.operation} returned no image URL: ${redactSecrets(payload.message ?? JSON.stringify(payload), options.apiKey)}`);
	return downloadImageBlob(imageUrl, options);
}
function extractImageUrl(response) {
	const contents = response.output?.choices?.[0]?.message?.content;
	if (!Array.isArray(contents)) return void 0;
	for (const item of contents) {
		if (item.image !== void 0 && item.image.length > 0) return item.image;
		if (item.image_url !== void 0 && item.image_url.length > 0) return item.image_url;
		if (item.url !== void 0 && item.url.length > 0) return item.url;
	}
}
async function downloadImageBlob(imageUrl, options) {
	const imageResponse = await fetch(imageUrl, { ...options.signal ? { signal: options.signal } : {} });
	if (!imageResponse.ok) throw new Error(`Failed to fetch DashScope image from URL (${String(imageResponse.status)})`);
	const buffer = await imageResponse.arrayBuffer();
	if (buffer.byteLength > options.maxBytes) throw new Error(`DashScope generated image (${String(buffer.byteLength)} bytes) exceeds the ${String(options.maxBytes)} byte limit`);
	const contentType = imageResponse.headers.get("content-type");
	const mediaType = contentType?.includes("png") ? "image/png" : contentType?.includes("webp") ? "image/webp" : "image/jpeg";
	return {
		data: new Uint8Array(buffer),
		mediaType
	};
}
//#endregion
//#region lib/types/google.js
const ERROR_LIMIT$2 = 4096;
const REQUESTED_MEDIA_TYPE = "image/jpeg";
/** Send one native Google text-to-image request. */
function generateGoogleImage(input) {
	return requestGoogleImage({
		...input,
		operation: "generation",
		interactionInput: input.prompt
	});
}
/** Send one native Google image-editing request using already-resolved bytes. */
function editGoogleImage(input) {
	const interactionInput = input.sourceImages.length === 1 ? [{
		type: "image",
		mime_type: input.sourceImages[0].mediaType,
		data: Buffer.from(input.sourceImages[0].data).toString("base64")
	}, {
		type: "text",
		text: input.prompt
	}] : [...input.sourceImages.flatMap((sourceImage, index) => [{
		type: "text",
		text: `图 ${index + 1} (Image ${index + 1}):`
	}, {
		type: "image",
		mime_type: sourceImage.mediaType,
		data: Buffer.from(sourceImage.data).toString("base64")
	}]), {
		type: "text",
		text: input.prompt
	}];
	return requestGoogleImage({
		...input,
		operation: "editing",
		interactionInput
	});
}
/** Shared Google request, response parsing, decoding, and size enforcement. */
async function requestGoogleImage(input) {
	const label = `Google image ${input.operation}`;
	const response = await fetch(input.endpoint, {
		method: "POST",
		redirect: "error",
		signal: input.signal,
		headers: {
			"content-type": "application/json",
			"x-goog-api-key": input.apiKey
		},
		body: JSON.stringify({
			model: input.model,
			input: input.interactionInput,
			response_format: {
				type: "image",
				mime_type: REQUESTED_MEDIA_TYPE,
				aspect_ratio: input.aspectRatio,
				image_size: input.imageSize
			}
		})
	});
	const text = await readBoundedText$2(response, Math.ceil(input.maxBytes * 1.4) + ERROR_LIMIT$2, label);
	if (!response.ok) throw new Error(`${label} failed (${response.status}): ${redactSecrets(text, input.apiKey).slice(0, ERROR_LIMIT$2)}`);
	let payload;
	try {
		payload = JSON.parse(text);
	} catch {
		throw new Error(`${label} returned invalid JSON`);
	}
	const image = outputImage(payload);
	if (image === void 0) throw new Error(`${label} returned no image: ${redactSecrets(text, input.apiKey).slice(0, ERROR_LIMIT$2)}`);
	const mediaType = mediaTypeOf(image.mime_type ?? REQUESTED_MEDIA_TYPE);
	if (mediaType === void 0) throw new Error(`${label} returned unsupported media type ${JSON.stringify(image.mime_type)}`);
	const data = decodeBase64$2(image.data, label);
	if (data.byteLength > input.maxBytes) throw new Error(`${label} exceeded the ${String(input.maxBytes)} byte image limit`);
	return {
		data,
		mediaType
	};
}
function outputImage(value) {
	const interaction = record$4(value);
	if (interaction === void 0) return void 0;
	const direct = imageContent(interaction.output_image, false);
	if (direct !== void 0) return direct;
	if (!Array.isArray(interaction.steps)) return void 0;
	for (const step of interaction.steps) {
		const modelOutput = record$4(step);
		if (modelOutput?.type !== "model_output" || !Array.isArray(modelOutput.content)) continue;
		for (const content of modelOutput.content) {
			const image = imageContent(content, true);
			if (image !== void 0) return image;
		}
	}
}
function imageContent(value, requiresImageType) {
	const image = record$4(value);
	if (image === void 0 || requiresImageType && image.type !== "image" || typeof image.data !== "string") return void 0;
	return {
		data: image.data,
		mime_type: image.mime_type
	};
}
function record$4(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function mediaTypeOf(value) {
	return value === "image/png" || value === "image/jpeg" || value === "image/webp" || value === "image/gif" ? value : void 0;
}
function decodeBase64$2(data, label) {
	const clean = data.replace(/\s+/g, "");
	if (clean.length === 0) throw new Error(`${label} returned invalid base64 image data`);
	const decoded = Buffer.from(clean, "base64");
	if (decoded.length === 0) throw new Error(`${label} returned invalid base64 image data`);
	return new Uint8Array(decoded);
}
async function readBoundedText$2(response, maxBytes, label) {
	if (response.body === null) return "";
	const reader = response.body.getReader();
	const chunks = [];
	let bytes = 0;
	try {
		for (;;) {
			const next = await reader.read();
			if (next.done) break;
			bytes += next.value.byteLength;
			if (bytes > maxBytes) throw new Error(`${label} response exceeded the ${String(maxBytes)} byte limit`);
			chunks.push(next.value);
		}
	} finally {
		reader.releaseLock();
	}
	const joined = new Uint8Array(bytes);
	let offset = 0;
	for (const chunk of chunks) {
		joined.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(joined);
}
//#endregion
//#region lib/types/reference-image.js
/** Latest-DSH compatibility boundary for resolving conversation image references. */
/**
* Resolve one or more edit references while keeping every DSH-specific detail
* behind this compatibility boundary. Explicit selectors preserve caller order;
* without selectors, all images in the newest image-bearing message are used.
*/
async function resolveReferenceImages(input) {
	const sourceAttachmentIds = mergeSelectors({
		single: input.sourceAttachmentId,
		multiple: input.sourceAttachmentIds,
		singleName: "source_attachment_id",
		multipleName: "source_attachment_ids",
		equal: attachmentIdsEqual
	});
	const sourcePaths = mergeSelectors({
		single: input.sourcePath,
		multiple: input.sourcePaths,
		singleName: "source_path",
		multipleName: "source_paths",
		equal: (left, right) => left.trim() === right.trim()
	});
	if (sourceAttachmentIds !== void 0 && sourcePaths !== void 0) throw new Error("edit_image accepts only one of source_attachment_id, source_attachment_ids, source_path, or source_paths");
	if (sourcePaths !== void 0) return Promise.all(sourcePaths.map((sourcePath) => readWorkspaceReferenceImage({
		sourcePath,
		...input.agent?.session.header?.cwd === void 0 ? {} : { workspaceRoot: input.agent.session.header.cwd },
		...input.maxBytes === void 0 ? {} : { maxBytes: input.maxBytes },
		signal: input.signal
	})));
	if (input.agent === void 0) throw new Error("edit_image requires an active DSH agent session to resolve a reference image");
	const refs = findReferenceImages(input.agent.session.deriveMessages(), sourceAttachmentIds);
	if (refs.length === 0) {
		if (sourceAttachmentIds !== void 0) throw new Error(`edit_image could not find image attachment ${sourceAttachmentIds[0]} in the current conversation`);
		throw new Error("edit_image requires an image in the current conversation; upload or generate an image first");
	}
	if (sourceAttachmentIds !== void 0 && refs.length !== sourceAttachmentIds.length) {
		const missing = sourceAttachmentIds.find((id) => !refs.some((ref) => attachmentIdsEqual(String(ref.attachmentId), id)));
		throw new Error(`edit_image could not find image attachment ${missing ?? "unknown"} in the current conversation`);
	}
	return Promise.all(refs.map(async (ref) => {
		const stored = await input.attachments.readImage(ref, input.signal);
		if (input.maxBytes !== void 0 && stored.data.byteLength > input.maxBytes) throw new Error(`edit_image source image is too large (${stored.data.byteLength} bytes; maximum ${input.maxBytes})`);
		return {
			data: stored.data,
			mediaType: stored.ref.mediaType,
			width: stored.ref.width,
			height: stored.ref.height
		};
	}));
}
/** Find images in caller order, or every image in the newest image-bearing message. */
function findReferenceImages(messages, sourceAttachmentIds) {
	if (sourceAttachmentIds !== void 0) return sourceAttachmentIds.flatMap((id) => {
		const ref = findReferenceImage(messages, id);
		return ref === void 0 ? [] : [ref];
	});
	const latestHumanMessage = [...messages].reverse().find((message) => message.source?.kind === "user");
	if (latestHumanMessage !== void 0) {
		const refs = collectInBlocks(latestHumanMessage.content);
		if (refs.length > 0) return refs;
	}
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const refs = collectInBlocks(messages[index]?.content ?? []);
		if (refs.length > 0) return refs;
	}
	return [];
}
/**
* Read an explicitly named workspace image without exposing filesystem or DSH
* details to provider adapters. Both lexical and real-path containment are
* enforced so absolute paths, parent traversal, and symlink escapes fail.
*/
async function readWorkspaceReferenceImage(input) {
	const requested = input.sourcePath.trim();
	if (requested.length === 0) throw new Error("edit_image source_path must not be empty");
	if (input.workspaceRoot === void 0) throw new Error("edit_image source_path requires an active DSH session workspace");
	const root = resolve(input.workspaceRoot);
	const candidate = isAbsolute(requested) ? resolve(requested) : resolve(root, requested);
	if (!containsPath$1(root, candidate)) throw new Error("edit_image source_path must stay inside the session workspace: " + requested);
	let realRoot;
	let realCandidate;
	try {
		[realRoot, realCandidate] = await Promise.all([realpath(root), realpath(candidate)]);
	} catch (error) {
		if (error.code === "ENOENT") throw new Error("edit_image could not find workspace image: " + requested);
		throw error;
	}
	if (!containsPath$1(realRoot, realCandidate)) throw new Error("edit_image source_path resolves outside the session workspace: " + requested);
	const file = await stat(realCandidate);
	if (!file.isFile()) throw new Error("edit_image source_path is not a file: " + requested);
	if (input.maxBytes !== void 0 && file.size > input.maxBytes) throw new Error("edit_image source image is too large (" + file.size + " bytes; maximum " + input.maxBytes + ")");
	const data = await readFile(realCandidate, { signal: input.signal });
	const mediaType = detectImageMediaType(data);
	if (mediaType === void 0) throw new Error("edit_image source_path is not a supported PNG, JPEG, WebP, or GIF image: " + requested);
	return {
		data: new Uint8Array(data),
		mediaType
	};
}
/** Find the newest matching image in the effective, replacement-aware history. */
function findReferenceImage(messages, sourceAttachmentId) {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const found = findInBlocks(messages[index]?.content ?? [], sourceAttachmentId);
		if (found !== void 0) return found;
	}
}
/** Validate an untrusted serialized image reference at an HTTP/UI boundary. */
function parseImageAttachmentRef(value) {
	const ref = record$3(value);
	if (ref === void 0) return void 0;
	if (typeof ref.attachmentId !== "string" || !imageMediaType$2(ref.mediaType)) return void 0;
	if (!nonNegativeInteger(ref.bytes) || !positiveInteger(ref.width) || !positiveInteger(ref.height)) return void 0;
	if (ref.name !== void 0 && typeof ref.name !== "string") return void 0;
	const originalDimensions = ref.originalDimensions === void 0 ? void 0 : parseDimensions(ref.originalDimensions);
	if (ref.originalDimensions !== void 0 && originalDimensions === void 0) return void 0;
	return {
		attachmentId: ref.attachmentId,
		mediaType: ref.mediaType,
		bytes: ref.bytes,
		width: ref.width,
		height: ref.height,
		...typeof ref.name === "string" ? { name: ref.name } : {},
		...originalDimensions === void 0 ? {} : { originalDimensions }
	};
}
function findInBlocks(blocks, sourceAttachmentId) {
	for (let index = blocks.length - 1; index >= 0; index -= 1) {
		const block = blocks[index];
		if (block === void 0) continue;
		if (block.type === "image") {
			if (sourceAttachmentId === void 0 || attachmentIdsEqual(String(block.attachment.attachmentId), sourceAttachmentId)) return block.attachment;
			continue;
		}
	}
}
function parseDimensions(value) {
	const dimensions = record$3(value);
	if (dimensions === void 0 || !positiveInteger(dimensions.width) || !positiveInteger(dimensions.height)) return void 0;
	return {
		width: dimensions.width,
		height: dimensions.height
	};
}
function imageMediaType$2(value) {
	return value === "image/png" || value === "image/jpeg" || value === "image/webp" || value === "image/gif";
}
function collectInBlocks(blocks) {
	const refs = [];
	for (const block of blocks) if (block.type === "image") refs.push(block.attachment);
	return refs;
}
function attachmentIdsEqual(actual, requested) {
	if (actual === requested) return true;
	const actualDigest = sha256Digest(actual);
	const requestedDigest = sha256Digest(requested);
	return actualDigest !== void 0 && actualDigest === requestedDigest;
}
function sha256Digest(value) {
	return /^(?:sha256:)?([0-9a-f]{64})$/i.exec(value.trim())?.[1]?.toLowerCase();
}
function mergeSelectors(input) {
	if (input.multiple === void 0) return input.single === void 0 ? void 0 : [input.single];
	if (input.multiple.length === 0) {
		if (input.single !== void 0) return [input.single];
		throw new Error(`edit_image ${input.multipleName} must not be empty`);
	}
	const single = input.single;
	if (single !== void 0 && !input.multiple.some((value) => input.equal(single, value))) throw new Error(`edit_image ${input.singleName} must also appear in ${input.multipleName} when both are provided`);
	return input.multiple;
}
function detectImageMediaType(data) {
	if (startsWith(data, [
		137,
		80,
		78,
		71,
		13,
		10,
		26,
		10
	])) return "image/png";
	if (startsWith(data, [
		255,
		216,
		255
	])) return "image/jpeg";
	if (ascii(data, 0, 6) === "GIF87a" || ascii(data, 0, 6) === "GIF89a") return "image/gif";
	if (ascii(data, 0, 4) === "RIFF" && ascii(data, 8, 4) === "WEBP") return "image/webp";
}
function startsWith(data, signature) {
	return signature.every((byte, index) => data[index] === byte);
}
function ascii(data, offset, length) {
	return String.fromCharCode(...data.subarray(offset, offset + length));
}
function containsPath$1(parent, child) {
	const rel = relative(parent, child);
	return rel === "" || rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel);
}
function positiveInteger(value) {
	return typeof value === "number" && Number.isInteger(value) && value > 0;
}
function nonNegativeInteger(value) {
	return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
function record$3(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
//#endregion
//#region lib/types/workspace-save.js
/** Persist one generated image as a file under the session workspace. */
/** File extension for each supported image media type. */
const EXTENSION = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
	"image/gif": "gif"
};
/**
* Build the deterministic file name for a generated image:
* `image-<digest-prefix>.<ext>`. The digest prefix comes from the
* content-addressed attachment id, so the same image bytes always map to the
* same file name regardless of when they were generated, and re-saving simply
* overwrites the previous copy in place.
* @param attachmentId - durable attachment id (`sha256:<hex>`).
* @param mediaType - verified image media type.
* @returns the file name (no directory).
*/
function workspaceImageName(attachmentId, mediaType) {
	return `image-${(attachmentId.startsWith("sha256:") ? attachmentId.slice(7) : attachmentId).slice(0, 8).padEnd(8, "0")}.${EXTENSION[mediaType]}`;
}
/**
* Resolve the configured image folder inside the session workspace. The
* folder may nest, but must stay inside the workspace: absolute paths and
* parent-traversal segments are rejected for both separator styles.
*
* This lexical pass is necessary but not sufficient: `saveImageToWorkspace`
* additionally verifies the on-disk resolution so symlinked folders cannot
* escape the workspace.
* @param workspaceRoot - the session workspace directory.
* @param folder - configured subfolder; empty/blank means the workspace root.
* @returns the absolute image directory.
* @throws when the folder would escape the workspace root.
*/
function workspaceImageDir(workspaceRoot, folder) {
	const trimmed = (folder ?? "").trim();
	const root = resolve(workspaceRoot);
	const dir = trimmed === "" ? root : resolve(root, trimmed);
	if (!containsPath(root, dir)) throw new Error(`image workspace folder '${folder}' must stay inside the session workspace`);
	return dir;
}
/** True when `child` equals `parent` or lives underneath it (lexically). */
function containsPath(parent, child) {
	const rel = relative(parent, child);
	return rel === "" || rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
/**
* Real path of the closest existing ancestor of `dir` (inclusive). Walking up
* lets us validate symlinked folder segments before creating anything under
* them.
*/
async function nearestExistingRealPath(dir) {
	let probe = dir;
	for (;;) try {
		return await realpath(probe);
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
		const parent = dirname(probe);
		if (parent === probe) throw error;
		probe = parent;
	}
}
/** Reject a directory whose on-disk resolution lands outside the workspace. */
function assertInsideWorkspace(realRoot, candidate, folder) {
	if (containsPath(realRoot, candidate)) return;
	throw new Error(`image workspace folder '${folder ?? ""}' must stay inside the session workspace (${candidate} resolves outside ${realRoot})`);
}
/**
* Write one generated image durably under the session workspace.
*
* Containment is enforced twice: lexically by `workspaceImageDir`, then
* against real paths, so a configured folder (or any intermediate segment)
* that is a symlink pointing outside the workspace is rejected before and
* after anything is created.
*
* The bytes are written to a same-directory staging file and renamed onto the
* target, so a crash never leaves a half-written image under its final name.
* Re-saving identical bytes rewrites the same file (the name is content-
* addressed), which keeps repeated generations idempotent. A cancellation is
* honoured up to and including the final rename: an aborted save never
* resolves successfully and never leaves the image behind under its final
* name.
* @param options - workspace root, configured folder, attachment identity, and image bytes.
* @returns the absolute path of the written file.
*/
async function saveImageToWorkspace(options) {
	const dir = workspaceImageDir(options.workspaceRoot, options.folder);
	options.signal?.throwIfAborted();
	const realRoot = await realpath(resolve(options.workspaceRoot));
	assertInsideWorkspace(realRoot, await nearestExistingRealPath(dir), options.folder);
	const name = workspaceImageName(options.attachmentId, options.mediaType);
	const target = join(dir, name);
	const staging = join(dir, `.${name}.${process.pid}-${randomUUID()}.tmp`);
	await mkdir(dir, { recursive: true });
	assertInsideWorkspace(realRoot, await realpath(dir), options.folder);
	try {
		await writeFile(staging, options.data, {
			flag: "wx",
			signal: options.signal
		});
		options.signal?.throwIfAborted();
		await rename(staging, target);
	} catch (error) {
		await unlink(staging).catch(() => {});
		throw error;
	}
	try {
		options.signal?.throwIfAborted();
	} catch (error) {
		await unlink(target).catch(() => {});
		throw error;
	}
	return target;
}
//#endregion
//#region lib/types/image-route.js
/** Validate the persisted reference carried by a tool presentation. */
function imageAttachmentFromMeta(meta) {
	const value = record$2(meta);
	if (value?.kind !== "dsh-image-gen") return void 0;
	return parseImageAttachmentRef(value.attachment);
}
function record$2(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
//#endregion
//#region lib/types/openai-compatible.js
const ERROR_LIMIT$1 = 4096;
async function generateOpenAICompatibleImage(input) {
	return parseImageResponse(await fetch(imageEndpoint$1(input.baseURL, "generations"), {
		method: "POST",
		redirect: "error",
		signal: input.signal,
		headers: {
			authorization: `Bearer ${input.apiKey}`,
			"content-type": "application/json"
		},
		body: JSON.stringify({
			model: input.model,
			prompt: input.prompt,
			size: input.size,
			...input.provider === "seedream" ? {
				response_format: "url",
				...arkOutputBody(input.arkOptions, { background: false })
			} : {}
		})
	}), input.provider, input);
}
async function editOpenAICompatibleImage(input) {
	if (input.editFormat === "jsonImageUrlArray") {
		const body = {
			model: input.model,
			images: input.sourceImages.map((sourceImage) => ({ image_url: toDataUrl$2(sourceImage) })),
			prompt: input.prompt,
			n: 1,
			size: "auto",
			response_format: "url",
			...input.editExtra ?? {}
		};
		return parseImageResponse(await fetch(imageEndpoint$1(input.baseURL, "edits"), {
			method: "POST",
			redirect: "error",
			signal: input.signal,
			headers: {
				authorization: `Bearer ${input.apiKey}`,
				"content-type": "application/json"
			},
			body: JSON.stringify(body)
		}), "openai", input);
	}
	const form = new FormData();
	const imageField = input.sourceImages.length > 1 ? "image[]" : "image";
	input.sourceImages.forEach((sourceImage, index) => {
		const uploadBytes = new Uint8Array(sourceImage.data);
		const blob = new Blob([uploadBytes], { type: sourceImage.mediaType });
		const filename = `reference-${index + 1}.${extensionOf(sourceImage.mediaType)}`;
		form.append(imageField, blob, filename);
	});
	form.append("prompt", input.prompt);
	form.append("model", input.model);
	if (input.size !== void 0 && input.size.length > 0) form.append("size", input.size);
	return parseImageResponse(await fetch(imageEndpoint$1(input.baseURL, "edits"), {
		method: "POST",
		redirect: "error",
		signal: input.signal,
		headers: { authorization: `Bearer ${input.apiKey}` },
		body: form
	}), "openai", input);
}
async function parseImageResponse(response, provider, input) {
	const text = await readBoundedText$1(response, Math.ceil(input.maxBytes * 1.4) + ERROR_LIMIT$1);
	if (!response.ok) throw new Error(`${provider} image request failed (${response.status}): ${redactSecrets(text, input.apiKey).slice(0, ERROR_LIMIT$1)}`);
	let payload;
	try {
		payload = JSON.parse(text);
	} catch {
		throw new Error(`${provider} image request returned invalid JSON`);
	}
	const image = firstImage$1(payload);
	if (image === void 0) throw new Error(`${provider} image request returned no image: ${redactSecrets(text, input.apiKey).slice(0, ERROR_LIMIT$1)}`);
	if (image.b64_json !== void 0) return {
		data: decodeBase64$1(image.b64_json, provider),
		mediaType: imageMediaType$1(image.mime_type) ?? "image/png"
	};
	return downloadImage$1(image.url, provider, input);
}
function imageEndpoint$1(baseURL, operation) {
	try {
		return new URL(`images/${operation}`, baseURL.endsWith("/") ? baseURL : `${baseURL}/`).toString();
	} catch {
		throw new Error("Image endpoint must be an absolute URL");
	}
}
function toDataUrl$2(image) {
	return `data:${image.mediaType};base64,${Buffer.from(image.data).toString("base64")}`;
}
function firstImage$1(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	const record = value;
	const data = Array.isArray(record.data) ? record.data : Array.isArray(record.images) ? record.images : Array.isArray(record.output) ? record.output : void 0;
	if (data === void 0 || data.length === 0) return void 0;
	const candidate = data[0];
	if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) return void 0;
	const item = candidate;
	const mime = typeof item.mime_type === "string" ? item.mime_type : typeof item.mime === "string" ? item.mime : void 0;
	return typeof item.b64_json === "string" && item.b64_json.length > 0 ? {
		b64_json: item.b64_json,
		...mime === void 0 ? {} : { mime_type: mime }
	} : typeof item.url === "string" && item.url.length > 0 ? {
		url: item.url,
		...mime === void 0 ? {} : { mime_type: mime }
	} : void 0;
}
async function downloadImage$1(url, provider, input) {
	if (url === void 0) throw new Error(`${provider} image request returned no image data`);
	if (url.startsWith("data:")) {
		const parsed = parseDataUrl(url);
		if (parsed === void 0) throw new Error(`${provider} image request returned invalid data URL`);
		return {
			data: decodeBase64$1(parsed.base64, provider),
			mediaType: imageMediaType$1(parsed.mediaType) ?? "image/png"
		};
	}
	let response = await fetch(url, {
		redirect: "follow",
		signal: input.signal,
		...input.apiKey === void 0 ? {} : { headers: { authorization: `Bearer ${input.apiKey}` } }
	});
	if (!response.ok && input.apiKey !== void 0) response = await fetch(url, {
		redirect: "follow",
		signal: input.signal
	});
	if (!response.ok) throw new Error(`${provider} image download failed (${response.status})`);
	const data = await readBoundedBytes$1(response, input.maxBytes);
	const mediaType = detectImageMediaType(data) ?? imageMediaType$1(response.headers.get("content-type"));
	if (mediaType === void 0) throw new Error(`${provider} image download returned unsupported content type`);
	return {
		data,
		mediaType
	};
}
function parseDataUrl(value) {
	const match = /^data:([^;,]+);base64,(.*)$/s.exec(value.trim());
	return match?.[1] !== void 0 && match[2] !== void 0 ? {
		mediaType: match[1],
		base64: match[2]
	} : void 0;
}
function extensionOf(mediaType) {
	switch (mediaType) {
		case "image/jpeg": return "jpg";
		case "image/webp": return "webp";
		case "image/gif": return "gif";
		case "image/png": return "png";
	}
}
function decodeBase64$1(value, provider) {
	const clean = (parseDataUrl(value)?.base64 ?? value).replace(/\s+/g, "");
	if (clean.length === 0) throw new Error(`${provider} image request returned invalid base64 image data`);
	const decoded = Buffer.from(clean, "base64");
	if (decoded.length === 0) throw new Error(`${provider} image request returned invalid base64 image data`);
	return new Uint8Array(decoded);
}
function imageMediaType$1(value) {
	const mediaType = value?.split(";", 1)[0]?.trim().toLowerCase();
	return mediaType === "image/png" || mediaType === "image/jpeg" || mediaType === "image/webp" || mediaType === "image/gif" ? mediaType : void 0;
}
async function readBoundedText$1(response, maxBytes) {
	return new TextDecoder().decode(await readBoundedBytes$1(response, maxBytes));
}
async function readBoundedBytes$1(response, maxBytes) {
	if (response.body === null) return /* @__PURE__ */ new Uint8Array();
	const reader = response.body.getReader();
	const chunks = [];
	let bytes = 0;
	try {
		for (;;) {
			const next = await reader.read();
			if (next.done) break;
			bytes += next.value.byteLength;
			if (bytes > maxBytes) throw new Error(`Image response exceeded the ${String(maxBytes)} byte limit`);
			chunks.push(next.value);
		}
	} finally {
		reader.releaseLock();
	}
	const joined = new Uint8Array(bytes);
	let offset = 0;
	for (const chunk of chunks) {
		joined.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return joined;
}
//#endregion
//#region lib/types/seedream.js
const ERROR_LIMIT = 4096;
/** Edit one image through Ark ImageGenerations using a data-URL reference. */
async function editSeedreamImage(input) {
	const response = await fetch(imageEndpoint(input.baseURL), {
		method: "POST",
		redirect: "error",
		signal: input.signal,
		headers: {
			authorization: `Bearer ${input.apiKey}`,
			"content-type": "application/json"
		},
		body: JSON.stringify({
			model: input.model,
			prompt: input.prompt,
			image: input.sourceImages.map(toDataUrl$1),
			...input.size === void 0 || input.size.length === 0 ? {} : { size: input.size },
			...arkOutputBody(input.arkOptions),
			response_format: "b64_json"
		})
	});
	const text = await readBoundedText(response, Math.ceil(input.maxBytes * 1.4) + ERROR_LIMIT);
	if (!response.ok) throw new Error(`seedream image editing failed (${response.status}): ${redactSecrets(text, input.apiKey).slice(0, ERROR_LIMIT)}`);
	let payload;
	try {
		payload = JSON.parse(text);
	} catch {
		throw new Error("seedream image editing returned invalid JSON");
	}
	const image = firstImage(payload);
	if (image === void 0) throw new Error(`seedream image editing returned no image: ${redactSecrets(text, input.apiKey).slice(0, ERROR_LIMIT)}`);
	if (image.b64_json !== void 0) return {
		data: decodeBase64(image.b64_json),
		mediaType: imageMediaType(image.mime_type) ?? "image/png"
	};
	return downloadImage(image.url, input);
}
function imageEndpoint(baseURL) {
	try {
		return new URL("images/generations", baseURL.endsWith("/") ? baseURL : `${baseURL}/`).toString();
	} catch {
		throw new Error("Seedream image endpoint must be an absolute URL");
	}
}
function toDataUrl$1(image) {
	return `data:${image.mediaType};base64,${Buffer.from(image.data).toString("base64")}`;
}
function firstImage(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	const record = value;
	const data = Array.isArray(record.data) ? record.data : Array.isArray(record.images) ? record.images : Array.isArray(record.output) ? record.output : void 0;
	if (data === void 0 || data.length === 0) return void 0;
	const candidate = data[0];
	if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) return void 0;
	const item = candidate;
	const mime = typeof item.mime_type === "string" ? item.mime_type : typeof item.mime === "string" ? item.mime : void 0;
	return typeof item.b64_json === "string" && item.b64_json.length > 0 ? {
		b64_json: item.b64_json,
		...mime === void 0 ? {} : { mime_type: mime }
	} : typeof item.url === "string" && item.url.length > 0 ? {
		url: item.url,
		...mime === void 0 ? {} : { mime_type: mime }
	} : void 0;
}
async function downloadImage(url, input) {
	if (url === void 0) throw new Error("seedream image editing returned no image data");
	const response = await fetch(url, {
		redirect: "follow",
		signal: input.signal
	});
	if (!response.ok) throw new Error(`seedream image download failed (${response.status})`);
	const mediaType = imageMediaType(response.headers.get("content-type"));
	if (mediaType === void 0) throw new Error("seedream image download returned unsupported content type");
	return {
		data: await readBoundedBytes(response, input.maxBytes),
		mediaType
	};
}
function decodeBase64(value) {
	const clean = value.replace(/\s+/g, "");
	if (clean.length === 0) throw new Error("seedream image editing returned invalid base64 image data");
	const decoded = Buffer.from(clean, "base64");
	if (decoded.length === 0) throw new Error("seedream image editing returned invalid base64 image data");
	return new Uint8Array(decoded);
}
function imageMediaType(value) {
	const mediaType = value?.split(";", 1)[0]?.trim().toLowerCase();
	return mediaType === "image/png" || mediaType === "image/jpeg" || mediaType === "image/webp" || mediaType === "image/gif" ? mediaType : void 0;
}
async function readBoundedText(response, maxBytes) {
	return new TextDecoder().decode(await readBoundedBytes(response, maxBytes));
}
async function readBoundedBytes(response, maxBytes) {
	if (response.body === null) return /* @__PURE__ */ new Uint8Array();
	const reader = response.body.getReader();
	const chunks = [];
	let bytes = 0;
	try {
		for (;;) {
			const next = await reader.read();
			if (next.done) break;
			bytes += next.value.byteLength;
			if (bytes > maxBytes) throw new Error(`Image response exceeded the ${String(maxBytes)} byte limit`);
			chunks.push(next.value);
		}
	} finally {
		reader.releaseLock();
	}
	const joined = new Uint8Array(bytes);
	let offset = 0;
	for (const chunk of chunks) {
		joined.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return joined;
}
//#endregion
//#region lib/types/subscription/oauth.js
/**
* OAuth primitives shared by the subscription vendors.
*
* Adapted from @goodandready/dsh-subscriptions (MIT, (c) 2026 GooDAnDReaDY)
* lib/oauth.js, lib/pkce.js, lib/jwt.js — PKCE generation, authorize-URL
* building and the JWT payload reads the vendors need for identity headers.
*/
async function createPkce() {
	const verifier = Buffer.from(randomBytes(32)).toString("base64url");
	return {
		verifier,
		challenge: Buffer.from(createHash("sha256").update(verifier).digest()).toString("base64url"),
		state: Buffer.from(randomBytes(16)).toString("base64url")
	};
}
/** Build an authorization-code URL with PKCE and optional extra params. */
function buildAuthorizeUrl(input) {
	const url = new URL(input.authUrl);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("client_id", input.clientId);
	url.searchParams.set("redirect_uri", input.redirectUri);
	url.searchParams.set("code_challenge", input.challenge);
	url.searchParams.set("code_challenge_method", "S256");
	url.searchParams.set("state", input.state);
	if (input.scope !== void 0 && input.scope.length > 0) url.searchParams.set("scope", input.scope);
	if (input.extra !== void 0) for (const [key, value] of Object.entries(input.extra)) {
		if (value === null || value === void 0 || value === "") continue;
		url.searchParams.set(key, String(value));
	}
	return url.toString();
}
/** Decode a JWT payload without signature verification (identity read only). */
function decodeJwtPayload(token) {
	const parts = String(token ?? "").split(".");
	if (parts.length < 2) return void 0;
	try {
		const json = Buffer.from(parts[1], "base64url").toString("utf8");
		const parsed = JSON.parse(json);
		return typeof parsed === "object" && parsed !== null ? parsed : void 0;
	} catch {
		return;
	}
}
/** The chatgpt-account-id a Codex API call must carry. */
function chatgptAccountId(token) {
	const payload = decodeJwtPayload(token);
	if (payload === void 0) return "";
	if (typeof payload.chatgpt_account_id === "string") return payload.chatgpt_account_id;
	const nested = payload["https://api.openai.com/auth"];
	if (typeof nested === "object" && nested !== null && typeof nested.chatgpt_account_id === "string") return nested.chatgpt_account_id;
	const orgs = payload.organizations;
	if (Array.isArray(orgs) && orgs[0] !== null && typeof orgs[0] === "object" && typeof orgs[0].id === "string") return orgs[0].id;
	return "";
}
/** The account email for badges and login confirmation. */
function emailFromToken(token) {
	const payload = decodeJwtPayload(token);
	if (payload === void 0) return "";
	const email = payload.email;
	const preferred = payload.preferred_username;
	if (typeof email === "string" && email.length > 0) return email;
	if (typeof preferred === "string") return preferred;
	return "";
}
/** POST an OAuth token endpoint with form encoding; 25s cap like the source. */
async function formTokenRequest(url, params, fetchImpl) {
	const response = await fetchImpl(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json"
		},
		body: new URLSearchParams(params).toString(),
		signal: AbortSignal.timeout(25e3)
	});
	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(`token endpoint HTTP ${String(response.status)}${text.length > 0 ? `: ${text.slice(0, 200)}` : ""}`);
	}
	try {
		const parsed = await response.json();
		return typeof parsed === "object" && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
}
//#endregion
//#region lib/types/subscription/loopback.js
/**
* Temporary loopback server that catches the OAuth redirect on a vendor-fixed
* local port and hands the code to a handler.
*
* Adapted from @goodandready/dsh-subscriptions (MIT, (c) 2026 GooDAnDReaDY)
* lib/loopback.js — same protocol (first matching request wins, server shuts
* down, 10-minute cap), restated in TypeScript with this bundle's style.
*/
const OK_HTML = "<!doctype html><meta charset=\"utf-8\"><title>dsh-image-gen</title><p>登录成功，可以关闭此页返回设置。</p>";
const ERR_HTML = "<!doctype html><meta charset=\"utf-8\"><title>dsh-image-gen</title><p>登录失败，请返回设置重试。</p>";
/**
* Listen on the redirect_uri's port and resolve when the provider calls back.
* Rejects on port conflicts, network errors, or when nothing arrives in time.
*/
function startLoopback(options) {
	const parsed = new URL(options.redirectUri);
	if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") return Promise.reject(/* @__PURE__ */ new Error(`loopback redirect requires localhost, got ${parsed.hostname}`));
	const port = Number(parsed.port) || 80;
	const path = parsed.pathname;
	const timeoutMs = options.timeoutMs ?? 6e5;
	const state = { done: false };
	return new Promise((resolve, reject) => {
		const server = http.createServer((req, res) => {
			const url = new URL(req.url ?? "/", `http://127.0.0.1:${String(port)}`);
			if (!url.pathname.startsWith(path)) {
				res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
				res.end(ERR_HTML);
				return;
			}
			if (state.done) return;
			state.done = true;
			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
			Promise.resolve(options.onCode(url.searchParams)).then((html) => {
				res.end(html.length > 0 ? html : OK_HTML);
			}).catch(() => {
				res.end(ERR_HTML);
			}).finally(() => {
				clearTimeout(timer);
				server.close();
				resolve({ ok: true });
			});
		});
		server.on("error", (error) => {
			if (state.done) return;
			state.done = true;
			clearTimeout(timer);
			reject(error);
		});
		const timer = setTimeout(() => {
			if (state.done) return;
			state.done = true;
			server.close();
			reject(/* @__PURE__ */ new Error("loopback timeout: no callback received"));
		}, timeoutMs);
		server.listen(port, parsed.hostname);
	});
}
//#endregion
//#region lib/types/subscription/blob.js
/**
* OAuth token blob persistence for subscription accounts.
*
* Adapted from @goodandready/dsh-subscriptions (MIT, (c) 2026 GooDAnDReaDY)
* lib/blob.js — trimmed to the two image vendors this plugin ships. The blob
* is stored through the DSH Credentials service under a provider-scoped ref
* (see refs.ts); it never reaches the browser side.
*/
function asString(value) {
	return value === null || value === void 0 ? "" : String(value);
}
/** Serialize a blob for storage; at least one token must be present. */
function serializeBlob(obj) {
	const accessToken = asString(obj.accessToken);
	const refreshToken = asString(obj.refreshToken);
	if (accessToken.length === 0 && refreshToken.length === 0) throw new Error("oauth blob needs accessToken or refreshToken");
	return JSON.stringify({
		accessToken,
		refreshToken,
		expiresAt: Number(obj.expiresAt) || 0,
		label: asString(obj.label),
		email: asString(obj.email),
		accountId: asString(obj.accountId)
	});
}
/** Parse a stored blob back; invalid input throws. */
function parseBlob(text) {
	const obj = typeof text === "string" ? JSON.parse(text) : text;
	if (typeof obj !== "object" || obj === null) throw new Error("invalid oauth blob");
	const row = obj;
	return {
		accessToken: asString(row.accessToken),
		refreshToken: asString(row.refreshToken),
		expiresAt: Number(row.expiresAt) || 0,
		label: asString(row.label),
		email: asString(row.email),
		accountId: asString(row.accountId)
	};
}
//#endregion
//#region lib/types/subscription/vendors/codex.js
/**
* ChatGPT (Codex) subscription image vendor.
*
* Adapted from @goodandready/dsh-subscriptions (MIT, (c) 2026 GooDAnDReaDY)
* lib/vendors/codex.js and lib/images.js — only the pieces the image channel
* needs: authorize URL, code exchange, refresh, and the generations call.
* The device-code flow and chat streaming stay out of this bundle.
*/
const CODEX_AUTH = "https://auth.openai.com/oauth/authorize";
const CODEX_TOKEN = "https://auth.openai.com/oauth/token";
const CODEX_SCOPE = "openid profile email offline_access api.connectors.read api.connectors.invoke";
/** Where the ChatGPT subscription image request goes. */
const CODEX_IMAGE_URL = "https://chatgpt.com/backend-api/codex/images/generations";
/** Where the ChatGPT subscription image edit request goes. */
const CODEX_IMAGE_EDIT_URL = "https://chatgpt.com/backend-api/codex/images/edits";
/** The model served by this endpoint (probed live: gpt-image-2.5-flare works
* on the ChatGPT internal generations route as of 2026-09-14). */
const CODEX_IMAGE_MODEL = "gpt-image-2.5-flare";
/** Public client id of the Codex CLI; vendor-fixed redirect on port 1455. */
const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const CODEX_REDIRECT_URI = "http://localhost:1455/auth/callback";
function codexConfig() {
	return {
		clientId: CODEX_CLIENT_ID,
		redirectUri: CODEX_REDIRECT_URI
	};
}
function codexAuthorizeUrl(cfg, pkce) {
	return buildAuthorizeUrl({
		authUrl: CODEX_AUTH,
		clientId: cfg.clientId,
		redirectUri: cfg.redirectUri,
		challenge: pkce.challenge,
		state: pkce.state,
		scope: CODEX_SCOPE,
		extra: {
			id_token_add_organizations: "true",
			codex_cli_simplified_flow: "true",
			originator: "codex_cli_rs"
		}
	});
}
/** Identity fields every Codex API call must carry. */
function codexIdentityHeaders(blob) {
	return {
		authorization: `Bearer ${blob.accessToken}`,
		"chatgpt-account-id": blob.accountId,
		originator: "codex_cli_rs",
		"content-type": "application/json",
		accept: "application/json"
	};
}
function decorate(blob, json) {
	const idToken = typeof json.id_token === "string" ? json.id_token : "";
	return {
		...blob,
		accountId: blob.accountId.length > 0 ? blob.accountId : chatgptAccountId(idToken) || chatgptAccountId(blob.accessToken),
		email: blob.email.length > 0 ? blob.email : emailFromToken(idToken) || emailFromToken(blob.accessToken),
		label: blob.label.length > 0 ? blob.label : emailFromToken(idToken) || emailFromToken(blob.accessToken) || "ChatGPT"
	};
}
function tokenBlobFromOAuth$2(json) {
	const access = json.access_token;
	const refresh = json.refresh_token;
	return {
		accessToken: typeof access === "string" ? access : "",
		refreshToken: typeof refresh === "string" ? refresh : "",
		expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1e3,
		label: "",
		email: "",
		accountId: ""
	};
}
async function codexExchangeCode(cfg, pkce, code) {
	const json = await formTokenRequest(CODEX_TOKEN, {
		grant_type: "authorization_code",
		client_id: cfg.clientId,
		code,
		redirect_uri: cfg.redirectUri,
		code_verifier: pkce.verifier
	}, fetch);
	return decorate(tokenBlobFromOAuth$2(json), json);
}
async function codexRefresh(blob) {
	const next = tokenBlobFromOAuth$2(await formTokenRequest(CODEX_TOKEN, {
		grant_type: "refresh_token",
		client_id: CODEX_CLIENT_ID,
		refresh_token: blob.refreshToken
	}, fetch));
	return {
		...next,
		refreshToken: next.refreshToken.length > 0 ? next.refreshToken : blob.refreshToken,
		label: blob.label,
		email: blob.email,
		accountId: blob.accountId.length > 0 ? blob.accountId : next.accountId
	};
}
//#endregion
//#region lib/types/subscription/vendors/grok.js
/**
* Grok subscription image vendor.
*
* Adapted from @goodandready/dsh-subscriptions (MIT, (c) 2026 GooDAnDReaDY)
* lib/vendors/grok.js and lib/images.js — only the pieces the image channel
* needs: authorize URL, code exchange, refresh, and the generations call
* (grok-cli token, not an xAI API key).
*/
const GROK_AUTH = "https://auth.x.ai/oauth2/authorize";
const GROK_TOKEN = "https://auth.x.ai/oauth2/token";
const GROK_SCOPE = "openid profile email offline_access grok-cli:access api:access conversations:read conversations:write";
/** Where the Grok subscription image request goes. */
const GROK_IMAGE_URL = "https://api.x.ai/v1/images/generations";
/** Where the Grok subscription image edit request goes. */
const GROK_IMAGE_EDIT_URL = "https://api.x.ai/v1/images/edits";
/** The model served by this endpoint. */
const GROK_IMAGE_MODEL = "grok-imagine-image-2.0";
/** Public client id of the grok-cli; vendor-fixed redirect on 127.0.0.1:56121. */
const GROK_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const GROK_REDIRECT_URI = "http://127.0.0.1:56121/callback";
function grokConfig() {
	return {
		clientId: GROK_CLIENT_ID,
		redirectUri: GROK_REDIRECT_URI
	};
}
function grokAuthorizeUrl(cfg, pkce) {
	return buildAuthorizeUrl({
		authUrl: GROK_AUTH,
		clientId: cfg.clientId,
		redirectUri: cfg.redirectUri,
		challenge: pkce.challenge,
		state: pkce.state,
		scope: GROK_SCOPE
	});
}
/** Identity fields every grok.com call must carry (the API host ignores them). */
function grokIdentityHeaders(blob) {
	return {
		authorization: `Bearer ${blob.accessToken}`,
		"X-XAI-Token-Auth": "xai-grok-cli",
		"x-grok-client-identifier": "grok-shell",
		"x-grok-client-version": "0.2.103",
		"User-Agent": "xai-grok-cli",
		"content-type": "application/json",
		accept: "application/json"
	};
}
function tokenBlobFromOAuth$1(json) {
	const access = json.access_token;
	const refresh = json.refresh_token;
	return {
		accessToken: typeof access === "string" ? access : "",
		refreshToken: typeof refresh === "string" ? refresh : "",
		expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1e3,
		label: "",
		email: "",
		accountId: ""
	};
}
async function grokExchangeCode(cfg, pkce, code) {
	const blob = tokenBlobFromOAuth$1(await formTokenRequest(GROK_TOKEN, {
		grant_type: "authorization_code",
		client_id: cfg.clientId,
		code,
		redirect_uri: cfg.redirectUri,
		code_verifier: pkce.verifier
	}, fetch));
	return {
		...blob,
		email: blob.email.length > 0 ? blob.email : emailFromToken(blob.accessToken),
		label: "Grok"
	};
}
async function grokRefresh(blob) {
	const next = tokenBlobFromOAuth$1(await formTokenRequest(GROK_TOKEN, {
		grant_type: "refresh_token",
		client_id: GROK_CLIENT_ID,
		refresh_token: blob.refreshToken
	}, fetch));
	return {
		...next,
		refreshToken: next.refreshToken.length > 0 ? next.refreshToken : blob.refreshToken,
		label: blob.label.length > 0 ? blob.label : "Grok",
		email: blob.email.length > 0 ? blob.email : next.email
	};
}
//#endregion
//#region lib/types/subscription/vendors/antigravity.js
/**
* Google Antigravity (Nano Banana Pro) subscription image vendor.
*
* Protocol adapted from opencode-antigravity-auth-remix (MIT,
* (c) 2026 Darkstarrd-dev, based on NoeFabris/opencode-antigravity-auth):
* Google OAuth with the Antigravity CLI's public client credentials, managed
* project discovery via loadCodeAssist, and image generation through the
* v1internal:streamGenerateContent endpoint with the gemini-3-pro-image
* model. Reference: dist/src/constants.js, dist/src/plugin/image.js,
* dist/src/plugin/project.js.
*
* The dsh-subscriptions antigravity vendor left the OAuth client empty
* (Google's is confidential); the remix package ships the Antigravity CLI's
* own embedded client id/secret, which the community treats as public the
* same way Codex CLI's and grok-cli's are.
*/
const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const SCOPE = [
	"https://www.googleapis.com/auth/cloud-platform",
	"https://www.googleapis.com/auth/userinfo.email",
	"https://www.googleapis.com/auth/userinfo.profile",
	"https://www.googleapis.com/auth/cclog",
	"https://www.googleapis.com/auth/experimentsandconfigs"
].join(" ");
/** Antigravity CLI's embedded OAuth client, treated as public like Codex's. */
const ANTIGRAVITY_CLIENT_ID = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const ANTIGRAVITY_CLIENT_SECRET = "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";
const ANTIGRAVITY_REDIRECT_URI = "http://localhost:51121/oauth-callback";
/**
* Endpoint fallback order for generation, mirroring the reference (daily
* sandbox first, then autopush, then prod).
*/
const ANTIGRAVITY_ENDPOINTS = [
	"https://daily-cloudcode-pa.sandbox.googleapis.com",
	"https://autopush-cloudcode-pa.sandbox.googleapis.com",
	"https://cloudcode-pa.googleapis.com"
];
/** loadCodeAssist is best supported on prod; discovery tries prod first. */
const LOAD_ENDPOINTS = [
	"https://cloudcode-pa.googleapis.com",
	"https://daily-cloudcode-pa.sandbox.googleapis.com",
	"https://autopush-cloudcode-pa.sandbox.googleapis.com"
];
/** The image model served through this channel: Nano Banana Pro. */
const ANTIGRAVITY_IMAGE_MODEL = "gemini-3-pro-image";
/**
* Antigravity client version carried in the browser User-Agent. Google's
* backend routes by this: a non-Antigravity or outdated UA lands in the
* enterprise-license check and fails with the misleading 403 #3501
* "You do not have a valid license of this product". The official
* auto-updater publishes the current version; changelog scrape and the
* hardcoded fallback keep the header sane when the updater is unreachable
* (same strategy as the reference implementation's version.js).
*/
const ANTIGRAVITY_VERSION_FALLBACK = "2.0.6";
const VERSION_URL = "https://antigravity-auto-updater-974169037036.us-central1.run.app";
const CHANGELOG_URL = "https://antigravity.google/changelog";
const VERSION_FETCH_TIMEOUT_MS = 5e3;
const CHANGELOG_SCAN_CHARS = 5e3;
const VERSION_REGEX = /\d+\.\d+\.\d+/;
let antigravityVersion;
/** Current client version: the fetched one, or the fallback until fetched. */
function getAntigravityVersion() {
	return antigravityVersion ?? ANTIGRAVITY_VERSION_FALLBACK;
}
/** Fetch and cache the current version once; failures keep the fallback. */
async function initAntigravityVersion() {
	if (antigravityVersion !== void 0) return;
	const parsed = await fetchVersionText(VERSION_URL) ?? await fetchVersionText(CHANGELOG_URL, CHANGELOG_SCAN_CHARS);
	if (parsed !== void 0) antigravityVersion = parsed;
}
async function fetchVersionText(url, maxChars) {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(VERSION_FETCH_TIMEOUT_MS) });
		if (!response.ok) return void 0;
		let text = await response.text();
		if (maxChars !== void 0) text = text.slice(0, maxChars);
		const match = text.match(VERSION_REGEX);
		return match === null ? void 0 : match[0];
	} catch {
		return;
	}
}
/** Hardcoded fallback project when Antigravity returns none (workspace accounts). */
const DEFAULT_PROJECT_ID = "rising-fact-p41fc";
/** Generation timeout mirroring the reference implementation. */
const IMAGE_TIMEOUT_MS = 12e4;
/** Aspect ratios the generationConfig.imageConfig accepts. */
const ASPECT_RATIOS = [
	"1:1",
	"16:9",
	"9:16",
	"4:3",
	"3:4",
	"21:9"
];
/** Safety settings the image endpoint requires to not block benign prompts. */
const SAFETY_SETTINGS_OFF = [
	{
		category: "HARM_CATEGORY_HARASSMENT",
		threshold: "OFF"
	},
	{
		category: "HARM_CATEGORY_HATE_SPEECH",
		threshold: "OFF"
	},
	{
		category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
		threshold: "OFF"
	},
	{
		category: "HARM_CATEGORY_DANGEROUS_CONTENT",
		threshold: "OFF"
	},
	{
		category: "HARM_CATEGORY_CIVIC_INTEGRITY",
		threshold: "OFF"
	}
];
function antigravityConfig() {
	return {
		clientId: ANTIGRAVITY_CLIENT_ID,
		clientSecret: ANTIGRAVITY_CLIENT_SECRET,
		redirectUri: ANTIGRAVITY_REDIRECT_URI
	};
}
function antigravityAuthorizeUrl(cfg, pkce) {
	return buildAuthorizeUrl({
		authUrl: AUTH,
		clientId: cfg.clientId,
		redirectUri: cfg.redirectUri,
		challenge: pkce.challenge,
		state: pkce.state,
		scope: SCOPE,
		extra: {
			access_type: "offline",
			prompt: "consent"
		}
	});
}
/**
* Headers for project discovery (loadCodeAssist): the reference keeps the
* plain SDK identity here, mirroring its project.js loadHeaders.
*/
function loadHeaders(projectId) {
	const platform = process.platform === "win32" ? "WINDOWS" : process.platform === "darwin" ? "MACOS" : "LINUX";
	return {
		"User-Agent": "google-api-nodejs-client/9.15.1",
		"X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
		"Client-Metadata": JSON.stringify({
			ideType: "ANTIGRAVITY",
			platform,
			pluginType: "GEMINI",
			...projectId.length > 0 ? { duetProject: projectId } : {}
		})
	};
}
/**
* Headers for content requests (image generation): the full Electron
* browser User-Agent with the Antigravity client version, matching the
* official IDE. This is the identity the license check keys on — the plain
* SDK UA here is what produced 403 #3501 on personal accounts.
*/
function contentHeaders(projectId) {
	const uaPlatform = process.platform === "darwin" ? "Macintosh; Intel Mac OS X 10_15_7" : "Windows NT 10.0; Win64; x64";
	const platform = process.platform === "win32" ? "WINDOWS" : process.platform === "darwin" ? "MACOS" : "LINUX";
	return {
		"User-Agent": `Mozilla/5.0 (${uaPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) Antigravity/${getAntigravityVersion()} Chrome/138.0.7204.235 Electron/37.3.1 Safari/537.36`,
		"X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
		"Client-Metadata": JSON.stringify({
			ideType: "ANTIGRAVITY",
			platform,
			pluginType: "GEMINI",
			...projectId.length > 0 ? { duetProject: projectId } : {}
		})
	};
}
function tokenBlobFromOAuth(json) {
	const access = json.access_token;
	const refresh = json.refresh_token;
	const idToken = typeof json.id_token === "string" ? json.id_token : "";
	return {
		accessToken: typeof access === "string" ? access : "",
		refreshToken: typeof refresh === "string" ? refresh : "",
		expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1e3,
		label: "",
		email: emailFromIdToken(idToken),
		accountId: ""
	};
}
/** Decode the id_token's JWT payload for the account email (identity only). */
function emailFromIdToken(idToken) {
	const parts = idToken.split(".");
	if (parts.length < 2) return "";
	try {
		const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
		return typeof payload.email === "string" ? payload.email : "";
	} catch {
		return "";
	}
}
async function antigravityExchangeCode(cfg, pkce, code) {
	const blob = tokenBlobFromOAuth(await formTokenRequest(TOKEN, {
		client_id: cfg.clientId,
		client_secret: cfg.clientSecret,
		grant_type: "authorization_code",
		code,
		redirect_uri: cfg.redirectUri,
		code_verifier: pkce.verifier
	}, fetch));
	if (blob.accessToken.length === 0) throw new Error("Antigravity token endpoint returned no access token");
	return blob;
}
async function antigravityRefresh(blob) {
	const next = tokenBlobFromOAuth(await formTokenRequest(TOKEN, {
		client_id: ANTIGRAVITY_CLIENT_ID,
		client_secret: ANTIGRAVITY_CLIENT_SECRET,
		grant_type: "refresh_token",
		refresh_token: blob.refreshToken
	}, fetch));
	return {
		...next,
		refreshToken: next.refreshToken.length > 0 ? next.refreshToken : blob.refreshToken,
		label: blob.label,
		email: blob.email.length > 0 ? blob.email : next.email,
		accountId: ""
	};
}
/**
* Resolve the managed project id for the logged-in account. Most accounts
* have one; when loadCodeAssist reports none, the hardcoded fallback keeps
* generation working (mirrors the reference's ensureProjectContext).
* Returns '' only when every endpoint fails, letting generate() throw then.
*/
async function antigravityResolveProject(blob) {
	const metadata = {
		ideType: "ANTIGRAVITY",
		platform: platformOf(),
		pluginType: "GEMINI"
	};
	for (const base of LOAD_ENDPOINTS) try {
		const response = await fetch(`${base}/v1internal:loadCodeAssist`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${blob.accessToken}`,
				...loadHeaders("")
			},
			body: JSON.stringify({ metadata }),
			signal: AbortSignal.timeout(25e3)
		});
		if (!response.ok) continue;
		const payload = await response.json().catch(() => null);
		if (payload === null) continue;
		const project = payload.cloudaicompanionProject;
		const id = typeof project === "string" ? project : typeof project === "object" && project !== null && typeof project.id === "string" ? project.id : "";
		if (id.length > 0) return id;
	} catch {}
	return DEFAULT_PROJECT_ID;
}
function platformOf() {
	if (process.platform === "win32") return "WINDOWS";
	if (process.platform === "darwin") return "MACOS";
	return "LINUX";
}
/**
* Build the streamGenerateContent request body for one image generation.
* Ported from the reference buildImageRequest + the wrapping envelope: no
* tools, no systemInstruction, no thinkingConfig; responseModalities asks
* for TEXT+IMAGE. Reference images (edits) ride along as inlineData parts
* before the text part, mirroring the reference implementation.
*/
function antigravityImageBody(options) {
	const imageConfig = { aspectRatio: options.aspectRatio !== void 0 && ASPECT_RATIOS.includes(options.aspectRatio) ? options.aspectRatio : "1:1" };
	if (options.hd === true) imageConfig.imageSize = "4K";
	const parts = [];
	for (const image of options.referenceImages ?? []) parts.push({ inlineData: {
		mimeType: image.mediaType,
		data: Buffer.from(image.data).toString("base64")
	} });
	parts.push({ text: options.prompt });
	return {
		contents: [{
			role: "user",
			parts
		}],
		generationConfig: {
			candidateCount: 1,
			imageConfig,
			responseModalities: ["TEXT", "IMAGE"]
		},
		safetySettings: SAFETY_SETTINGS_OFF
	};
}
/** Wrap the inner request in the Antigravity agent envelope. */
function antigravityEnvelope(projectId, request) {
	return {
		project: projectId,
		model: ANTIGRAVITY_IMAGE_MODEL,
		userAgent: "antigravity",
		requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
		requestType: "agent",
		request: {
			...request,
			session_id: `sess-${randomUUID()}`
		}
	};
}
/**
* Generate one image on the logged-in Antigravity account: resolve the
* project, POST the wrapped body to each endpoint in fallback order, and
* parse the SSE stream for the inlineData image part.
*/
async function antigravityGenerateImage(options) {
	await initAntigravityVersion();
	const inner = antigravityImageBody({
		prompt: options.prompt,
		...options.aspectRatio !== void 0 ? { aspectRatio: options.aspectRatio } : {},
		...options.hd !== void 0 ? { hd: options.hd } : {},
		...options.referenceImages !== void 0 ? { referenceImages: options.referenceImages } : {}
	});
	const body = antigravityEnvelope(options.projectId, inner);
	let lastError = "no endpoint succeeded";
	for (const base of ANTIGRAVITY_ENDPOINTS) {
		const url = `${base}/v1internal:streamGenerateContent?alt=sse`;
		const timeoutSignal = AbortSignal.timeout(IMAGE_TIMEOUT_MS);
		const signal = options.signal !== void 0 ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					...contentHeaders(options.projectId),
					Authorization: `Bearer ${options.blob.accessToken}`,
					"Content-Type": "application/json",
					Accept: "text/event-stream"
				},
				body: JSON.stringify(body),
				signal
			});
			if (!response.ok) {
				const text = await response.text().catch(() => "");
				lastError = `HTTP ${String(response.status)}: ${text.slice(0, 200)}`;
				if (response.status === 403 || response.status === 404 || response.status === 429 || response.status >= 500) continue;
				throw new Error(`antigravity ${lastError}`);
			}
			const text = await response.text();
			const parsed = parseSseImage(text);
			if (parsed !== void 0) return parsed;
			const reason = parseSseError(text);
			lastError = reason !== void 0 ? reason : "response contained no image";
			continue;
		} catch (error) {
			if (options.signal?.aborted === true) throw error;
			lastError = error instanceof Error ? error.message : String(error);
			continue;
		}
	}
	throw new Error(`antigravity image generation failed: ${lastError}`);
}
/** Scan an SSE body for the first image part in any data: line. */
function parseSseImage(text) {
	for (const line of text.split("\n")) {
		if (!line.startsWith("data: ")) continue;
		const raw = line.slice(6).trim();
		if (raw.length === 0 || raw === "[DONE]") continue;
		try {
			const data = JSON.parse(raw);
			for (const candidate of data.response?.candidates ?? []) for (const part of candidate.content?.parts ?? []) {
				const inline = part.inlineData;
				if (typeof inline?.data === "string" && inline.data.length > 0 && typeof inline.mimeType === "string" && inline.mimeType.startsWith("image/")) return {
					b64: inline.data,
					mimeType: inline.mimeType
				};
			}
		} catch {}
	}
}
/** Pull the first error block an SSE body reports, for better messages. */
function parseSseError(text) {
	for (const line of text.split("\n")) {
		if (!line.startsWith("data: ")) continue;
		const raw = line.slice(6).trim();
		if (raw.length === 0 || raw === "[DONE]") continue;
		try {
			const data = JSON.parse(raw);
			if (data.error !== void 0) {
				const code = typeof data.error.code === "string" || typeof data.error.code === "number" ? String(data.error.code) : "";
				const message = typeof data.error.message === "string" ? data.error.message : "";
				const joined = `${code.length > 0 ? `${code}: ` : ""}${message}`.trim();
				if (joined.length > 0) return joined;
			}
		} catch {}
	}
}
//#endregion
//#region lib/types/subscription/manager.js
/**
* Subscription account manager: login flows, blob storage through the DSH
* Credentials service, token refresh with per-account locking, and image
* generation on the logged-in account.
*
* The account store pattern follows @goodandready/dsh-subscriptions (MIT,
* (c) 2026 GooDAnDReaDY) lib/accounts.js, trimmed to one account per vendor
* (no rotation, no cooldowns) because this bundle has exactly two vendors
* and no chat adapter to protect.
*
* Isolation invariants (project rules):
* - OAuth blobs live under SUBSCRIPTION_OAUTH_* refs, never the API-key refs.
* - Login/logout never touches any other setting or credential.
* - The browser side never sees a token; it sees the authorize URL and
*   status words only. Generation happens host-side, mirroring every other
*   adapter in this bundle.
*/
/** The vendor each dsh-image-gen subscription provider maps onto. */
function vendorOf(provider) {
	if (provider === "chatgpt-sub") return "codex";
	if (provider === "google-sub") return "antigravity";
	return "grok";
}
/** Credential ref one vendor's OAuth blob is stored under (index fixed at 1). */
function subscriptionOauthRef(vendor) {
	return credentialRef(`${vendor.toUpperCase()}_OAUTH_1`);
}
/**
* Per-application manager instance. Constructed once in the plugin entry,
* owns the pending-login map (PKCE state to login session) and the refresh
* locks; nothing here is persisted except the blobs themselves.
*/
/** Provider names by vendor for login-result pages and errors. */
function providerNameOf(vendor) {
	return SUBSCRIPTION_PROVIDER_DISPLAY_NAMES[vendor === "codex" ? "chatgpt-sub" : vendor === "antigravity" ? "google-sub" : "grok-sub"];
}
var SubscriptionManager = class {
	ctx;
	pending = /* @__PURE__ */ new Map();
	refreshLocks = /* @__PURE__ */ new Map();
	/** Cheap in-memory expiry cache so badges do not hit credentials on read. */
	blobCache = /* @__PURE__ */ new Map();
	/** Antigravity needs a per-account project id on every generation call. */
	projectCache = /* @__PURE__ */ new Map();
	constructor(ctx) {
		this.ctx = ctx;
	}
	/** Read a vendor's stored blob, or undefined when signed out. */
	async readBlob(vendor) {
		try {
			const raw = (await this.ctx.credentials.resolve(subscriptionOauthRef(vendor)))?.value ?? "";
			if (raw.trim().length === 0) return void 0;
			return parseBlob(raw);
		} catch {
			return;
		}
	}
	/** Login status for the settings card; never throws. */
	async loginStatus(vendor) {
		const blob = await this.readBlob(vendor);
		if (blob === void 0) return { state: "logged-out" };
		return {
			state: "logged-in",
			email: blob.email
		};
	}
	/**
	* Begin a login: registers PKCE state, starts the loopback catch server on
	* the vendor-fixed redirect port, and returns the authorize URL for the
	* browser to open. Completion lands in the loopback callback.
	*/
	async beginLogin(vendor) {
		const redirectUri = vendor === "codex" ? CODEX_REDIRECT_URI : vendor === "antigravity" ? ANTIGRAVITY_REDIRECT_URI : GROK_REDIRECT_URI;
		const pkce = await createPkce();
		this.pending.set(pkce.state, {
			vendor,
			pkce
		});
		const url = vendor === "codex" ? codexAuthorizeUrl(codexConfig(), pkce) : vendor === "antigravity" ? antigravityAuthorizeUrl(antigravityConfig(), pkce) : grokAuthorizeUrl(grokConfig(), pkce);
		startLoopback({
			redirectUri,
			onCode: async (params) => await this.completeLoginFromCallback(vendor, params.get("code") ?? "", params.get("state") ?? "")
		}).catch(() => {});
		return { url };
	}
	/** Loopback callback: validate state, exchange the code, store the blob. */
	async completeLoginFromCallback(vendor, code, state) {
		if (code.length === 0) throw new Error("callback carried no authorization code");
		const row = this.pending.get(state);
		if (row === void 0 || row.vendor !== vendor) throw new Error("login session expired; start again");
		this.pending.delete(state);
		const blob = vendor === "codex" ? await codexExchangeCode(codexConfig(), row.pkce, code) : vendor === "antigravity" ? await antigravityExchangeCode(antigravityConfig(), row.pkce, code) : await grokExchangeCode(grokConfig(), row.pkce, code);
		await this.saveBlob(vendor, blob);
		return `<!doctype html><meta charset="utf-8"><title>dsh-image-gen</title><p>${providerNameOf(vendor)} 登录成功（${escapeHtml(blob.email)}），可以关闭此页返回设置。</p>`;
	}
	/** Sign out: clear the blob and the caches. No other setting changes. */
	async logout(vendor) {
		await this.ctx.credentials.unset(subscriptionOauthRef(vendor));
		this.blobCache.delete(vendor);
		this.projectCache.clear();
	}
	async saveBlob(vendor, blob) {
		await this.ctx.credentials.set(subscriptionOauthRef(vendor), serializeBlob(blob));
		this.blobCache.set(vendor, blob);
	}
	/**
	* Return a blob whose access token is usable; refreshes first when the
	* stored one is expired (or expiring within the skew window). Single-flight
	* per vendor so concurrent generate calls share one refresh.
	*/
	async ensureFresh(vendor) {
		const blob = await this.readBlob(vendor);
		if (blob === void 0) throw notLoggedInError(vendor);
		if (blob.refreshToken.length === 0) return blob;
		if (blob.expiresAt !== 0 && blob.expiresAt - 6e4 > Date.now()) return blob;
		const inflight = this.refreshLocks.get(vendor);
		if (inflight !== void 0) return inflight;
		const refresh = (async () => {
			const next = vendor === "codex" ? await codexRefresh(blob) : vendor === "antigravity" ? await antigravityRefresh(blob) : await grokRefresh(blob);
			const merged = {
				...next,
				refreshToken: next.refreshToken.length > 0 ? next.refreshToken : blob.refreshToken,
				accountId: next.accountId.length > 0 ? next.accountId : blob.accountId
			};
			await this.saveBlob(vendor, merged);
			return merged;
		})().finally(() => {
			this.refreshLocks.delete(vendor);
		});
		this.refreshLocks.set(vendor, refresh);
		return refresh;
	}
	/** Generate one image through the logged-in account. b64 reply decoded host-side. */
	async generate(options) {
		const { vendor, prompt } = options;
		const session = await this.ensureFresh(vendor);
		const text = prompt.trim();
		if (text.length === 0) throw new Error("prompt must be a non-empty string");
		const references = options.referenceImages ?? [];
		if (references.length > 5) throw new Error(`订阅生图最多支持 ${String(5)} 张参考图，当前 ${String(references.length)} 张`);
		if (vendor === "antigravity") {
			const projectId = await this.ensureAntigravityProject(session);
			const aspectRatio = antigravityAspectRatioOf(options.size);
			return [{ b64_json: (await antigravityGenerateImage({
				blob: session,
				projectId,
				prompt: text,
				...aspectRatio !== void 0 ? { aspectRatio } : {},
				hd: options.quality === "hd" || options.quality === "high",
				...references.length > 0 ? { referenceImages: references } : {},
				...options.signal !== void 0 ? { signal: options.signal } : {}
			})).b64 }];
		}
		let url;
		let headers;
		let body;
		if (vendor === "codex") {
			url = references.length > 0 ? CODEX_IMAGE_EDIT_URL : CODEX_IMAGE_URL;
			headers = codexIdentityHeaders(session);
			body = {
				prompt: text,
				model: CODEX_IMAGE_MODEL,
				...references.length > 0 ? { images: references.map((image) => ({ image_url: toDataUrl(image) })) } : {},
				...options.size !== void 0 && options.size.length > 0 ? { size: options.size } : {},
				...options.quality !== void 0 && options.quality.length > 0 ? { quality: options.quality } : {}
			};
		} else {
			url = references.length > 0 ? GROK_IMAGE_EDIT_URL : GROK_IMAGE_URL;
			headers = grokIdentityHeaders(session);
			const aspect = {
				"1024x1024": "1:1",
				"1024x1536": "2:3",
				"1536x1024": "3:2",
				auto: "auto"
			};
			const level = options.quality === "low" ? "low" : options.quality === "medium" || options.quality === "high" ? "medium" : void 0;
			body = {
				prompt: text,
				model: GROK_IMAGE_MODEL,
				response_format: "b64_json",
				...references.length > 0 ? { images: references.map((image) => ({
					type: "image_url",
					image_url: toDataUrl(image)
				})) } : {},
				...options.size !== void 0 && aspect[options.size] !== void 0 ? { aspect_ratio: aspect[options.size] } : {},
				...level !== void 0 ? { quality: level } : {}
			};
		}
		const response = await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
			...options.signal !== void 0 ? { signal: options.signal } : {}
		});
		const payload = await response.json().catch(() => ({}));
		if (!response.ok) {
			const detail = extractErrorMessage(payload);
			throw new Error(`${vendor} HTTP ${String(response.status)}${detail !== void 0 ? `: ${detail.slice(0, 200)}` : ""}`);
		}
		return parseImages(payload);
	}
	/**
	* Resolve (and cache per refresh token) the managed project id the
	* Antigravity generation envelope needs. Re-resolved when the account
	* signs out or a different account logs in.
	*/
	async ensureAntigravityProject(blob) {
		const cacheKey = blob.refreshToken.length > 0 ? blob.refreshToken : blob.accessToken.slice(0, 32);
		const cached = this.projectCache.get(cacheKey);
		if (cached !== void 0) return cached;
		const projectId = await antigravityResolveProject(blob);
		this.projectCache.set(cacheKey, projectId);
		return projectId;
	}
};
/** Map an OpenAI-style size onto the aspect ratio Antigravity accepts. */
function antigravityAspectRatioOf(size) {
	const table = {
		"1024x1024": "1:1",
		"1024x1536": "2:3",
		"1536x1024": "3:2",
		"768x1398": "9:16",
		"1398x768": "16:9",
		auto: "1:1"
	};
	if (size === void 0) return void 0;
	const mapped = table[size];
	if (mapped !== void 0) return mapped;
	return /^\d+:\d+$/.test(size) ? size : "1:1";
}
/** Encode one reference image as the data URL the edit endpoints accept. */
function toDataUrl(image) {
	return `data:${image.mediaType};base64,${Buffer.from(image.data).toString("base64")}`;
}
/** Response parsing: both vendors reply in the same `{data:[{b64_json}]}` shape. */
function parseImages(payload) {
	const body = typeof payload === "object" && payload !== null ? payload : {};
	const rows = Array.isArray(body.data) ? body.data : [];
	const images = [];
	for (const row of rows) {
		if (typeof row !== "object" || row === null) continue;
		const b64 = row.b64_json;
		if (typeof b64 !== "string" || b64.length === 0) continue;
		const revised = row.revised_prompt;
		images.push({
			b64_json: b64,
			...typeof revised === "string" && revised.length > 0 ? { revisedPrompt: revised } : {}
		});
	}
	if (images.length === 0) throw new Error("response contains no images");
	return images;
}
function extractErrorMessage(payload) {
	if (typeof payload !== "object" || payload === null) return void 0;
	const error = payload.error;
	if (typeof error !== "object" || error === null) return void 0;
	const row = error;
	if (typeof row.message === "string") return row.message;
	if (typeof row.code === "string") return row.code;
}
function notLoggedInError(vendor) {
	const display = providerNameOf(vendor);
	return /* @__PURE__ */ new Error(`${display} 未登录：请到 设置 > 插件 > 图像生成 的订阅区完成登录`);
}
function escapeHtml(value) {
	return value.replace(/[&<>"']/g, (ch) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#39;"
	})[ch] ?? ch);
}
//#endregion
//#region lib/types/subscription/subscription-route.js
const MAX_BODY_BYTES$1 = 16384;
/** The vendor each subscription provider logs in as. */
function vendorOfProvider(provider) {
	if (provider === "chatgpt-sub") return "codex";
	if (provider === "google-sub") return "antigravity";
	return "grok";
}
/** Register the login/status routes on the plugin's web server. */
function registerSubscriptionRoutes(ctx, manager) {
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: SUBSCRIPTION_LOGIN_ROUTE,
		handler: (req, res) => {
			serveLogin(req, res, manager);
		}
	}), "dsh-image-gen: subscription login route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: SUBSCRIPTION_STATUS_ROUTE,
		handler: (req, res) => {
			serveStatus(req, res, manager);
		}
	}), "dsh-image-gen: subscription status route");
}
async function serveLogin(req, res, manager) {
	if (!sameOrigin$1(req)) return jsonError$1(res, 403, "origin-rejected");
	if (req.method !== "POST") return jsonError$1(res, 405, "method-not-allowed");
	if (!(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) return jsonError$1(res, 415, "json-required");
	let body;
	try {
		body = JSON.parse(await readBody$1(req));
	} catch {
		return jsonError$1(res, 400, "invalid-request");
	}
	const provider = record$1(body)?.provider;
	if (typeof provider !== "string" || !SUBSCRIPTION_PROVIDERS.includes(provider)) return jsonError$1(res, 400, "invalid-provider");
	const action = record$1(body)?.action;
	const vendor = vendorOfProvider(provider);
	try {
		if (action === "logout") {
			await manager.logout(vendor);
			return json$1(res, 200, { ok: true });
		}
		const { url } = await manager.beginLogin(vendor);
		json$1(res, 200, {
			ok: true,
			url
		});
	} catch (error) {
		json$1(res, 502, {
			ok: false,
			error: error instanceof Error ? error.message : String(error)
		});
	}
}
async function serveStatus(req, res, manager) {
	if (!sameOrigin$1(req)) return jsonError$1(res, 403, "origin-rejected");
	if (req.method !== "POST") return jsonError$1(res, 405, "method-not-allowed");
	const statuses = {};
	for (const provider of SUBSCRIPTION_PROVIDERS) {
		const status = await manager.loginStatus(vendorOfProvider(provider));
		statuses[provider] = status.state === "logged-in" ? {
			state: status.state,
			email: status.email
		} : { state: status.state };
	}
	json$1(res, 200, {
		ok: true,
		statuses
	});
}
function sameOrigin$1(req) {
	const origin = req.headers.origin;
	const host = req.headers.host;
	return origin === void 0 || host === void 0 || origin === `http://${host}` || origin === `https://${host}`;
}
function record$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
async function readBody$1(req) {
	const chunks = [];
	let bytes = 0;
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		bytes += buffer.byteLength;
		if (bytes > MAX_BODY_BYTES$1) throw new Error("request too large");
		chunks.push(buffer);
	}
	return Buffer.concat(chunks).toString("utf8");
}
function json$1(res, status, value) {
	if (res.headersSent || res.writableEnded || res.destroyed) return;
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	res.end(JSON.stringify(value));
}
function jsonError$1(res, status, code) {
	json$1(res, status, { error: code });
}
//#endregion
//#region lib/types/subscription.js
/**
* Generate one image through a logged-in subscription account. Returns the
* same `{ data, mediaType }` contract as the API-key adapters so the caller
* can feed it straight into `saveGenerated`. With sourceImages the call is
* an edit: the vendor layer picks the channel's edit endpoint.
*/
async function generateSubscriptionImage(options) {
	const { manager, provider, prompt, maxBytes, signal } = options;
	const size = options.size?.trim();
	const sourceImages = options.sourceImages ?? [];
	const result = await withTimeout(manager.generate({
		vendor: vendorOf(provider),
		prompt,
		...size !== void 0 && size.length > 0 ? { size } : {},
		...sourceImages.length > 0 ? { referenceImages: sourceImages } : {},
		signal
	}), signal);
	const first = Array.isArray(result) ? result[0] : void 0;
	if (first === void 0 || typeof first.b64_json !== "string" || first.b64_json.length === 0) throw new Error("Subscription image reply contained no image payload");
	const bytes = new Uint8Array(Buffer.from(first.b64_json, "base64"));
	if (bytes.byteLength > maxBytes) throw new Error(`Subscription image is ${formatBytes(bytes.byteLength)}, above this DSH's ${formatBytes(maxBytes)} limit`);
	const mediaType = detectImageMediaType(bytes);
	if (mediaType === void 0) throw new Error("Subscription image payload has an unrecognized format");
	return {
		data: bytes,
		mediaType,
		...typeof first.revisedPrompt === "string" && first.revisedPrompt.length > 0 ? { revisedPrompt: first.revisedPrompt } : {}
	};
}
/** Run one promise with the subscription timeout and the call's abort signal. */
async function withTimeout(promise, signal) {
	let timer;
	let rejectCall;
	const onAbort = () => {
		rejectCall(/* @__PURE__ */ new Error("Subscription image generation aborted"));
	};
	const guarded = new Promise((resolve, reject) => {
		rejectCall = reject;
		timer = setTimeout(() => {
			reject(/* @__PURE__ */ new Error(`Subscription image generation timed out after ${String(Math.round(SUBSCRIPTION_TIMEOUT_MS / 1e3))}s`));
		}, SUBSCRIPTION_TIMEOUT_MS);
		promise.then(resolve, reject);
	});
	signal.addEventListener("abort", onAbort, { once: true });
	try {
		return await guarded;
	} finally {
		if (timer !== void 0) clearTimeout(timer);
		signal.removeEventListener("abort", onAbort);
	}
}
function formatBytes(bytes) {
	if (bytes >= 1048576) return `${String(Math.round(bytes / 1048576 * 10) / 10)}MB`;
	return `${String(Math.round(bytes / 1024))}KB`;
}
//#endregion
//#region lib/types/test-route.js
const MAX_BODY_BYTES = 16384;
const PROBE_TIMEOUT_MS = 1e4;
/**
* The endpoint each provider is probed on. All four cloud providers expose a
* model-list GET that authenticates with the same credential image generation
* uses; ComfyUI exposes its standard `system_stats` health endpoint.
*/
function probeTarget(provider, config, apiKey) {
	if (provider === "comfyui") return {
		url: joinUrl(config.comfyuiBaseURL ?? "http://127.0.0.1:8188", "system_stats"),
		headers: {}
	};
	if (isSubscriptionProvider(provider)) throw new Error("Subscription providers are probed through the manager, not probeTarget");
	if (provider === "google") return {
		url: googleModelsUrl(config),
		headers: { "x-goog-api-key": apiKey ?? "" }
	};
	const headers = { authorization: `Bearer ${apiKey ?? ""}` };
	if (provider === "dashscope") return {
		url: joinUrl(config.dashscopeEndpoint ?? "https://dashscope.aliyuncs.com/api/v1", "models"),
		headers
	};
	if (provider === "qwen-token-plan") return {
		url: joinUrl(config.qwenTokenPlanEndpoint ?? "https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1", "models"),
		headers
	};
	if (provider === "seedream") return {
		url: joinUrl(config.seedreamBaseURL ?? "https://ark.cn-beijing.volces.com/api/v3", "models"),
		headers
	};
	if (provider === "openai-compat") {
		const base = config.openaiCompatBaseURL?.trim() ?? "";
		if (base.length === 0) throw new Error("OpenAI-compatible base URL is not configured");
		return {
			url: joinUrl(base, "models"),
			headers
		};
	}
	if (provider === "xai") return {
		url: joinUrl(config.xaiBaseURL ?? "https://api.x.ai/v1", "models"),
		headers
	};
	if (provider === "zhipu") return {
		url: joinUrl(config.zhipuBaseURL ?? "https://open.bigmodel.cn/api/paas/v4", "models"),
		headers
	};
	return {
		url: joinUrl(config.openaiBaseURL ?? "https://api.openai.com/v1", "models"),
		headers
	};
}
/** `…/v1beta/interactions` (or any trailing path) becomes `…/v1beta/models`. */
function googleModelsUrl(config) {
	const endpoint = config.googleEndpoint;
	const fallback = "https://generativelanguage.googleapis.com/v1beta/models";
	if (typeof endpoint !== "string" || endpoint.trim().length === 0) return fallback;
	try {
		const url = new URL(endpoint);
		const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
		segments[segments.length - 1] = "models";
		url.pathname = `/${segments.join("/")}`;
		return url.toString();
	} catch {
		throw new Error("Google endpoint must be an absolute URL");
	}
}
function joinUrl(base, path) {
	return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}
/** Extract bare model ids from a Google `list models` payload (`models/{id}`). */
function parseGoogleModelIds(payload) {
	if (typeof payload !== "object" || payload === null) return [];
	const models = payload.models;
	if (!Array.isArray(models)) return [];
	const ids = [];
	for (const entry of models) {
		if (typeof entry !== "object" || entry === null) continue;
		const name = entry.name;
		if (typeof name !== "string" || name.length === 0) continue;
		ids.push(name.startsWith("models/") ? name.slice(7) : name);
	}
	return ids;
}
/** Heuristic filter: Gemini image models carry `image`/`imagen` in the id. */
function filterImageModelIds(ids) {
	return ids.filter((id) => /image|imagen/i.test(id));
}
/** Narrow filter for the official OpenAI catalog: gpt-image and DALL·E families. */
function filterOpenAIImageModelIds(ids) {
	return ids.filter((id) => /^(gpt-image|dall-e)/i.test(id));
}
/** Broad filter for relays: common image-model id fragments across vendors. */
function filterRelayImageModelIds(ids) {
	return ids.filter((id) => /(^|[-_.])(image|imagen|flux|seedream|seededit|sd|sdxl|sd3|cogview|janus|wan|kolors|hunyuan-image)/i.test(id) || /^(dall-e|gpt-image)/i.test(id));
}
/** Ark catalog filter: the Seedream (generation) and SeedEdit (editing) families. */
function filterSeedreamImageModelIds(ids) {
	return ids.filter((id) => /seedream|seededit/i.test(id));
}
/** Zhipu catalog filter: GLM-Image and CogView families. */
function filterZhipuImageModelIds(ids) {
	return ids.filter((id) => /glm-image|cogview/i.test(id));
}
/** Extract model ids from an OpenAI-style `{data:[{id}]}` or xAI-style `{models:[{id}]}` payload. */
function parseOpenAIModelIds(payload) {
	if (typeof payload !== "object" || payload === null) return [];
	const data = payload.data;
	const models = payload.models;
	const entries = Array.isArray(data) ? data : Array.isArray(models) ? models : void 0;
	if (entries === void 0) return [];
	const ids = [];
	for (const entry of entries) {
		if (typeof entry !== "object" || entry === null) continue;
		const id = entry.id;
		if (typeof id === "string" && id.length > 0) ids.push(id);
	}
	return ids;
}
/**
* Extract image-capable model ids from a DashScope native
* `{output:{models:[{model,capabilities}]}}` payload. The `capabilities`
* array marks image generation as `IG`; name fragments are a fallback for
* payloads that omit the field.
*/
function parseDashScopeImageModelIds(payload) {
	if (typeof payload !== "object" || payload === null) return [];
	const output = payload.output;
	if (typeof output !== "object" || output === null) return [];
	const models = output.models;
	if (!Array.isArray(models)) return [];
	const ids = [];
	for (const entry of models) {
		if (typeof entry !== "object" || entry === null) continue;
		const model = entry.model;
		if (typeof model !== "string" || model.length === 0) continue;
		const capabilities = entry.capabilities;
		if (Array.isArray(capabilities) && capabilities.includes("IG") || /wanx|qwen-image|wan2|image/i.test(model)) ids.push(model);
	}
	return ids;
}
/** Gemini list-models pagination cap; one page comfortably covers the catalog. */
const GOOGLE_MODELS_PAGE_SIZE = 1e3;
/**
* DashScope-compatible MaaS gateways serve no native `/api/v1/models` route but
* do expose the OpenAI-style catalog beside it. Returns undefined for an
* endpoint that is not an absolute URL.
*/
function dashscopeCompatibleModelsUrl(endpoint) {
	try {
		return `${new URL(endpoint).origin}/compatible-mode/v1/models`;
	} catch {
		return;
	}
}
/** DashScope catalog filter: the Qwen-Image and Wan (wanx / wan2.x) families. */
function filterDashScopeImageModelIds(ids) {
	return ids.filter((id) => /qwen-image|wanx|wan\d/i.test(id));
}
/** Fetch with the shared timeout and classify the outcome; secrets never leave redacted. */
async function fetchClassifiedJson(url, headers, apiKey, signal) {
	const response = await fetch(url, {
		method: "GET",
		headers,
		signal: signal ?? AbortSignal.timeout(PROBE_TIMEOUT_MS),
		redirect: "follow"
	}).catch((error) => {
		throw new Error(error instanceof Error ? error.message : String(error));
	});
	if (response.ok) return {
		ok: true,
		payload: await response.json().catch(() => null)
	};
	if (response.status === 401 || response.status === 403) return {
		ok: false,
		reason: "unauthorized"
	};
	const text = await response.text().catch(() => "");
	return {
		ok: false,
		reason: "error",
		status: response.status,
		message: `HTTP ${String(response.status)}${text.length > 0 ? `: ${redactSecrets(text, apiKey).slice(0, 300)}` : ""}`
	};
}
/** Pull and filter the image-capable models from the Google endpoint. */
async function fetchGoogleImageModels(config, apiKey, signal) {
	if (apiKey === void 0) return {
		ok: false,
		reason: "missing-key"
	};
	const url = new URL(googleModelsUrl(config));
	url.searchParams.set("pageSize", String(GOOGLE_MODELS_PAGE_SIZE));
	const result = await fetchClassifiedJson(url, { "x-goog-api-key": apiKey }, apiKey, signal);
	if (!result.ok) return result;
	return {
		ok: true,
		models: filterImageModelIds(parseGoogleModelIds(result.payload))
	};
}
/** Pull and filter image-capable models from an OpenAI-compatible endpoint (official, relay, Ark, xAI, Zhipu). */
async function fetchOpenAIImageModels(provider, config, apiKey, signal) {
	if (apiKey === void 0) return {
		ok: false,
		reason: "missing-key"
	};
	const configured = provider === "openai" ? config.openaiBaseURL?.trim() ?? "" : provider === "openai-compat" ? config.openaiCompatBaseURL?.trim() ?? "" : provider === "seedream" ? config.seedreamBaseURL?.trim() ?? "" : provider === "xai" ? config.xaiBaseURL?.trim() ?? "" : config.zhipuBaseURL?.trim() ?? "";
	const fallback = provider === "openai" ? DEFAULT_OPENAI_BASE_URL : provider === "seedream" ? DEFAULT_SEEDREAM_BASE_URL : provider === "xai" ? DEFAULT_XAI_BASE_URL : provider === "zhipu" ? DEFAULT_ZHIPU_BASE_URL : "";
	const base = configured.length > 0 ? configured : fallback;
	if (base.length === 0) return {
		ok: false,
		reason: "error",
		message: "Base URL is not configured"
	};
	const result = await fetchClassifiedJson(joinUrl(base, provider === "xai" ? "image-generation-models" : "models"), { authorization: `Bearer ${apiKey}` }, apiKey, signal);
	if (!result.ok) return result;
	const ids = parseOpenAIModelIds(result.payload);
	return {
		ok: true,
		models: provider === "openai" ? filterOpenAIImageModelIds(ids) : provider === "openai-compat" ? filterRelayImageModelIds(ids) : provider === "seedream" ? filterSeedreamImageModelIds(ids) : provider === "xai" ? ids : filterZhipuImageModelIds(ids)
	};
}
/** Pull and filter image-capable models from the DashScope native model list (`capabilities=IG`). */
async function fetchDashScopeImageModels(config, apiKey, signal, provider = "dashscope") {
	if (apiKey === void 0) return {
		ok: false,
		reason: "missing-key"
	};
	const configured = (provider === "qwen-token-plan" ? config.qwenTokenPlanEndpoint : config.dashscopeEndpoint)?.trim() ?? "";
	const base = configured.length > 0 ? configured : provider === "qwen-token-plan" ? DEFAULT_QWEN_TOKEN_PLAN_ENDPOINT : DEFAULT_DASHSCOPE_ENDPOINT;
	const url = new URL(joinUrl(base, "models"));
	url.searchParams.set("capabilities", "IG");
	url.searchParams.set("page_no", "1");
	url.searchParams.set("page_size", "100");
	const result = await fetchClassifiedJson(url, { authorization: `Bearer ${apiKey}` }, apiKey, signal);
	if (result.ok) return {
		ok: true,
		models: parseDashScopeImageModelIds(result.payload)
	};
	if (result.status === 404 || result.status === 405) {
		const compatible = dashscopeCompatibleModelsUrl(base);
		if (compatible !== void 0) {
			const listed = await fetchClassifiedJson(compatible, { authorization: `Bearer ${apiKey}` }, apiKey, signal);
			if (listed.ok) return {
				ok: true,
				models: filterDashScopeImageModelIds(parseOpenAIModelIds(listed.payload))
			};
			if (listed.reason === "unauthorized") return listed;
		}
		return {
			ok: false,
			reason: "error",
			message: "该端点不提供 /models 列表，请手工填写模型名（例如 qwen-image-2.0）"
		};
	}
	return result;
}
/**
* Probe a DashScope-compatible endpoint that serves no model catalog: the
* OpenAI-style list beside the native base first, then the native image route
* itself. A 400 from that route proves endpoint, credential, and model name are
* all accepted (the request is refused only for its missing `input`), which is
* exactly what a connectivity probe is asking.
*/
async function probeDashScopeWithoutCatalog(provider, config, apiKey, signal) {
	const configured = (provider === "qwen-token-plan" ? config.qwenTokenPlanEndpoint : config.dashscopeEndpoint)?.trim() ?? "";
	const base = configured.length > 0 ? configured : provider === "qwen-token-plan" ? DEFAULT_QWEN_TOKEN_PLAN_ENDPOINT : DEFAULT_DASHSCOPE_ENDPOINT;
	const compatible = dashscopeCompatibleModelsUrl(base);
	if (compatible !== void 0) {
		const listed = await fetchClassifiedJson(compatible, { authorization: `Bearer ${apiKey}` }, apiKey, signal);
		if (listed.ok) return { ok: true };
		if (listed.reason === "unauthorized") return listed;
	}
	const configuredModel = (provider === "qwen-token-plan" ? config.qwenTokenPlanModel : config.dashscopeModel)?.trim() ?? "";
	const model = configuredModel.length > 0 ? configuredModel : provider === "qwen-token-plan" ? DEFAULT_QWEN_TOKEN_PLAN_MODEL : DEFAULT_DASHSCOPE_MODEL;
	const response = await fetch(`${base.replace(/\/+$/, "")}/services/aigc/multimodal-generation/generation`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({ model }),
		signal: signal ?? AbortSignal.timeout(PROBE_TIMEOUT_MS)
	}).catch((error) => {
		throw new Error(error instanceof Error ? error.message : String(error));
	});
	if (response.status === 400) return { ok: true };
	if (response.status === 401 || response.status === 403) return {
		ok: false,
		reason: "unauthorized"
	};
	const text = await response.text().catch(() => "");
	return {
		ok: false,
		reason: "error",
		message: `HTTP ${String(response.status)}${text.length > 0 ? `: ${redactSecrets(text, apiKey).slice(0, 200)}` : ""}`
	};
}
/** Run one provider probe and classify the outcome; secrets never leave redacted. */
async function probeProviderConnection(provider, config, apiKey, signal) {
	if (apiKey === void 0) return {
		ok: false,
		reason: "missing-key"
	};
	if (provider === "openai-compat" && (config.openaiCompatBaseURL?.trim() ?? "").length === 0) return {
		ok: false,
		reason: "error",
		message: "Base URL is not configured"
	};
	const target = probeTarget(provider, config, apiKey);
	const result = await fetchClassifiedJson(target.url, target.headers, apiKey, signal);
	if (result.ok) return { ok: true };
	if ((provider === "dashscope" || provider === "qwen-token-plan") && (result.status === 404 || result.status === 405)) return probeDashScopeWithoutCatalog(provider, config, apiKey, signal);
	return result;
}
/** Probe the local ComfyUI service without any credential. */
async function probeComfyUIConnection(config, signal) {
	const target = probeTarget("comfyui", config);
	const response = await fetch(target.url, {
		method: "GET",
		signal: signal ?? AbortSignal.timeout(PROBE_TIMEOUT_MS),
		redirect: "follow"
	}).catch((error) => {
		throw new Error(error instanceof Error ? error.message : String(error));
	});
	if (response.ok) return { ok: true };
	return {
		ok: false,
		reason: "error",
		message: `HTTP ${String(response.status)}`
	};
}
/**
* Probe a subscription provider: the internal manager's login state for the
* matching vendor. No network call and no token access; the probe reports
* signed-in (with the account email) or signed-out guidance.
*/
async function probeSubscriptionConnection(provider, manager) {
	const vendor = provider === "chatgpt-sub" ? "codex" : provider === "google-sub" ? "antigravity" : "grok";
	const display = provider === "chatgpt-sub" ? "ChatGPT" : provider === "google-sub" ? "Google" : "Grok";
	const status = await manager.loginStatus(vendor);
	if (status.state === "logged-in") return { ok: true };
	if (status.state === "logged-out") return {
		ok: false,
		reason: "missing-key",
		message: `${display} 账号未登录：请在设置卡片中点击“登录”完成授权`
	};
	return {
		ok: false,
		reason: "error",
		message: "登录状态读取失败"
	};
}
/** Serve the settings card's per-provider connectivity probe. */
async function serveTestConnection(req, res, deps) {
	if (!sameOrigin(req)) return jsonError(res, 403, "origin-rejected");
	if (req.method !== "POST") return jsonError(res, 405, "method-not-allowed");
	if (!(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) return jsonError(res, 415, "json-required");
	let body;
	try {
		body = JSON.parse(await readBody(req));
	} catch {
		return jsonError(res, 400, "invalid-request");
	}
	const provider = record(body)?.provider;
	if (typeof provider !== "string" || !IMAGE_PROVIDERS.includes(provider)) return jsonError(res, 400, "invalid-provider");
	const active = provider;
	if (record(body)?.action === "models") {
		if (active === "comfyui" || isSubscriptionProvider(active)) return jsonError(res, 400, "models-unsupported");
		let result;
		try {
			const apiKey = await deps.resolveKey(active);
			result = active === "google" ? await fetchGoogleImageModels(deps.config(), apiKey) : active === "dashscope" || active === "qwen-token-plan" ? await fetchDashScopeImageModels(deps.config(), apiKey, void 0, active) : await fetchOpenAIImageModels(active, deps.config(), apiKey);
		} catch (error) {
			result = {
				ok: false,
				reason: "error",
				message: error instanceof Error ? error.message : String(error)
			};
		}
		return json(res, 200, result);
	}
	let result;
	try {
		if (active === "comfyui") result = await probeComfyUIConnection(deps.config());
		else if (isSubscriptionProvider(active)) result = await probeSubscriptionConnection(active, deps.subscriptionManager);
		else {
			const apiKey = await deps.resolveKey(active);
			result = await probeProviderConnection(active, deps.config(), apiKey);
		}
	} catch (error) {
		result = {
			ok: false,
			reason: "error",
			message: error instanceof Error ? error.message : String(error)
		};
	}
	json(res, 200, result);
}
function sameOrigin(req) {
	const origin = req.headers.origin;
	const host = req.headers.host;
	return origin === void 0 || host === void 0 || origin === `http://${host}` || origin === `https://${host}`;
}
function record(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
async function readBody(req) {
	const chunks = [];
	let bytes = 0;
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		bytes += buffer.byteLength;
		if (bytes > MAX_BODY_BYTES) throw new Error("request too large");
		chunks.push(buffer);
	}
	return Buffer.concat(chunks).toString("utf8");
}
function json(res, status, value) {
	if (res.headersSent || res.writableEnded || res.destroyed) return;
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	res.end(JSON.stringify(value));
}
function jsonError(res, status, code) {
	if (res.headersSent || res.writableEnded || res.destroyed) return;
	json(res, status, { error: code });
}
//#endregion
//#region lib/types/index.js
const name = "dsh-image-gen";
const inject = [
	"tools",
	"attachments",
	"credentials",
	"webServer"
];
/** Validate the untrusted per-call provider override from tool arguments. */
function providerOverrideOf(value) {
	if (value === void 0 || value === null || value === "") return void 0;
	if (typeof value !== "string" || !IMAGE_PROVIDERS.includes(value)) throw new Error(`Unsupported provider ${JSON.stringify(value)}. Supported providers: ${IMAGE_PROVIDERS.join(", ")}.`);
	return value;
}
/**
* Unwrap the volatile config the Loader hands the plugin on DSH 0.1.6+:
* with the whole Config schema marked volatile, `config` is a stable
* reference cell whose `.get()` always returns the current values (edits
* through the settings form update it in place without remounting). The
* plain-object branch only serves unit tests that call `apply` directly.
*/
function liveConfig(source) {
	const cell = source;
	return (cell !== null && typeof cell === "object" && typeof cell.get === "function" ? cell.get() : source) ?? {};
}
function apply(ctx, config = {}) {
	let current = () => migrateOpenAICompatConfig(liveConfig(config));
	const knownWorkspaceRoots = /* @__PURE__ */ new Set();
	const subscriptionManager = new SubscriptionManager(ctx);
	registerSubscriptionRoutes(ctx, subscriptionManager);
	ctx.inject(["settings"], (settingsCtx) => {
		const configure = settingsCtx.settings.configure;
		if (typeof configure !== "function") return;
		settingsCtx.effect(() => configure.call(settingsCtx.settings, { auto: false }, ctx.fiber), "dsh-image-gen: settings page policy");
	});
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: TEST_CONNECTION_ROUTE,
		handler: (req, res) => serveTestConnection(req, res, {
			resolveKey: (provider) => resolveApiKey(ctx, provider),
			config: () => current(),
			subscriptionManager
		})
	}), "dsh-image-gen: test connection route");
	ctx.tools.register(defineTool({
		name: "generate_image",
		description: "Generate a new image with the configured provider. Use when the user asks to create or draw a new image; use edit_image instead when they want to change an existing image. Give a complete visual prompt including subject, composition, style, lighting, and any exact text that should appear. The optional provider/model arguments switch provider or model for this call only when the user asks for a specific one. A successful image is attached directly to the conversation and may also be saved under the session workspace. Do not call read, glob, or other tools to locate or verify the image.",
		parameters: {
			prompt: {
				type: "string",
				required: true,
				description: "Complete description of the image to generate."
			},
			provider: {
				type: "string",
				enum: [
					"google",
					"openai",
					"openai-compat",
					"seedream",
					"dashscope",
					"qwen-token-plan",
					"xai",
					"zhipu",
					"comfyui",
					"chatgpt-sub",
					"grok-sub",
					"google-sub"
				],
				description: "Optional provider for this call only (for example when the user asks to use a specific provider); omit to use the configured default. chatgpt-sub, grok-sub, and google-sub generate through the logged-in subscription account instead of an API key."
			},
			model: {
				type: "string",
				description: "Optional model name for this call only, overriding the configured model. Not used by ComfyUI (use workflow instead) nor by the subscription providers (model fixed by the subscription)."
			},
			aspect_ratio: {
				type: "string",
				enum: [
					"1:1",
					"3:2",
					"2:3",
					"4:3",
					"3:4",
					"16:9",
					"9:16"
				],
				description: "Optional output aspect ratio. Google Gemini sends it as-is; the Alibaba rows translate it into their own size. Every other provider ignores it, so pass size instead."
			},
			image_size: {
				type: "string",
				enum: [
					"1K",
					"2K",
					"4K"
				],
				description: "Optional output resolution for Google Gemini."
			},
			size: {
				type: "string",
				description: "Optional output size. Google Gemini uses image_size (1K/2K/4K) instead. The Alibaba rows take \"WIDTH*HEIGHT\" (for example 1280*720); every other provider keeps its own form (for example 1024x1024 or 2K)."
			},
			workflow: {
				type: "string",
				description: "Optional name of the ComfyUI workflow to run; omit to use the active workflow from settings. Only meaningful when the ComfyUI provider is selected."
			}
		},
		output: imageOutput("Generated"),
		async execute(args, exec) {
			const active = resolveProvider(withProviderOverrides(current(), providerOverrideOf(args.provider), args.model));
			if (active.provider === "comfyui") {
				const workflow = selectComfyUIWorkflow(active, args.workflow);
				return saveGenerated(ctx, await generateComfyUIImage({
					baseURL: active.baseURL,
					workflowJson: workflow.json,
					prompt: mergeComfyUIPrompt(workflow.presetPrompt, args.prompt),
					timeoutMs: active.timeoutMs,
					maxBytes: ctx.attachments.imageLimits.maxImageBytes,
					signal: exec.signal
				}), active.provider, workflow.name, "API workflow", current(), exec, knownWorkspaceRoots);
			}
			if (active.provider === "chatgpt-sub" || active.provider === "grok-sub" || active.provider === "google-sub") return saveGenerated(ctx, await generateSubscriptionImage({
				manager: subscriptionManager,
				provider: active.provider,
				prompt: args.prompt,
				...args.size !== void 0 ? { size: args.size } : {},
				maxBytes: ctx.attachments.imageLimits.maxImageBytes,
				signal: exec.signal
			}), active.provider, active.model, "subscription", current(), exec, knownWorkspaceRoots);
			const credential = await requireApiKey(ctx, active.provider, "generate_image");
			if (active.provider === "google") {
				const aspectRatio = args.aspect_ratio ?? active.aspectRatio;
				const imageSize = args.image_size ?? active.imageSize;
				return saveGenerated(ctx, await generateGoogleImage({
					apiKey: credential,
					endpoint: active.endpoint,
					model: active.model,
					prompt: args.prompt,
					aspectRatio,
					imageSize,
					maxBytes: ctx.attachments.imageLimits.maxImageBytes,
					signal: exec.signal
				}), active.provider, active.model, `${aspectRatio}, ${imageSize}`, current(), exec, knownWorkspaceRoots);
			}
			if (active.provider === "dashscope" || active.provider === "qwen-token-plan") {
				const size = args.size ?? alibabaAspectSize(args.aspect_ratio) ?? active.imageSize;
				return saveGenerated(ctx, await generateDashScopeImage({
					apiKey: credential,
					endpoint: active.endpoint,
					model: active.model,
					prompt: args.prompt,
					size,
					maxBytes: ctx.attachments.imageLimits.maxImageBytes,
					signal: exec.signal,
					allowWanModels: active.allowWanModels
				}), active.provider, active.model, size, current(), exec, knownWorkspaceRoots, size);
			}
			const size = args.size ?? active.imageSize;
			const arkOptions = active.provider === "seedream" ? active.arkOptions : void 0;
			return saveGenerated(ctx, await generateOpenAICompatibleImage({
				provider: active.provider,
				apiKey: credential,
				baseURL: active.baseURL,
				model: active.model,
				prompt: args.prompt,
				size,
				maxBytes: ctx.attachments.imageLimits.maxImageBytes,
				signal: exec.signal,
				...arkOptions === void 0 ? {} : { arkOptions }
			}), active.provider, active.model, size, current(), exec, knownWorkspaceRoots, size);
		},
		presentResult: (_args, result) => imagePresentation(result)
	}));
	ctx.tools.register(defineTool({
		name: "edit_image",
		description: "Edit, combine, or restyle existing images with the configured provider. Images attached inline to the latest human message are already readable DSH attachments even when no workspace file exists. In that case, call edit_image immediately with prompt only; NEVER call read_image, glob, or shell to locate them, and NEVER invent @ paths. All inline images will be used in upload order. For specific older conversation images use source_attachment_id or source_attachment_ids; both canonical sha256: IDs and full bare SHA-256 digests are accepted. For files the user explicitly names in the workspace use source_path or source_paths. Provide at most one selector field. Without a selector, images from the latest human message take priority; only when that message has no images does editing fall back to the newest conversation image.",
		parameters: {
			prompt: {
				type: "string",
				required: true,
				description: "Describe the changes to make while preserving everything else that should remain."
			},
			provider: {
				type: "string",
				enum: [
					"google",
					"openai",
					"openai-compat",
					"seedream",
					"dashscope",
					"qwen-token-plan",
					"xai",
					"zhipu",
					"comfyui",
					"chatgpt-sub",
					"grok-sub",
					"google-sub"
				],
				description: "Optional provider for this call only (for example when the user asks to use a specific provider); omit to use the configured default. chatgpt-sub, grok-sub, and google-sub edit images through the logged-in subscription account instead of an API key."
			},
			model: {
				type: "string",
				description: "Optional model name for this call only, overriding the configured model. Not used by ComfyUI (use workflow instead) nor by the subscription providers (model fixed by the subscription)."
			},
			source_attachment_id: {
				type: "string",
				description: "Optional attachment id of a specific image already present in the current conversation."
			},
			source_attachment_ids: {
				type: "array",
				items: { type: "string" },
				description: "Optional ordered attachment ids of multiple images already present in the current conversation. Prompt references such as image 1 and image 2 follow this order."
			},
			source_path: {
				type: "string",
				description: "Optional absolute or workspace-relative path of a specific image file inside the active session workspace. Prefer this when the user names a saved file."
			},
			source_paths: {
				type: "array",
				items: { type: "string" },
				description: "Optional ordered absolute or workspace-relative paths of multiple image files inside the active session workspace."
			},
			aspect_ratio: {
				type: "string",
				enum: [
					"1:1",
					"3:2",
					"2:3",
					"4:3",
					"3:4",
					"16:9",
					"9:16"
				],
				description: "Optional output aspect ratio. Google Gemini sends it as-is; the Alibaba rows translate it into their own size and it wins over the reference image size. Every other provider ignores it, so pass size instead."
			},
			image_size: {
				type: "string",
				enum: [
					"1K",
					"2K",
					"4K"
				],
				description: "Optional output resolution for Google Gemini."
			},
			size: {
				type: "string",
				description: "Optional output size. Google Gemini uses image_size (1K/2K/4K) instead. The Alibaba rows take \"WIDTH*HEIGHT\" (for example 1280*720) and otherwise keep the reference image size; every other provider keeps its own form (for example 1024x1024 or 2K)."
			},
			workflow: {
				type: "string",
				description: "Optional name of the ComfyUI workflow to run; omit to use the active workflow from settings. Only meaningful when the ComfyUI provider is selected."
			}
		},
		output: imageOutput("Edited"),
		async execute(args, exec) {
			const active = resolveProvider(withProviderOverrides(current(), providerOverrideOf(args.provider), args.model));
			const sourceImages = await resolveReferenceImages({
				...exec.agent === void 0 ? {} : { agent: exec.agent },
				attachments: ctx.attachments,
				...typeof args.source_attachment_id === "string" ? { sourceAttachmentId: args.source_attachment_id } : {},
				...Array.isArray(args.source_attachment_ids) ? { sourceAttachmentIds: args.source_attachment_ids } : {},
				...typeof args.source_path === "string" ? { sourcePath: args.source_path } : {},
				...Array.isArray(args.source_paths) ? { sourcePaths: args.source_paths } : {},
				maxBytes: ctx.attachments.imageLimits.maxImageBytes,
				signal: exec.signal
			});
			if (active.provider === "comfyui") {
				if (sourceImages.length > 1) throw new Error(`ComfyUI edit_image supports exactly one source image per call; this call resolved ${String(sourceImages.length)} images. Call edit_image again with source_attachment_id set to the single attachment ID of the image to edit.`);
				const sourceImage = sourceImages[0];
				if (sourceImage === void 0) throw new Error("edit_image requires a reference image");
				const workflow = selectComfyUIWorkflow(active, args.workflow);
				return saveGenerated(ctx, await editComfyUIImage({
					baseURL: active.baseURL,
					workflowJson: workflow.json,
					prompt: mergeComfyUIPrompt(workflow.presetPrompt, args.prompt),
					sourceImage: {
						data: sourceImage.data,
						mediaType: sourceImage.mediaType
					},
					timeoutMs: active.timeoutMs,
					maxBytes: ctx.attachments.imageLimits.maxImageBytes,
					signal: exec.signal
				}), active.provider, workflow.name, "API workflow", current(), exec, knownWorkspaceRoots);
			}
			if (active.provider === "chatgpt-sub" || active.provider === "grok-sub" || active.provider === "google-sub") {
				if (sourceImages.length === 0) throw new Error("edit_image requires a reference image");
				return saveGenerated(ctx, await generateSubscriptionImage({
					manager: subscriptionManager,
					provider: active.provider,
					prompt: args.prompt,
					sourceImages,
					...args.size !== void 0 ? { size: args.size } : {},
					maxBytes: ctx.attachments.imageLimits.maxImageBytes,
					signal: exec.signal
				}), active.provider, active.model, "subscription edit", current(), exec, knownWorkspaceRoots);
			}
			const credential = await requireApiKey(ctx, active.provider, "edit_image");
			if (active.provider === "google") {
				const aspectRatio = args.aspect_ratio ?? active.aspectRatio;
				const imageSize = args.image_size ?? active.imageSize;
				return saveGenerated(ctx, await editGoogleImage({
					apiKey: credential,
					endpoint: active.endpoint,
					model: active.model,
					prompt: args.prompt,
					sourceImages,
					aspectRatio,
					imageSize,
					maxBytes: ctx.attachments.imageLimits.maxImageBytes,
					signal: exec.signal
				}), active.provider, active.model, `${aspectRatio}, ${imageSize}`, current(), exec, knownWorkspaceRoots);
			}
			const size = args.size ?? active.imageSize;
			if (active.provider === "openai" || active.provider === "openai-compat" || active.provider === "xai" || active.provider === "zhipu") return saveGenerated(ctx, await editOpenAICompatibleImage({
				apiKey: credential,
				baseURL: active.baseURL,
				model: active.model,
				prompt: args.prompt,
				sourceImages,
				size,
				maxBytes: ctx.attachments.imageLimits.maxImageBytes,
				signal: exec.signal,
				...active.provider === "openai-compat" ? {
					editFormat: active.editFormat,
					editExtra: active.editExtra
				} : {}
			}), active.provider, active.model, size, current(), exec, knownWorkspaceRoots, size);
			if (active.provider === "seedream") return saveGenerated(ctx, await editSeedreamImage({
				apiKey: credential,
				baseURL: active.baseURL,
				model: active.model,
				prompt: args.prompt,
				sourceImages,
				size,
				maxBytes: ctx.attachments.imageLimits.maxImageBytes,
				signal: exec.signal,
				arkOptions: active.arkOptions
			}), active.provider, active.model, size, current(), exec, knownWorkspaceRoots, size);
			const editSize = args.size ?? alibabaAspectSize(args.aspect_ratio) ?? alibabaEditSize(sourceImages, active.model);
			return saveGenerated(ctx, await editDashScopeImage({
				apiKey: credential,
				endpoint: active.endpoint,
				model: active.model,
				prompt: args.prompt,
				sourceImages,
				...editSize === void 0 ? {} : { size: editSize },
				maxBytes: ctx.attachments.imageLimits.maxImageBytes,
				signal: exec.signal,
				allowWanModels: active.allowWanModels
			}), active.provider, active.model, editSize ?? "auto (source aspect)", current(), exec, knownWorkspaceRoots, editSize);
		},
		presentResult: (_args, result) => imagePresentation(result)
	}));
}
function imageOutput(verb) {
	return {
		schema: {
			type: "object",
			additionalProperties: false,
			properties: {
				attachment: {
					type: "object",
					required: true,
					additionalProperties: false,
					properties: {
						attachmentId: {
							type: "string",
							required: true
						},
						mediaType: {
							type: "string",
							required: true
						},
						bytes: {
							type: "integer",
							required: true
						},
						width: {
							type: "integer",
							required: true
						},
						height: {
							type: "integer",
							required: true
						},
						name: { type: "string" },
						originalDimensions: {
							type: "object",
							additionalProperties: false,
							properties: {
								width: {
									type: "integer",
									required: true
								},
								height: {
									type: "integer",
									required: true
								}
							}
						}
					}
				},
				provider: {
					type: "string",
					required: true
				},
				model: {
					type: "string",
					required: true
				},
				output: {
					type: "string",
					required: true
				},
				savedTo: { type: "string" },
				saveError: { type: "string" },
				sizeWarning: { type: "string" },
				seed: { type: "integer" }
			}
		},
		render: (_args, value) => {
			const saved = typeof value.savedTo === "string" ? ` It was also saved to the workspace as ${value.savedTo}.` : typeof value.saveError === "string" ? ` Saving it to the workspace failed: ${value.saveError}.` : " It has no local file path.";
			const action = verb === "Generated" ? "It is already attached to the conversation." : "The edited image is attached to the conversation.";
			const warning = typeof value.sizeWarning === "string" ? ` WARNING: ${value.sizeWarning}` : "";
			return [{
				type: "text",
				text: `${verb} one image with ${value.provider}/${value.model} (${value.output}).${warning} Attachment ID: ${String(value.attachment.attachmentId)}. ${action}${saved} Respond to the user without reading or searching for the image.`
			}, {
				type: "image",
				attachment: value.attachment
			}];
		},
		presentationMeta: (args, value) => ({
			kind: "dsh-image-gen",
			attachment: attachmentMeta(value.attachment),
			provider: value.provider,
			model: value.model,
			output: value.output,
			...value.sizeWarning === void 0 ? {} : { sizeWarning: value.sizeWarning },
			...verb === "Edited" ? { operation: "edit" } : {},
			...typeof value.savedTo === "string" ? { savedTo: value.savedTo } : {},
			...typeof value.seed === "number" ? { seed: value.seed } : {},
			prompt: args.prompt
		})
	};
}
function attachmentMeta(ref) {
	return {
		attachmentId: String(ref.attachmentId),
		mediaType: ref.mediaType,
		bytes: ref.bytes,
		width: ref.width,
		height: ref.height,
		...ref.name === void 0 ? {} : { name: ref.name },
		...ref.originalDimensions === void 0 ? {} : { originalDimensions: {
			width: ref.originalDimensions.width,
			height: ref.originalDimensions.height
		} }
	};
}
async function saveGenerated(ctx, generated, provider, model, output, config, exec, knownRoots, expectedSize) {
	if (!ctx.attachments.imageLimits.mediaTypes.includes(generated.mediaType)) throw new Error(`This DSH deployment does not accept ${generated.mediaType} generated images`);
	const attachment = await ctx.attachments.saveImage({
		data: generated.data,
		mediaType: generated.mediaType,
		name: "generated-image"
	});
	const sizeWarning = expectedSize === void 0 ? void 0 : sizeMismatch(expectedSize, attachment);
	const value = {
		attachment,
		provider,
		model,
		output,
		...sizeWarning === void 0 ? {} : { sizeWarning },
		...typeof generated.seed === "number" ? { seed: generated.seed } : {}
	};
	if (config.saveToWorkspace === false) return value;
	const workspaceRoot = exec.agent?.session.header.cwd;
	if (workspaceRoot === void 0) return value;
	knownRoots?.add(workspaceRoot);
	try {
		value.savedTo = await saveImageToWorkspace({
			workspaceRoot,
			folder: config.workspaceFolder,
			attachmentId: attachment.attachmentId,
			mediaType: generated.mediaType,
			data: generated.data,
			signal: exec.signal
		});
	} catch (error) {
		exec.signal.throwIfAborted();
		ctx.logger.warn(`dsh-image-gen: failed to save image to workspace: ${error instanceof Error ? error.message : String(error)}`);
		value.saveError = error instanceof Error ? error.message : String(error);
	}
	return value;
}
function imagePresentation(result) {
	const attachment = imageAttachmentFromMeta(result.meta);
	return attachment === void 0 ? void 0 : {
		card: "generic",
		title: "Generated image",
		content: [{
			type: "image",
			attachment
		}]
	};
}
//#endregion
export { Config, TEST_CONNECTION_ROUTE, apply, imageAttachmentFromMeta, inject, name };
