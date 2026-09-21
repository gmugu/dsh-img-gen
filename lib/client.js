window.__ModuleLoader__.load({
	id: "dsh-image-gen",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region lib/types/shared.js
		/** Browser route the settings card probes provider connectivity through. */
		const TEST_CONNECTION_ROUTE = "/plugins/dsh-image-gen/test";
		const SUBSCRIPTION_LOGIN_ROUTE = "/plugins/dsh-image-gen/subscription-login";
		const SUBSCRIPTION_STATUS_ROUTE = "/plugins/dsh-image-gen/subscription-status";
		/** Namespace persisted through DSH Settings. */
		const IMAGE_GENERATION_NAMESPACE = "image-generation";
		/** Supported providers. */
		const IMAGE_PROVIDERS = [
			"google",
			"openai",
			"openai-compat",
			"seedream",
			"dashscope",
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
		/** Providers supported by the first browser workbench release. */
		const CLOUD_IMAGE_PROVIDERS = [
			"google",
			"openai",
			"openai-compat",
			"seedream",
			"dashscope",
			"xai",
			"zhipu"
		];
		[...CLOUD_IMAGE_PROVIDERS, ...SUBSCRIPTION_PROVIDERS];
		/** The credential reference each cloud provider's API key is stored under. */
		const CLOUD_CREDENTIAL_REFS = {
			google: "GEMINI_API_KEY",
			openai: "OPENAI_API_KEY",
			"openai-compat": "DSH_IMAGE_GEN_OPENAI_COMPAT_KEY",
			seedream: "ARK_API_KEY",
			dashscope: "DASHSCOPE_API_KEY",
			xai: "XAI_API_KEY",
			zhipu: "ZHIPUAI_API_KEY"
		};
		/** The credential reference storing this provider's API key, when it uses one. */
		function cloudCredentialRef(provider) {
			return CLOUD_IMAGE_PROVIDERS.includes(provider) ? CLOUD_CREDENTIAL_REFS[provider] : void 0;
		}
		/** Default endpoints and base URLs. */
		const DEFAULT_GOOGLE_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
		const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
		const DEFAULT_SEEDREAM_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
		const DEFAULT_DASHSCOPE_ENDPOINT = "https://dashscope.aliyuncs.com/api/v1";
		const DEFAULT_XAI_BASE_URL = "https://api.x.ai/v1";
		const DEFAULT_ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
		const DEFAULT_COMFYUI_BASE_URL = "http://127.0.0.1:8188";
		const DEFAULT_COMFYUI_TIMEOUT_MS = 3e5;
		const DEFAULT_COMFYUI_WORKFLOW_LABEL = "API workflow";
		/** Default model names. */
		const DEFAULT_GOOGLE_MODEL = "gemini-3.1-flash-image";
		const DEFAULT_OPENAI_MODEL = "gpt-image-2";
		const DEFAULT_SEEDREAM_MODEL = "doubao-seedream-5-0-260128";
		const DEFAULT_DASHSCOPE_MODEL = "qwen-image-3.0";
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
		/** Derive a workflow label that does not collide with the given existing names. */
		function uniqueComfyUIWorkflowName(name, existing) {
			const base = name.trim().length > 0 ? name.trim() : DEFAULT_COMFYUI_WORKFLOW_LABEL;
			if (!existing.includes(base)) return base;
			for (let index = 2;; index += 1) {
				const candidate = `${base} (${index})`;
				if (!existing.includes(candidate)) return candidate;
			}
		}
		/** Default models for the subscription channels; fixed by the bridge protocol. */
		const DEFAULT_SUBSCRIPTION_MODELS = {
			"chatgpt-sub": "gpt-image-2.5-flare",
			"grok-sub": "grok-imagine-image-2.0",
			"google-sub": "gemini-3-pro-image"
		};
		const DEFAULT_MODELS = {
			google: DEFAULT_GOOGLE_MODEL,
			openai: DEFAULT_OPENAI_MODEL,
			"openai-compat": "",
			seedream: DEFAULT_SEEDREAM_MODEL,
			dashscope: DEFAULT_DASHSCOPE_MODEL,
			xai: DEFAULT_XAI_MODEL,
			zhipu: DEFAULT_ZHIPU_MODEL,
			comfyui: DEFAULT_COMFYUI_WORKFLOW_LABEL,
			"chatgpt-sub": DEFAULT_SUBSCRIPTION_MODELS["chatgpt-sub"],
			"grok-sub": DEFAULT_SUBSCRIPTION_MODELS["grok-sub"],
			"google-sub": DEFAULT_SUBSCRIPTION_MODELS["google-sub"]
		};
		const DEFAULT_BASE_URLS = {
			google: DEFAULT_GOOGLE_ENDPOINT,
			openai: DEFAULT_OPENAI_BASE_URL,
			"openai-compat": "",
			seedream: DEFAULT_SEEDREAM_BASE_URL,
			dashscope: DEFAULT_DASHSCOPE_ENDPOINT,
			xai: DEFAULT_XAI_BASE_URL,
			zhipu: DEFAULT_ZHIPU_BASE_URL,
			comfyui: DEFAULT_COMFYUI_BASE_URL,
			"chatgpt-sub": "",
			"grok-sub": "",
			"google-sub": ""
		};
		//#endregion
		//#region lib/types/comfyui-workflow.js
		/** Pure ComfyUI API-workflow validation and placeholder injection. */
		const COMFYUI_PROMPT_PLACEHOLDER = "{{prompt}}";
		const COMFYUI_IMAGE_PLACEHOLDER = "{{image}}";
		/** Legacy single-percent placeholders from early releases, still accepted. */
		const LEGACY_PROMPT_PLACEHOLDER = "%prompt%";
		const LEGACY_IMAGE_PLACEHOLDER = "%image%";
		/** LoadImage-style input key that receives the uploaded source image name. */
		const IMAGE_INPUT_KEY = "image";
		/** Validate imported JSON without exposing workflow graph details to callers. */
		function validateComfyUIWorkflowJson(workflowJson) {
			const imageInputs = countImagePlaceholders(parseWorkflow(workflowJson));
			if (imageInputs > 1) throw new Error(`ComfyUI workflow must contain at most one ${COMFYUI_IMAGE_PLACEHOLDER} image input; found ${String(imageInputs)}`);
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
				const inputs = record(node)?.inputs;
				return inputs !== void 0 && containsPromptPlaceholder(inputs);
			})) throw new Error(`ComfyUI workflow must contain ${COMFYUI_PROMPT_PLACEHOLDER} (or ${LEGACY_PROMPT_PLACEHOLDER}) in a text input`);
			return value;
		}
		/** Count `inputs.image` fields that are exactly an image placeholder. */
		function countImagePlaceholders(workflow) {
			let count = 0;
			for (const node of Object.values(workflow)) {
				const inputs = record(record(node)?.inputs);
				if (inputs !== void 0 && isImagePlaceholder(inputs[IMAGE_INPUT_KEY])) count += 1;
			}
			return count;
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
		function record(value) {
			return isRecord(value) ? value : void 0;
		}
		//#endregion
		//#region lib/types/client/index.js
		const DICT = {
			zh: {
				title: "图像生成",
				description: "配置各 Provider 的 Key 与模型，并选择默认 Provider。",
				defaultProvider: "默认 Provider",
				defaultProviderHint: "Agent 生图默认使用；Studio 与工具调用可临时指定其他 Provider。",
				settingsReadOnly: "设置由配置文件提供，只读；如需修改请编辑对应的配置来源。",
				providerGoogle: "Google Gemini",
				providerOpenAI: "OpenAI",
				providerOpenAICompat: "OpenAI 兼容（中转站）",
				providerSeedream: "字节 Seedream",
				providerDashScope: "阿里 DashScope (通义万相 / Qwen)",
				providerXAI: "xAI Grok Imagine",
				providerZhipu: "智谱 GLM-Image",
				providerComfyUI: "本地 ComfyUI",
				providerChatGPTSub: "ChatGPT 订阅",
				providerGrokSub: "Grok 订阅",
				providerGoogleSub: "Google 订阅",
				subBadgeLoggedIn: "已登录",
				subBadgeLoggedOut: "未登录",
				subBadgeUnknown: "状态未知",
				subSectionTitle: "订阅生图",
				subHint: "通过已登录的订阅账号生图，无需 API Key。登录在你的授权下进行，不会修改任何 API Key 或默认 Provider。",
				subAccountLabel: "账号",
				subAccountEmail: "已登录：{email}",
				subAccountNone: "未登录",
				subLogin: "登录",
				subLoggingIn: "正在登录…",
				subLogout: "退出登录",
				subLoggingOut: "正在退出…",
				subWaitingLogin: "已打开授权页面，请在浏览器中完成登录…",
				subLoginOk: "登录成功",
				subModelLabel: "订阅模型",
				subModelHint: "由订阅通道固定，不可更改。",
				subEditCapability: "订阅生图 · 图生图：支持。对话 edit_image、Studio 图生图与多模型对比均可上传参考图（最多 5 张）。",
				subDefaultHint: "订阅 Provider 已支持文字生图与图生图；图生图使用各订阅渠道默认参数。",
				apiKeyLabel: "{provider} API Key",
				apiKeyPlaceholder: "留空即可保留已配置的 Key",
				apiKeyHint: "安全保存为 {key}；页面不会读回明文。",
				keyReadOnly: "Key 由 {source} 提供且只读；请在该来源中修改。",
				credentialsUnavailable: "凭据服务不可用，无法保存 API Key；建议升级 DSH 到稳定版本。",
				badgeUnavailable: "凭据服务不可用",
				badgeChecking: "检查中…",
				badgeConfigured: "Key 已配置",
				badgeMissing: "Key 未配置",
				badgeUnknown: "状态未知",
				comfyuiNoKey: "无需 API Key",
				testConnection: "测试连接",
				testing: "正在测试…",
				testOk: "连接成功",
				testFailed: "连接失败",
				testUnauthorized: "Key 无效或无权限",
				clearKey: "清除 Key",
				keyCleared: "已清除 Key",
				clearKeyFailed: "清除 Key 失败",
				saveKeyFailed: "保存 Key 失败",
				saveKeyFirst: "请先保存 API Key，再拉取模型或测试连接。",
				clearKeyUnsupported: "当前版本 DSH 不支持在此清除 Key，请到凭据管理中删除。",
				endpoint: "接口地址",
				reset: "重置",
				resetTitle: "重置为默认官方地址",
				endpointHintGoogle: "Google 官方地址或反代端点（全路径）。",
				endpointHintOpenAI: "官方 api.openai.com 的 /v1 地址；中转站请使用下方「OpenAI 兼容」行。",
				endpointHintOpenAICompat: "中转站/自建服务的 OpenAI 兼容 /v1 地址（必填），例如 https://your-relay.example.com/v1。",
				editFormat: "图生图请求形态",
				editFormatMultipart: "标准 multipart（OpenAI 官方）",
				editFormatJsonImageUrlArray: "JSON images 数组（商汤等中转）",
				editFormatHint: "文生图不受影响。仅当中转站的图生图接口使用自有 JSON 契约（如商汤 SenseNova）时才需要切换。",
				editExtra: "附加 JSON 字段",
				editExtraPlaceholder: "{\"watermark\": false, \"prompt_extend\": true}",
				editExtraHint: "仅 JSON 形态生效；会合并到请求体末尾，可覆盖默认字段。留空表示不附加。",
				arkOutputFormat: "输出格式",
				arkOutputFormatPng: "PNG（无损，带透明通道）",
				arkOutputFormatJpeg: "JPEG（方舟默认，有损）",
				arkOutputFormatHint: "JPEG 会在主体边缘留下压缩色斑，抠图时变成难去掉的彩色毛边。要后期加工就选 PNG。",
				arkWatermark: "AI 生成水印",
				arkWatermarkOn: "添加（方舟默认）",
				arkWatermarkOff: "不添加",
				arkWatermarkHint: "方舟默认在右下角烙上“AI 生成”标识。做游戏素材或需要后期处理时关掉。",
				arkBackground: "背景",
				arkBackgroundOpaque: "不透明（方舟默认）",
				arkBackgroundTransparent: "透明",
				arkBackgroundHint: "仅图生图有效，且要求参考图本身带透明通道；文生图会被方舟拒绝，因此这一项只在图生图时发出。",
				editExtraInvalid: "附加 JSON 字段必须是合法的 JSON 对象。",
				endpointHintSeedream: "火山方舟兼容的 /api/v3 地址。",
				endpointHintDashScope: "阿里云百炼 DashScope 官方接口地址。",
				endpointHintXAI: "xAI 官方 api.x.ai 的 /v1 地址。",
				endpointHintZhipu: "智谱开放平台 open.bigmodel.cn 的 /api/paas/v4 地址。",
				endpointHintComfyUI: "正在运行且 DSH Host 可以访问的 ComfyUI 地址，默认使用本机 8188 端口。",
				model: "模型",
				workflow: "API Workflow 工作流",
				workflowImport: "导入 JSON 文件",
				workflowMissing: "尚未导入工作流",
				workflowImported: "已导入 {name}",
				workflowHint: "从 ComfyUI 导出 API Format JSON，在提示词输入写入 {{prompt}}，种子可用 {{seed}}；图生图工作流在 LoadImage 的 image 输入写入 {{image}}（仅一次）。可导入多个工作流，Agent 也能在调用时按名称指定。",
				workflowTooLarge: "工作流文件不能超过 5 MB。",
				workflowActiveTitle: "设为当前使用的工作流",
				workflowRemove: "删除",
				workflowPresetPlaceholder: "预设提示词，留空则只用对话内容",
				workflowPresetTitle: "预设提示词：每次调用此工作流时自动加在用户提示词前面。",
				workflowNameRequired: "工作流名称不能为空。",
				workflowDuplicateName: "工作流名称不能重复。",
				timeout: "生成超时（秒）",
				timeoutHint: "包括提交、等待和下载图片；默认 300 秒。",
				workspaceSection: "工作区",
				saveToWorkspace: "保存到工作区",
				saveToWorkspaceHint: "每次生成后，把图片文件保存到当前会话工作区。",
				folder: "工作区文件夹",
				folderHint: "相对当前会话工作区的子目录；留空表示工作区根目录。",
				fetchModels: "拉取模型",
				fetchingModels: "拉取中…",
				fetchModelsHint: "点击「拉取模型」用当前 Key 获取可用生图模型列表；也可手动输入。",
				modelPick: "从已拉取的模型中选择",
				modelPickPlaceholder: "选择模型…（已拉取 {count} 个）",
				modelPickCurrent: "（当前）",
				modelsFound: "找到 {n} 个生图模型，点击模型框选择",
				modelsNone: "未筛出生图模型，可手动输入模型名",
				saving: "保存中…",
				save: "保存",
				saved: "已保存",
				savedToPath: "已保存到",
				generating: "正在生成图片…",
				loading: "正在加载图片…",
				loadFailed: "图片读取失败 ({status})",
				generatedTitle: "已生成图片",
				resultShown: "图片结果已显示在对话中",
				copyImg: "复制图片",
				download: "下载图片",
				openNewTab: "新标签页打开",
				copiedImage: "已复制图片",
				copyFailed: "复制失败",
				regenerate: "重新生成",
				regenerateTitle: "重新生成图片",
				regenerateHint: "如有需要可微调提示词。生成的新图片将替代当前展示，原图依然可在版本中查看。",
				prompt: "提示词",
				cancel: "取消",
				confirmRegenerate: "确认生成",
				regenerating: "重新生成中…",
				regenerateFailed: "重新生成失败",
				regenerateSaveFailed: "已重新生成，但保存到图库失败，请重试",
				versionPrevious: "上一版本",
				versionNext: "下一版本",
				versionLabel: "图片版本 {current}/{total}"
			},
			en: {
				title: "Image Generation",
				description: "Configure each provider key and model, then pick the default provider.",
				defaultProvider: "Default provider",
				defaultProviderHint: "Used by the Agent by default; the Studio and tool calls can switch per call.",
				settingsReadOnly: "Settings come from a profile file and are read-only; edit that source to change them.",
				providerGoogle: "Google Gemini",
				providerOpenAI: "OpenAI",
				providerOpenAICompat: "OpenAI-compatible (relay)",
				providerSeedream: "ByteDance Seedream",
				providerDashScope: "Aliyun DashScope (Wanx / Qwen)",
				providerXAI: "xAI Grok Imagine",
				providerZhipu: "Zhipu GLM-Image",
				providerComfyUI: "Local ComfyUI",
				providerChatGPTSub: "ChatGPT Subscription",
				providerGrokSub: "Grok Subscription",
				providerGoogleSub: "Google Subscription",
				subBadgeLoggedIn: "Signed in",
				subBadgeLoggedOut: "Signed out",
				subBadgeUnknown: "Unknown",
				subSectionTitle: "Subscription generation",
				subHint: "Generates through a logged-in subscription account; no API key needed. Signing in never changes any API key or the default provider.",
				subAccountLabel: "Account",
				subAccountEmail: "Signed in: {email}",
				subAccountNone: "Not signed in",
				subLogin: "Sign in",
				subLoggingIn: "Signing in…",
				subLogout: "Sign out",
				subLoggingOut: "Signing out…",
				subWaitingLogin: "Authorization page opened; complete sign-in in your browser…",
				subLoginOk: "Signed in",
				subModelLabel: "Subscription model",
				subModelHint: "Fixed by the subscription channel; not changeable.",
				subEditCapability: "Subscription image editing is now supported: edit_image in chats, Studio and multi-model compare all accept reference images (up to 5).",
				subDefaultHint: "Subscription providers support both text-to-image and image editing; edits use each channel's default parameters.",
				apiKeyLabel: "{provider} API Key",
				apiKeyPlaceholder: "Leave empty to keep configured key",
				apiKeyHint: "Securely saved as {key}; never read back in plaintext.",
				keyReadOnly: "Key is supplied read-only by {source}; update it there.",
				credentialsUnavailable: "Credentials service unavailable: API keys cannot be saved; please upgrade DSH to a stable release.",
				badgeUnavailable: "Credentials unavailable",
				badgeChecking: "Checking…",
				badgeConfigured: "Key set",
				badgeMissing: "Key missing",
				badgeUnknown: "Unknown",
				comfyuiNoKey: "No API key needed",
				testConnection: "Test connection",
				testing: "Testing…",
				testOk: "Connection OK",
				testFailed: "Connection failed",
				testUnauthorized: "API key rejected",
				clearKey: "Clear key",
				keyCleared: "Key cleared",
				clearKeyFailed: "Failed to clear key",
				saveKeyFailed: "Failed to save the key",
				saveKeyFirst: "Save the API key first, then fetch models or test the connection.",
				clearKeyUnsupported: "This DSH build cannot clear keys here; remove it from credential management instead.",
				endpoint: "Endpoint / Base URL",
				reset: "Reset",
				resetTitle: "Reset to official default URL",
				endpointHintGoogle: "Official Google endpoint or reverse proxy (full path).",
				endpointHintOpenAI: "Official api.openai.com /v1 base URL; for relays use the \"OpenAI-compatible\" row below.",
				endpointHintOpenAICompat: "OpenAI-compatible /v1 base URL of your relay or self-hosted service (required), e.g. https://your-relay.example.com/v1.",
				editFormat: "Edit request format",
				editFormatMultipart: "Standard multipart (official OpenAI)",
				editFormatJsonImageUrlArray: "JSON images array (SenseNova etc.)",
				editFormatHint: "Text-to-image is unaffected. Only switch when the relay runs image edits on its own JSON contract (e.g. SenseNova); size is pinned to \"auto\" in this format (the only value SenseNova's edits endpoint accepts) and can be overridden via extra fields.",
				editExtra: "Extra JSON fields",
				editExtraPlaceholder: "{\"watermark\": false, \"prompt_extend\": true}",
				editExtraHint: "Only used with the JSON format; merged into the request body last and may override defaults. Leave empty for none.",
				arkOutputFormat: "Output format",
				arkOutputFormatPng: "PNG (lossless, keeps an alpha channel)",
				arkOutputFormatJpeg: "JPEG (Ark default, lossy)",
				arkOutputFormatHint: "JPEG ringing around the subject turns into coloured fringing that is hard to remove when cutting the background out. Pick PNG if you plan to edit the result.",
				arkWatermark: "AI generated watermark",
				arkWatermarkOn: "Add (Ark default)",
				arkWatermarkOff: "Do not add",
				arkWatermarkHint: "Ark stamps an \"AI generated\" mark into the bottom-right corner by default. Turn it off for game assets or any post-processing.",
				arkBackground: "Background",
				arkBackgroundOpaque: "Opaque (Ark default)",
				arkBackgroundTransparent: "Transparent",
				arkBackgroundHint: "Image-to-image only, and every reference image must already carry an alpha channel; Ark rejects it for text-to-image, so it is sent on edits alone.",
				editExtraInvalid: "Extra JSON fields must be a valid JSON object.",
				endpointHintSeedream: "Volcengine Ark compatible /api/v3 base URL.",
				endpointHintDashScope: "Official Aliyun DashScope endpoint.",
				endpointHintXAI: "Official xAI api.x.ai /v1 base URL.",
				endpointHintZhipu: "Zhipu open.bigmodel.cn /api/paas/v4 base URL.",
				endpointHintComfyUI: "A running ComfyUI server reachable by the DSH Host; the default points to port 8188 on this computer.",
				model: "Model",
				workflow: "API Workflows",
				workflowImport: "Import JSON file",
				workflowMissing: "No workflow imported",
				workflowImported: "Imported {name}",
				workflowHint: "Export an API Format JSON from ComfyUI and place {{prompt}} in its prompt input; {{seed}} is available for a random seed. For image editing put {{image}} (exactly once) in the LoadImage image input. Import as many workflows as you need; the Agent can also pick one by name.",
				workflowTooLarge: "Workflow files must be no larger than 5 MB.",
				workflowActiveTitle: "Make this the active workflow",
				workflowRemove: "Remove",
				workflowPresetPlaceholder: "Preset prompt (optional)",
				workflowPresetTitle: "Preset prompt: automatically prepended to the user prompt on every call of this workflow.",
				workflowNameRequired: "Workflow names cannot be empty.",
				workflowDuplicateName: "Workflow names must be unique.",
				timeout: "Generation timeout (seconds)",
				timeoutHint: "Covers submission, waiting, and image download; defaults to 300 seconds.",
				workspaceSection: "Workspace",
				saveToWorkspace: "Save to workspace",
				saveToWorkspaceHint: "Write each generated image as a file into the session workspace.",
				folder: "Workspace folder",
				folderHint: "Subdirectory of the session workspace; empty means the workspace root.",
				fetchModels: "Fetch models",
				fetchingModels: "Fetching…",
				fetchModelsHint: "Click \"Fetch models\" to list image-capable models with the stored key; manual input still works.",
				modelPick: "Pick a pulled model",
				modelPickPlaceholder: "Choose a model… ({count} available)",
				modelPickCurrent: "(current)",
				modelsFound: "{n} image models found; open the model field to pick one",
				modelsNone: "No image models found; type the model name manually",
				saving: "Saving…",
				save: "Save",
				saved: "Saved",
				savedToPath: "Saved to",
				generating: "Generating image…",
				loading: "Loading image…",
				loadFailed: "Failed to load image ({status})",
				generatedTitle: "Generated image",
				resultShown: "Image result is shown in the conversation",
				copyImg: "Copy Image",
				download: "Download Image",
				openNewTab: "Open in new tab",
				copiedImage: "Image copied",
				copyFailed: "Copy failed",
				regenerate: "Regenerate",
				regenerateTitle: "Regenerate image",
				regenerateHint: "Edit the prompt if needed. The new image replaces this view while the original remains available.",
				prompt: "Prompt",
				cancel: "Cancel",
				confirmRegenerate: "Regenerate",
				regenerating: "Regenerating…",
				regenerateFailed: "Regeneration failed",
				regenerateSaveFailed: "Regenerated, but saving to the gallery failed. Please retry.",
				versionPrevious: "Previous version",
				versionNext: "Next version",
				versionLabel: "Image version {current}/{total}"
			}
		};
		const STYLE = `
.dsh-ig-card{list-style:none;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:12px;background:var(--dsw-alias-bg-layer-3,#fff);transition:border-color .16s,background .16s;overflow:hidden}
.dsh-ig-card:hover{border-color:var(--dsw-alias-label-dimmed,#9ca3af)}
.dsh-ig-card-open{background:var(--dsw-alias-bg-layer-2,#fff);border-color:var(--dsw-alias-label-dimmed,#9ca3af)}
.dsh-ig-head{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-radius:12px}
.dsh-ig-head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4c78ff);outline-offset:-2px}
.dsh-ig-head-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.dsh-ig-title{display:block;font-size:15px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary,inherit)}
.dsh-ig-desc{display:block;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#7b818b)}
.dsh-ig-chevron{flex:none;color:var(--dsw-alias-label-tertiary,#7b818b);transition:transform .16s;display:inline-flex;align-items:center}
.dsh-ig-chevron-open{transform:rotate(180deg)}
.dsh-ig-body{border-top:1px solid var(--dsw-alias-border-l2,#eee);padding:0 16px 16px}
.dsh-ig-field{display:grid;gap:6px;margin-top:14px}
.dsh-ig-label{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary,inherit)}
.dsh-ig-input{box-sizing:border-box;width:100%;padding:8px 12px;font-size:13px;border:1px solid var(--dsw-alias-border-l2,#d7dbe0);border-radius:8px;background:var(--dsw-alias-bg-layer-3,transparent);color:inherit;outline:none;transition:border-color .15s}
.dsh-ig-input:focus{border-color:var(--dsw-alias-brand-primary,#4c78ff)}
.dsh-ig-textarea{resize:vertical;min-height:56px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;line-height:1.5}
.dsh-ig-input-group{display:flex;gap:8px;align-items:center}
.dsh-ig-select{appearance:auto;cursor:pointer}
.dsh-ig-file-row{display:flex;align-items:center;gap:10px;min-width:0}
.dsh-ig-file-input{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;clip-path:inset(50%)}
.dsh-ig-file-button{appearance:none;flex:none;border:1px solid var(--dsw-alias-border-l2,#d7dbe0);border-radius:8px;padding:7px 12px;background:var(--dsw-alias-bg-layer-3,#f9fafb);color:var(--dsw-alias-label-secondary,inherit);font-size:13px;cursor:pointer;transition:background .15s,border-color .15s}
.dsh-ig-file-button:hover{background:var(--dsw-alias-bg-layer-2,#edf0f3);border-color:var(--dsw-alias-label-dimmed,#9ca3af)}
.dsh-ig-file-button:focus-within{outline:2px solid var(--dsw-alias-brand-primary,#4c78ff);outline-offset:2px}
.dsh-ig-file-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,inherit);font-size:12px}
.dsh-ig-workflow-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.dsh-ig-workflow-row{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--dsw-alias-border-l2,#eee);border-radius:8px}
.dsh-ig-workflow-main{display:flex;align-items:center;gap:8px}
.dsh-ig-workflow-active{display:inline-flex;align-items:center;cursor:pointer;flex:none}
.dsh-ig-workflow-active input[type=radio]{width:15px;height:15px;accent-color:var(--dsw-alias-brand-primary,#4c78ff);margin:0;cursor:pointer}
.dsh-ig-workflow-name{flex:1;min-width:0}
.dsh-ig-btn-reset{appearance:none;border:1px solid var(--dsw-alias-border-l2,#d7dbe0);border-radius:8px;padding:7px 12px;background:var(--dsw-alias-bg-layer-3,#f9fafb);color:var(--dsw-alias-label-secondary,inherit);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s}
.dsh-ig-btn-reset:hover{background:var(--dsw-alias-bg-layer-2,#edf0f3);border-color:var(--dsw-alias-label-dimmed,#9ca3af)}
.dsh-ig-hint,.dsh-ig-status{margin:0;color:var(--dsw-alias-label-tertiary,#7b818b);font-size:12px;line-height:1.4}
.dsh-ig-hint-error{color:var(--dsw-alias-label-error,#d33)}
.dsh-ig-status-error{color:var(--dsw-alias-label-error,#d33);font-weight:500}
.dsh-ig-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding-top:12px;border-top:1px solid var(--dsw-alias-border-l2,#eee)}
.dsh-ig-check-row{display:flex;align-items:center;gap:8px;cursor:pointer}
.dsh-ig-check-row input[type=checkbox]{width:15px;height:15px;accent-color:var(--dsw-alias-brand-primary,#4c78ff);margin:0}
.dsh-ig-savedto{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#7b818b);word-break:break-all}
.dsh-ig-save{appearance:none;border:0;border-radius:8px;padding:6px 16px;background:var(--dsw-alias-label-primary,#111827);color:var(--dsw-alias-bg-layer-3,#fff);font:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:opacity .15s}
.dsh-ig-save:disabled{opacity:.4;cursor:default}

/* Provider list: one expandable row per provider, each saving independently. */
.dsh-ig-providers{display:grid;gap:10px;margin-top:14px}
.dsh-ig-provider-row{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:10px;background:var(--dsw-alias-bg-layer-3,transparent);overflow:hidden;transition:border-color .16s}
.dsh-ig-provider-row-open{border-color:var(--dsw-alias-label-dimmed,#9ca3af)}
.dsh-ig-provider-head{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:10px;padding:11px 12px}
.dsh-ig-provider-head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4c78ff);outline-offset:-2px}
.dsh-ig-provider-name{flex:1;min-width:0;font-size:13.5px;font-weight:550;color:var(--dsw-alias-label-primary,inherit)}
.dsh-ig-provider-chevron{flex:none;color:var(--dsw-alias-label-tertiary,#7b818b);transition:transform .16s;display:inline-flex;align-items:center}
.dsh-ig-provider-chevron-open{transform:rotate(180deg)}
.dsh-ig-provider-body{border-top:1px solid var(--dsw-alias-border-l2,#eee);padding:2px 12px 14px}
.dsh-ig-badge{flex:none;display:inline-flex;align-items:center;gap:5px;font-size:11.5px;line-height:1.6;padding:2px 9px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,#d7dbe0);color:var(--dsw-alias-label-secondary,inherit);white-space:nowrap;max-width:60%;overflow:hidden;text-overflow:ellipsis}
.dsh-ig-badge-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.dsh-ig-badge-ok{border-color:rgba(34,197,94,.45);color:#15803d;background:rgba(34,197,94,.08)}
.dsh-ig-badge-missing{border-color:rgba(239,68,68,.4);color:#b91c1c;background:rgba(239,68,68,.06)}
.dsh-ig-badge-neutral{color:var(--dsw-alias-label-tertiary,#7b818b)}
.dsh-ig-badge-checking .dsh-ig-badge-dot{animation:dsh-ig-pulse 1s ease-in-out infinite}
@keyframes dsh-ig-pulse{50%{opacity:.25}}

/* Default provider radio pills. */
.dsh-ig-radios{display:flex;flex-wrap:wrap;gap:8px}
.dsh-ig-radio{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l2,#d7dbe0);border-radius:999px;padding:5px 12px;cursor:pointer;font-size:12.5px;color:var(--dsw-alias-label-secondary,inherit);transition:border-color .15s,background .15s}
.dsh-ig-radio:hover{border-color:var(--dsw-alias-label-dimmed,#9ca3af)}
.dsh-ig-radio-checked{border-color:var(--dsw-alias-brand-primary,#4c78ff);background:rgba(76,120,255,.08);color:var(--dsw-alias-label-primary,inherit)}
.dsh-ig-radio input[type=radio]{width:14px;height:14px;accent-color:var(--dsw-alias-brand-primary,#4c78ff);margin:0;cursor:pointer}

/* Row-level actions: test connection, clear key, save. */
.dsh-ig-row-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;flex-wrap:wrap}
.dsh-ig-row-buttons{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dsh-ig-btn-secondary{appearance:none;border:1px solid var(--dsw-alias-border-l2,#d7dbe0);border-radius:8px;padding:6px 14px;background:var(--dsw-alias-bg-layer-3,#f9fafb);color:var(--dsw-alias-label-secondary,inherit);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s,opacity .15s}
.dsh-ig-btn-secondary:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2,#edf0f3);border-color:var(--dsw-alias-label-dimmed,#9ca3af)}
.dsh-ig-btn-secondary:disabled{opacity:.45;cursor:default}
.dsh-ig-btn-danger{color:#b91c1c;border-color:rgba(239,68,68,.4)}
.dsh-ig-btn-danger:hover:not(:disabled){background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.6)}

/* Workspace section within the settings card. */
.dsh-ig-section{display:grid;gap:6px;margin-top:16px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l2,#eee)}
.dsh-ig-section-title{font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-tertiary,#7b818b);text-transform:uppercase}
.dsh-ig-status-readonly{color:var(--dsw-alias-label-tertiary,#7b818b);font-style:italic}

.dsh-ig-result{display:grid;gap:10px;max-width:520px}
.dsh-ig-promoted-results{display:grid;gap:16px}
.dsh-ig-result-title{font-size:14px;font-weight:600}
.dsh-ig-container{position:relative;display:inline-block;width:fit-content;max-width:100%;justify-self:start;border-radius:12px;overflow:hidden;line-height:0;isolation:isolate}
.dsh-ig-container:hover .dsh-ig-toolbar,.dsh-ig-container:focus-within .dsh-ig-toolbar{opacity:1;pointer-events:auto}
.dsh-ig-toolbar{position:absolute;top:8px;left:8px;display:flex;align-items:center;gap:5px;padding:3px 5px;border-radius:8px;background:rgba(0,0,0,0.65);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;pointer-events:none;transition:opacity .18s ease;z-index:2;line-height:1}
.dsh-ig-tool-btn{appearance:none;border:0;background:transparent;color:#fff;padding:5px;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,color .15s}
.dsh-ig-tool-btn:hover{background:rgba(255,255,255,0.25)}
.dsh-ig-tool-btn-danger:hover{background:rgba(239,68,68,0.75)!important;color:#fff!important}
.dsh-ig-toast{position:absolute;top:100%;left:0;margin-top:5px;padding:3px 8px;border-radius:6px;background:rgba(0,0,0,0.85);color:#fff;font-size:11px;white-space:nowrap;pointer-events:none;z-index:4}
.dsh-ig-image{display:block;max-width:100%;max-height:520px;border-radius:12px;background:#f2f3f5;cursor:pointer}
.dsh-ig-version-nav{position:absolute;right:8px;bottom:8px;display:flex;align-items:center;gap:2px;padding:3px;border-radius:999px;background:rgba(15,23,42,.72);color:#fff;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font-size:11px;line-height:1;z-index:2}
.dsh-ig-version-nav button{appearance:none;border:0;background:transparent;color:inherit;width:25px;height:25px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:17px;line-height:1}
.dsh-ig-version-nav button:hover:not(:disabled){background:rgba(255,255,255,.2)}
.dsh-ig-version-nav button:disabled{opacity:.3;cursor:default}
.dsh-ig-version-count{min-width:34px;text-align:center;font-variant-numeric:tabular-nums}
.dsh-ig-regenerate-overlay{position:absolute;inset:0;background:rgba(15,23,42,0.52);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#fff;z-index:3;animation:dsh-ig-fade .18s ease-out;line-height:1.4;border-radius:12px}
.dsh-ig-regenerate-spinner{width:28px;height:28px;border:3px solid rgba(255,255,255,0.25);border-top-color:#fff;border-radius:50%;animation:dsh-ig-spin .8s linear infinite}
.dsh-ig-regenerate-overlay-text{font-size:12.5px;font-weight:550;color:#fff;letter-spacing:0.2px;text-shadow:0 1px 2px rgba(0,0,0,0.4)}
.dsh-ig-regenerate-overlay-cancel{appearance:none;border:1px solid rgba(255,255,255,0.4);border-radius:6px;background:rgba(255,255,255,0.15);color:#fff;padding:3px 12px;font-size:11.5px;cursor:pointer;transition:background .15s}
.dsh-ig-regenerate-overlay-cancel:hover{background:rgba(255,255,255,0.3)}
@keyframes dsh-ig-spin{to{transform:rotate(360deg)}}
.dsh-ig-regenerate-backdrop{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(11,17,29,.6);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);animation:dsh-ig-fade .15s ease-out}
.dsh-ig-regenerate-dialog{width:min(520px,100%);border:1px solid var(--dsw-alias-border-l2,#dfe3ea);border-radius:14px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#172033);box-shadow:0 24px 72px rgba(11,17,29,.28);padding:20px;box-sizing:border-box;line-height:1.4}
.dsh-ig-regenerate-dialog h3{margin:0;font-size:16px;font-weight:650}
.dsh-ig-regenerate-dialog p{margin:7px 0 16px;color:var(--dsw-alias-label-tertiary,#737d8f);font-size:12.5px;line-height:1.55}
.dsh-ig-regenerate-dialog label{display:grid;gap:7px;font-size:12.5px;font-weight:600}
.dsh-ig-regenerate-dialog textarea{box-sizing:border-box;width:100%;min-height:132px;resize:vertical;border:1px solid var(--dsw-alias-border-l2,#d7dce5);border-radius:9px;padding:11px 12px;background:var(--dsw-alias-bg-layer-2,#fff);color:inherit;font:inherit;font-size:13px;line-height:1.55;outline:none}
.dsh-ig-regenerate-dialog textarea:focus{border-color:var(--dsw-alias-brand-primary,#4c78ff);box-shadow:0 0 0 3px rgba(76,120,255,.12)}
.dsh-ig-regenerate-error{margin-top:10px!important;color:var(--dsw-alias-label-error,#d33)!important}
.dsh-ig-regenerate-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:16px}
.dsh-ig-regenerate-actions button{height:35px;padding:0 14px;border-radius:7px;font:inherit;font-size:13px;font-weight:550;cursor:pointer}
.dsh-ig-regenerate-cancel{border:1px solid var(--dsw-alias-border-l2,#d7dce5);background:transparent;color:inherit}
.dsh-ig-regenerate-confirm{border:1px solid var(--dsw-alias-brand-primary,#3569ed);background:var(--dsw-alias-brand-primary,#3569ed);color:#fff}
.dsh-ig-regenerate-actions button:disabled{opacity:.5;cursor:default}
@media(hover:none){.dsh-ig-container .dsh-ig-toolbar{opacity:1;pointer-events:auto}}
@keyframes dsh-ig-fade{from{opacity:0}to{opacity:1}}
.dsh-ig-error{color:var(--dsw-alias-label-error,#d33);font-size:13px}
.dsh-ig-loading{color:var(--dsw-alias-label-tertiary,#7b818b);font-size:13px}

/* Native Workspace Gallery & Studio View (Renders seamlessly inside DSH Session View) */

/* 1. Top Navigation Tab Bar */
.dsh-ig-studio-tabs-bar{display:flex;align-items:center;gap:6px;padding:6px 24px;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#ffffff);flex-shrink:0}
.dsh-ig-studio-tab-btn{appearance:none;-webkit-appearance:none;border:0;background:transparent;display:inline-flex;align-items:center;gap:7px;padding:7px 14px;font-size:13px;font-weight:500;color:var(--dsw-alias-label-secondary,#64748b);cursor:pointer;border-radius:6px;transition:color .15s ease,background-color .15s ease}
.dsh-ig-studio-tab-btn:hover{color:var(--dsw-alias-label-primary,#0f172a);background:var(--dsw-alias-bg-layer-2,#f1f5f9)}
.dsh-ig-studio-tab-btn.is-active{color:var(--dsw-alias-brand-primary,#2563eb);font-weight:600;background:rgba(37,99,235,0.08)}

/* 2. Secondary Filter & Search Toolbar */
.dsh-ig-studio-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 24px;background:var(--dsw-alias-bg-layer-1,#ffffff);border-bottom:1px solid var(--dsw-alias-border-l2,#f1f5f9);flex-shrink:0;flex-wrap:wrap}
.dsh-ig-studio-toolbar-left{display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex:1;min-width:0}
.dsh-ig-studio-toolbar-right{display:flex;align-items:center;gap:10px;flex-shrink:0}

/* Modern Custom Select (Removes OS default arrows & ugly borders) */
.dsh-ig-studio-select{appearance:none;-webkit-appearance:none;-moz-appearance:none;height:32px;line-height:30px;padding:0 28px 0 12px;font-size:12.5px;color:var(--dsw-alias-label-primary,#334155);background-color:var(--dsw-alias-bg-layer-2,#ffffff);background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 9px center;border:1px solid var(--dsw-alias-border-l2,#e2e8f0);border-radius:6px;outline:none;cursor:pointer;box-sizing:border-box;transition:border-color .15s ease,box-shadow .15s ease,background-color .15s ease}
.dsh-ig-studio-select:hover{border-color:var(--dsw-alias-border-l1,#cbd5e1);background-color:var(--dsw-alias-bg-layer-1,#f8fafc)}
.dsh-ig-studio-select:focus{border-color:var(--dsw-alias-brand-primary,#3b82f6);box-shadow:0 0 0 2px rgba(59,130,246,0.15)}
.dsh-ig-studio-select-sort{font-weight:500}

/* Unified Search Input */
.dsh-ig-studio-search-wrap{position:relative;display:flex;align-items:center;min-width:190px;max-width:320px;flex:1}
.dsh-ig-studio-search-icon{position:absolute;left:10px;color:var(--dsw-alias-label-tertiary,#94a3b8);pointer-events:none}
.dsh-ig-studio-search-input{width:100%;height:32px;line-height:30px;padding:0 12px 0 32px;font-size:12.5px;border:1px solid var(--dsw-alias-border-l2,#e2e8f0);border-radius:6px;background-color:var(--dsw-alias-bg-layer-2,#ffffff);color:inherit;outline:none;box-sizing:border-box;transition:border-color .15s ease,box-shadow .15s ease}
.dsh-ig-studio-search-input:hover{border-color:var(--dsw-alias-border-l1,#cbd5e1)}
.dsh-ig-studio-search-input:focus{border-color:var(--dsw-alias-brand-primary,#3b82f6);box-shadow:0 0 0 2px rgba(59,130,246,0.15)}
.dsh-ig-studio-search-input::placeholder{color:var(--dsw-alias-label-tertiary,#94a3b8)}

/* 3. Grid & Responsive Cards */
.dsh-ig-gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:18px}
.dsh-ig-gallery-card{background:var(--dsw-alias-bg-layer-2,#ffffff);border:1px solid var(--dsw-alias-border-l2,#e2e8f0);border-radius:10px;overflow:hidden;display:flex;flex-direction:column;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
.dsh-ig-gallery-card:hover{transform:translateY(-2px);box-shadow:0 10px 20px -5px rgba(0,0,0,0.06),0 4px 6px -2px rgba(0,0,0,0.03);border-color:var(--dsw-alias-border-l1,#cbd5e1)}
.dsh-ig-gallery-card-media{position:relative;width:100%;aspect-ratio:1/1;background:#f1f5f9;overflow:hidden;display:flex;align-items:center;justify-content:center}
.dsh-ig-gallery-card-img{width:100%;height:100%;object-fit:cover;transition:transform .2s ease}
.dsh-ig-gallery-card:hover .dsh-ig-gallery-card-img{transform:scale(1.03)}
.dsh-ig-gallery-card-loading{font-size:12px;color:#94a3b8}
.dsh-ig-gallery-card-error{font-size:12px;color:#ef4444;padding:8px;text-align:center}

/* Floating Action Toolbar on Card Hover */
.dsh-ig-gallery-card:hover .dsh-ig-card-toolbar{opacity:1;pointer-events:auto}
.dsh-ig-card-toolbar{position:absolute;top:6px;left:6px;display:flex;align-items:center;gap:3px;padding:3px 5px;border-radius:6px;background:rgba(15,23,42,0.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;pointer-events:none;transition:opacity .18s ease;z-index:10;line-height:1}

/* Card Bottom Metadata */
.dsh-ig-gallery-card-meta{padding:10px 12px;display:flex;flex-direction:column;gap:5px;background:var(--dsw-alias-bg-layer-2,#ffffff);flex:1}
.dsh-ig-card-badge-row{display:flex;align-items:center}
.dsh-ig-card-badge{display:inline-block;padding:2px 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-3,#f1f5f9);color:var(--dsw-alias-label-secondary,#475569);font-size:11px;font-weight:500;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-ig-gallery-card-prompt-line{font-size:12.5px;font-weight:500;color:var(--dsw-alias-label-primary,#1e293b);line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-ig-card-footer-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px}
.dsh-ig-card-meta-text{font-size:11px;color:var(--dsw-alias-label-tertiary,#94a3b8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-ig-card-fav-btn{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#94a3b8);padding:2px;border-radius:4px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:color .15s,transform .15s;flex-shrink:0}
.dsh-ig-card-fav-btn:hover{color:#ef4444;transform:scale(1.15)}
.dsh-ig-card-fav-btn.is-favorited{color:#ef4444}

/* Placeholders for Upcoming Routes */
.dsh-ig-placeholder-view{display:flex;align-items:center;justify-content:center;min-height:360px;height:100%;padding:24px}
.dsh-ig-placeholder-card{max-width:500px;width:100%;text-align:center;padding:36px 28px;background:var(--dsw-alias-bg-layer-2,#ffffff);border:1px dashed var(--dsw-alias-border-l2,#e2e8f0);border-radius:14px;display:flex;flex-direction:column;align-items:center;gap:12px}
.dsh-ig-placeholder-icon{font-size:40px;line-height:1}
.dsh-ig-placeholder-header{display:flex;align-items:center;gap:8px;justify-content:center}
.dsh-ig-placeholder-title{font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary,inherit);margin:0}
.dsh-ig-placeholder-badge{font-size:11px;font-weight:500;background:rgba(37,99,235,0.1);color:#2563eb;padding:2px 8px;border-radius:12px}
.dsh-ig-placeholder-desc{font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary,#64748b);margin:0}
.dsh-ig-placeholder-tip{margin-top:6px;padding:8px 12px;font-size:12px;background:var(--dsw-alias-bg-layer-3,#f8fafc);border-radius:8px;color:var(--dsw-alias-label-tertiary,#64748b);text-align:left}

/* Empty State */
.dsh-ig-gallery-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:360px;text-align:center;color:var(--dsw-alias-label-tertiary,#94a3b8)}
.dsh-ig-gallery-empty-icon{font-size:44px;margin-bottom:10px}
.dsh-ig-gallery-empty-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary,inherit);margin-bottom:4px}
.dsh-ig-gallery-empty-desc{font-size:13px;max-width:360px;line-height:1.5}

/* Pure Centered Lightbox */
.dsh-ig-lightbox-backdrop{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.88);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;cursor:zoom-out;animation:dsh-ig-fade .15s ease-out}
.dsh-ig-lightbox-topbar{position:absolute;top:20px;left:24px;right:24px;display:flex;align-items:center;justify-content:space-between;z-index:10;pointer-events:none}
.dsh-ig-lightbox-meta{display:flex;align-items:center;gap:8px;pointer-events:auto}
.dsh-ig-tag{display:inline-block;padding:2px 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-3,#edf0f3);color:var(--dsw-alias-label-secondary,inherit);font-weight:500;text-transform:uppercase;font-size:10px}
.dsh-ig-tag-model{background:rgba(76,120,255,0.1);color:#4c78ff}
.dsh-ig-lightbox-close-btn{appearance:none;border:0;background:rgba(255,255,255,0.15);color:#fff;border-radius:50%;width:34px;height:34px;font-size:16px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s;pointer-events:auto}
.dsh-ig-lightbox-close-btn:hover{background:rgba(255,255,255,0.3)}
.dsh-ig-lightbox-img-wrap{max-width:86vw;max-height:78vh;display:flex;align-items:center;justify-content:center;cursor:default}
.dsh-ig-lightbox-img{max-width:100%;max-height:78vh;object-fit:contain;border-radius:8px;box-shadow:0 24px 60px rgba(0,0,0,0.7);user-select:none}
.dsh-ig-lightbox-bottombar{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);max-width:min(90vw,640px);background:rgba(20,22,26,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:10px 16px;display:flex;flex-direction:column;gap:8px;color:#fff;box-shadow:0 16px 40px rgba(0,0,0,0.5);cursor:default}
.dsh-ig-lightbox-prompt-text{font-size:13px;line-height:1.4;color:rgba(255,255,255,0.92);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.dsh-ig-lightbox-counter{display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;background:rgba(255,255,255,0.15);color:#fff;font-size:11.5px;font-weight:500;font-variant-numeric:tabular-nums}
.dsh-ig-lightbox-nav-btn{position:fixed;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.12);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:100;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:background-color .15s ease,transform .15s ease,opacity .15s ease;outline:none}
.dsh-ig-lightbox-nav-btn:hover:not(:disabled){background:rgba(255,255,255,0.28);transform:translateY(-50%) scale(1.08)}
.dsh-ig-lightbox-nav-btn:disabled{opacity:0.2;cursor:not-allowed;pointer-events:none}
.dsh-ig-lightbox-nav-prev{left:24px}
.dsh-ig-lightbox-nav-next{right:24px}
.dsh-ig-lightbox-loading{display:flex;align-items:center;justify-content:center;min-width:180px;min-height:180px}
.dsh-ig-lightbox-spinner{width:36px;height:36px;border:3px solid rgba(255,255,255,0.2);border-top-color:#fff;border-radius:50%;animation:dsh-ig-spin .8s linear infinite}
@keyframes dsh-ig-spin{to{transform:rotate(360deg)}}
.dsh-ig-lightbox-btn{appearance:none;border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.08);color:#fff;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:background .15s,border-color .15s,color .15s}
.dsh-ig-lightbox-btn:hover{background:rgba(255,255,255,0.22)}
.dsh-ig-lightbox-btn-danger{border-color:rgba(239,68,68,0.4);color:#fca5a5}
.dsh-ig-lightbox-btn-danger:hover{background:rgba(239,68,68,0.35)!important;color:#fff!important;border-color:rgba(239,68,68,0.7)!important}

/* Card selection and checkbox */
.dsh-ig-gallery-card.is-selected{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary,#2563eb);border-color:transparent}
.dsh-ig-card-checkbox{position:absolute;top:8px;left:8px;width:22px;height:22px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.7);background:rgba(0,0,0,0.35);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;z-index:5;opacity:0;transition:opacity .15s ease,background-color .15s ease,border-color .15s ease;padding:0;outline:none}
.dsh-ig-gallery-card:hover .dsh-ig-card-checkbox,.dsh-ig-gallery-card.is-manage-mode .dsh-ig-card-checkbox,.dsh-ig-card-checkbox.is-checked{opacity:1}
.dsh-ig-card-checkbox.is-checked{background:var(--dsw-alias-brand-primary,#2563eb);border-color:var(--dsw-alias-brand-primary,#2563eb)}

/* Studio button in toolbar */
.dsh-ig-studio-btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;box-sizing:border-box;border-radius:6px;border:1px solid var(--dsw-alias-border-subtle,rgba(0,0,0,0.12));background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,inherit);font-size:12.5px;font-weight:500;cursor:pointer;transition:border-color .15s,background .15s,color .15s}
.dsh-ig-studio-btn:hover{background:var(--dsw-alias-bg-layer-3,#f3f4f6);border-color:var(--dsw-alias-border-default,rgba(0,0,0,0.2))}
.dsh-ig-studio-btn.is-active{background:var(--dsw-alias-brand-primary,#2563eb);border-color:var(--dsw-alias-brand-primary,#2563eb);color:#fff}
.dsh-ig-studio-btn-danger{color:#ef4444;border-color:rgba(239,68,68,0.35);background:rgba(239,68,68,0.06)}
.dsh-ig-studio-btn-danger:hover{background:rgba(239,68,68,0.14);border-color:rgba(239,68,68,0.6);color:#dc2626}
.dsh-ig-studio-btn-danger.is-active{background:#dc2626;border-color:#dc2626;color:#fff}

/* Floating Batch Action Bar */
.dsh-ig-batch-bar{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:16px;background:rgba(20,24,32,0.92);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.18);border-radius:40px;padding:8px 16px;box-shadow:0 16px 40px rgba(0,0,0,0.5);z-index:99990;animation:dsh-ig-slide-up .2s cubic-bezier(0.16,1,0.3,1);color:#fff}
@keyframes dsh-ig-slide-up{from{transform:translate(-50%,20px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
.dsh-ig-batch-bar-left{display:flex;align-items:center;gap:10px}
.dsh-ig-batch-bar-right{display:flex;align-items:center;gap:8px;border-left:1px solid rgba(255,255,255,0.15);padding-left:12px}
.dsh-ig-batch-counter{font-size:13px;font-weight:600;color:rgba(255,255,255,0.95);margin-right:4px}
.dsh-ig-batch-btn{appearance:none;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#fff;border-radius:20px;padding:5px 12px;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:background .15s,border-color .15s,color .15s}
.dsh-ig-batch-btn:hover:not(:disabled){background:rgba(255,255,255,0.2)}
.dsh-ig-batch-btn:disabled{opacity:0.4;cursor:not-allowed}
.dsh-ig-batch-btn-danger{background:rgba(239,68,68,0.2);border-color:rgba(239,68,68,0.5);color:#fca5a5}
.dsh-ig-batch-btn-danger:hover:not(:disabled){background:rgba(239,68,68,0.4)!important;border-color:rgba(239,68,68,0.8)!important;color:#fff!important}
.dsh-ig-batch-btn-exit{border-color:transparent;background:transparent;color:rgba(255,255,255,0.7)}
.dsh-ig-batch-btn-exit:hover{background:rgba(255,255,255,0.1);color:#fff}

/* Batch Delete Confirmation Modal */
.dsh-ig-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:100005;display:flex;align-items:center;justify-content:center;padding:16px;animation:dsh-ig-fade .15s ease-out}
.dsh-ig-modal-box{width:100%;max-width:440px;background:var(--dsw-alias-bg-layer-1,#1c1e24);border:1px solid var(--dsw-alias-border-subtle,rgba(255,255,255,0.12));border-radius:12px;padding:22px;box-sizing:border-box;box-shadow:0 20px 50px rgba(0,0,0,0.45);color:var(--dsw-alias-label-primary,#fff);animation:dsh-ig-scale-up .15s ease-out}
@keyframes dsh-ig-scale-up{from{transform:scale(0.95);opacity:0}to{transform:scale(1);opacity:1}}
.dsh-ig-modal-header{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px}
.dsh-ig-modal-icon-danger{width:36px;height:36px;border-radius:50%;background:rgba(239,68,68,0.12);color:#ef4444;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.dsh-ig-modal-title{font-size:16px;font-weight:600;line-height:1.4}
.dsh-ig-modal-body{margin-bottom:20px;padding-left:48px}
.dsh-ig-modal-desc{font-size:13.5px;color:var(--dsw-alias-label-secondary,rgba(255,255,255,0.7));margin:0 0 14px 0;line-height:1.5}
.dsh-ig-modal-checkbox-label{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--dsw-alias-label-primary,inherit);cursor:pointer;user-select:none}
.dsh-ig-modal-checkbox-label input{margin:0;cursor:pointer;width:15px;height:15px}
.dsh-ig-modal-footer{display:flex;align-items:center;justify-content:flex-end;gap:10px}
.dsh-ig-modal-btn{height:34px;padding:0 14px;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;transition:background .15s,border-color .15s,color .15s;outline:none}
.dsh-ig-modal-btn-cancel{background:transparent;border:1px solid var(--dsw-alias-border-subtle,rgba(255,255,255,0.2));color:var(--dsw-alias-label-primary,inherit)}
.dsh-ig-modal-btn-cancel:hover{background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,0.08))}
.dsh-ig-modal-btn-danger{background:#dc2626;border:1px solid #dc2626;color:#fff}
.dsh-ig-modal-btn-danger:hover{background:#b91c1c;border-color:#b91c1c}
.dsh-ig-modal-btn-primary{background:linear-gradient(135deg,#3b82f6,#2563eb);border:1px solid #2563eb;color:#fff;display:inline-flex;align-items:center;gap:6px}
.dsh-ig-modal-btn-primary:hover:not(:disabled){background:linear-gradient(135deg,#2563eb,#1d4ed8)}
.dsh-ig-modal-btn-primary:disabled{opacity:0.5;cursor:not-allowed}
.dsh-ig-regenerate-modal-box{max-width:520px}
.dsh-ig-regenerate-modal-icon{width:36px;height:36px;border-radius:50%;background:rgba(59,130,246,0.15);color:#3b82f6;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.dsh-ig-regenerate-modal-title-wrap{display:flex;flex-direction:column;gap:4px}
.dsh-ig-regenerate-modal-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dsh-ig-regenerate-modal-textarea{width:100%;box-sizing:border-box;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,0.25));border:1px solid var(--dsw-alias-border-subtle,rgba(255,255,255,0.15));border-radius:8px;padding:10px 12px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary,#fff);resize:vertical;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s}
.dsh-ig-regenerate-modal-textarea:focus{border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,0.2)}
.dsh-ig-lightbox-btn-regenerate:hover{color:#60a5fa!important;border-color:rgba(96,165,250,0.5)!important;background:rgba(96,165,250,0.12)!important}
.dsh-ig-lightbox-generating-indicator{display:inline-flex;align-items:center;gap:8px;padding:4px 12px;background:rgba(37,99,235,0.2);border:1px solid rgba(59,130,246,0.5);border-radius:20px;font-size:12px;color:#93c5fd;animation:dsh-ig-fade .15s ease-out}
.dsh-ig-lightbox-spinner-sm{width:12px;height:12px;border:2px solid rgba(147,197,253,0.3);border-top-color:#93c5fd;border-radius:50%;animation:dsh-ig-spin .8s linear infinite;flex-shrink:0}
.dsh-ig-lightbox-abort-btn{appearance:none;background:transparent;border:0;color:#fca5a5;font-size:11.5px;cursor:pointer;padding:0 4px;margin-left:4px;text-decoration:underline;text-underline-offset:2px}
.dsh-ig-lightbox-abort-btn:hover{color:#ef4444}
`;
		/** Required browser services. */
		const inject = [
			"slots",
			"connection",
			"remote",
			"settingsScope",
			"locale"
		];
		/** Mount the settings card, generated-image card, and native conversation gallery view. */
		function apply(ctx) {
			const scope = ctx.settingsScope.bind({ namespace: IMAGE_GENERATION_NAMESPACE });
			const locale = ctx.get("locale");
			ctx.effect(() => {
				const style = document.createElement("style");
				style.dataset.plugin = "dsh-image-gen";
				style.textContent = STYLE;
				document.head.appendChild(style);
				return () => {
					style.remove();
				};
			}, "dsh-image-gen: styles");
			const credentialListeners = /* @__PURE__ */ new Set();
			const notifyCredentialsUpdated = () => {
				for (const listener of credentialListeners) listener();
			};
			ctx.effect(() => {
				const remote = ctx.get("remote");
				if (typeof remote?.$on !== "function") return () => {};
				return remote.$on("credentials/reference-updated", notifyCredentialsUpdated);
			}, "dsh-image-gen: credential events");
			const credentialEvents = { listen(callback) {
				credentialListeners.add(callback);
				return () => {
					credentialListeners.delete(callback);
				};
			} };
			const injectSettingsItem = (owner) => {
				const ownerRegister = owner.slots.register.bind(owner.slots);
				const injectSettingsFace = () => ({
					scope,
					credentials: credentialsProxy,
					credentialsAvailable,
					locale,
					credentialEvents
				});
				owner.slots.inject("settings.plugins.tab", () => ownerRegister({
					name: "settings.plugins.tab",
					id: IMAGE_GENERATION_NAMESPACE,
					order: 30,
					label: () => locale?.getSnapshot?.()?.active?.startsWith("en") ? "Image generation" : "图像生成",
					locale,
					inject: injectSettingsFace
				}, ImageGenerationSettingsCard));
				owner.slots.inject("settings.plugin.item", () => ownerRegister({
					name: "settings.plugin.item",
					key: IMAGE_GENERATION_NAMESPACE,
					inject: injectSettingsFace
				}, ImageGenerationSettingsCard));
			};
			const credentialsRef = { current: asCredentialsRemote(ctx.get("remote.credentials")) ?? credentialsFromLegacyConnection(ctx.get("connection")) };
			/** Stable delegating remote so the host-cached inject face never goes stale. */
			const credentialsProxy = {
				describe(refs) {
					const remote = credentialsRef.current;
					return remote === void 0 ? Promise.resolve({ ok: false }) : remote.describe(refs);
				},
				set(ref, value) {
					const remote = credentialsRef.current;
					return remote === void 0 ? Promise.resolve({
						ok: false,
						error: { message: "credentials service unavailable" }
					}) : remote.set(ref, value);
				},
				get unset() {
					const remote = credentialsRef.current;
					return remote?.unset?.bind(remote);
				}
			};
			/** False while the host core exposes no credentials service (preview cores). */
			const credentialsAvailable = () => credentialsRef.current !== void 0;
			injectSettingsItem(ctx);
			ctx.inject(["remote.credentials"], (remoteCtx) => {
				const credentials = asCredentialsRemote(remoteCtx.get("remote.credentials"));
				if (credentials === void 0) {
					console.warn("dsh-image-gen: remote.credentials resolved with an incompatible interface; key settings stay degraded");
					return;
				}
				credentialsRef.current = credentials;
				notifyCredentialsUpdated();
			});
		}
		function asCredentialsRemote(value) {
			if (value === null || typeof value !== "object") return void 0;
			const candidate = value;
			return typeof candidate.describe === "function" && typeof candidate.set === "function" ? candidate : void 0;
		}
		function credentialsFromLegacyConnection(value) {
			if (value === null || typeof value !== "object") return void 0;
			const credentials = value.api?.credentials;
			if (credentials === void 0 || typeof credentials.describe !== "function" || typeof credentials.set !== "function") return void 0;
			const legacy = credentials;
			return {
				async describe(refs) {
					const response = await legacy.describe({ refs });
					return response.result.ok ? {
						ok: true,
						value: response.result.value.credentials
					} : { ok: false };
				},
				async set(ref, credentialValue) {
					const response = await legacy.set({
						ref,
						value: credentialValue
					});
					return response.result.ok ? { ok: true } : {
						ok: false,
						error: response.result.error
					};
				}
			};
		}
		function emptyProviderRow() {
			return {
				expanded: false,
				model: "",
				baseURL: "",
				keyInput: "",
				keyStatus: "checking",
				keyInfo: void 0,
				testing: false,
				testResult: void 0,
				fetchingModels: false,
				modelOptions: [],
				modelFetchMessage: "",
				modelFetchIsError: false,
				saving: false,
				message: "",
				messageIsError: false,
				workflows: [],
				activeWorkflow: "",
				timeoutSeconds: DEFAULT_COMFYUI_TIMEOUT_MS / 1e3,
				editFormat: "multipart",
				editExtraText: "",
				outputFormat: "jpeg",
				watermark: true,
				background: "opaque"
			};
		}
		/** Settings field each cloud provider persists its model under. */
		const CLOUD_MODEL_FIELDS = {
			google: "googleModel",
			openai: "openaiModel",
			"openai-compat": "openaiCompatModel",
			seedream: "seedreamModel",
			dashscope: "dashscopeModel",
			xai: "xaiModel",
			zhipu: "zhipuModel"
		};
		/** Settings field each cloud provider persists its endpoint or base URL under. */
		const CLOUD_URL_FIELDS = {
			google: "googleEndpoint",
			openai: "openaiBaseURL",
			"openai-compat": "openaiCompatBaseURL",
			seedream: "seedreamBaseURL",
			dashscope: "dashscopeEndpoint",
			xai: "xaiBaseURL",
			zhipu: "zhipuBaseURL"
		};
		/** Dictionary key of each cloud provider's endpoint hint. */
		const CLOUD_HINT_KEYS = {
			google: "endpointHintGoogle",
			openai: "endpointHintOpenAI",
			"openai-compat": "endpointHintOpenAICompat",
			seedream: "endpointHintSeedream",
			dashscope: "endpointHintDashScope",
			xai: "endpointHintXAI",
			zhipu: "endpointHintZhipu"
		};
		/** Config field a cloud provider persists its model under. */
		function modelFieldOf(provider) {
			return CLOUD_MODEL_FIELDS[provider];
		}
		/** Config field a cloud provider persists its endpoint or base URL under. */
		function baseURLFieldOf(provider) {
			return CLOUD_URL_FIELDS[provider];
		}
		/** Providers whose settings row offers the "pull models" button. */
		function modelPullSupported(_provider) {
			return true;
		}
		/** Serialize the extra-fields record into editor text; empty record becomes ''. */
		function editExtraTextOf(value) {
			if (value === void 0 || Object.keys(value).length === 0) return "";
			try {
				return JSON.stringify(value);
			} catch {
				return "";
			}
		}
		/** Build one row per provider from persisted settings, including ComfyUI extras. */
		function rowsFromSettings(value) {
			const rows = {};
			for (const provider of IMAGE_PROVIDERS) rows[provider] = {
				...emptyProviderRow(),
				model: modelOf(provider, value),
				baseURL: baseURLOf(provider, value),
				...provider === "comfyui" ? {
					workflows: resolveComfyUIWorkflows(value ?? {}),
					activeWorkflow: activeComfyUIWorkflow(value ?? {})?.name ?? "",
					timeoutSeconds: Math.max(1, Math.round((value?.comfyuiTimeoutMs ?? 3e5) / 1e3))
				} : {},
				...provider === "openai-compat" ? {
					editFormat: value?.openaiCompatEditFormat === "jsonImageUrlArray" ? "jsonImageUrlArray" : "multipart",
					editExtraText: editExtraTextOf(value?.openaiCompatEditExtra)
				} : {},
				...provider === "seedream" ? {
					outputFormat: value?.seedreamOutputFormat === "png" ? "png" : "jpeg",
					watermark: value?.seedreamWatermark !== false,
					background: value?.seedreamBackground === "transparent" ? "transparent" : "opaque"
				} : {}
			};
			return rows;
		}
		/** Edit each provider independently, pick an explicit default, and verify keys inline. */
		function ImageGenerationSettingsCard(props) {
			const [open, setOpen] = (0, react.useState)(false);
			const [snapshot, setSnapshot] = (0, react.useState)(() => props.scope.getSnapshot());
			const [lang, setLang] = (0, react.useState)(() => props.locale?.getSnapshot?.()?.active?.startsWith("en") ? "en" : "zh");
			const [defaultProvider, setDefaultProvider] = (0, react.useState)(() => props.scope.getSnapshot().value?.provider ?? "google");
			const [providerMessage, setProviderMessage] = (0, react.useState)("");
			const [providerMessageIsError, setProviderMessageIsError] = (0, react.useState)(false);
			const [saveToWorkspace, setSaveToWorkspace] = (0, react.useState)(() => props.scope.getSnapshot().value?.saveToWorkspace ?? true);
			const [workspaceFolder, setWorkspaceFolder] = (0, react.useState)(() => props.scope.getSnapshot().value?.workspaceFolder ?? "dsh-image-gen");
			const [workspaceMessage, setWorkspaceMessage] = (0, react.useState)("");
			const [workspaceMessageIsError, setWorkspaceMessageIsError] = (0, react.useState)(false);
			const [rows, setRows] = (0, react.useState)(() => rowsFromSettings(props.scope.getSnapshot().value));
			const [keyTick, setKeyTick] = (0, react.useState)(0);
			const [subStatus, setSubStatus] = (0, react.useState)(() => ({
				"chatgpt-sub": { state: "unknown" },
				"grok-sub": { state: "unknown" },
				"google-sub": { state: "unknown" }
			}));
			const [subTick, setSubTick] = (0, react.useState)(0);
			const [subBusy, setSubBusy] = (0, react.useState)({});
			const [subPending, setSubPending] = (0, react.useState)([]);
			(0, react.useEffect)(() => props.scope.subscribe(() => {
				setSnapshot(props.scope.getSnapshot());
			}), [props.scope]);
			(0, react.useEffect)(() => {
				return props.locale?.subscribe?.(() => {
					setLang(props.locale?.getSnapshot?.()?.active?.startsWith("en") ? "en" : "zh");
				});
			}, [props.locale]);
			const credentialEvents = props.credentialEvents;
			(0, react.useEffect)(() => credentialEvents?.listen(() => {
				setKeyTick((tick) => tick + 1);
			}), [credentialEvents]);
			const pending = subPending;
			(0, react.useEffect)(() => {
				if (!open) return void 0;
				let active = true;
				const probe = async () => {
					try {
						const response = await fetch(SUBSCRIPTION_STATUS_ROUTE, {
							method: "POST",
							cache: "no-store"
						});
						if (!response.ok) return;
						const payload = await response.json();
						if (!active || payload.statuses === void 0) return;
						const next = {
							"chatgpt-sub": { state: "unknown" },
							"grok-sub": { state: "unknown" },
							"google-sub": { state: "unknown" }
						};
						for (const provider of SUBSCRIPTION_PROVIDERS) {
							const row = payload.statuses[provider];
							if (row?.state === "logged-in") next[provider] = {
								state: "logged-in",
								...typeof row.email === "string" ? { email: row.email } : {}
							};
							else if (row?.state === "logged-out") next[provider] = { state: "logged-out" };
						}
						setSubStatus(next);
						const landed = pending.filter((entry) => next[entry.provider].state === "logged-in");
						if (landed.length > 0) {
							setSubPending((current) => current.filter((entry) => next[entry.provider].state !== "logged-in"));
							for (const entry of landed) updateRow(entry.provider, {
								message: t("subLoginOk"),
								messageIsError: false
							});
						}
						const WINDOW_MS = 63e4;
						if (pending.filter((entry) => Date.now() - entry.startedAt > WINDOW_MS).length > 0) setSubPending((current) => current.filter((entry) => Date.now() - entry.startedAt <= WINDOW_MS));
					} catch {}
				};
				probe();
				let timer;
				if (pending.length > 0) timer = setInterval(() => {
					probe();
				}, 2e3);
				const onFocus = () => {
					probe();
				};
				window.addEventListener("focus", onFocus);
				return () => {
					active = false;
					if (timer !== void 0) clearInterval(timer);
					window.removeEventListener("focus", onFocus);
				};
			}, [
				open,
				subTick,
				pending
			]);
			/** Start a subscription login: the host registers PKCE and the loopback
			* catch server, then the browser opens the vendor's authorize URL. The
			* provider joins the pending set so the badge polls until login lands. */
			const subscriptionLogin = async (provider) => {
				updateRow(provider, {
					message: "",
					messageIsError: false
				});
				setSubBusy((current) => ({
					...current,
					[provider]: "login"
				}));
				try {
					const response = await fetch(SUBSCRIPTION_LOGIN_ROUTE, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ provider })
					});
					const payload = await response.json().catch(() => ({}));
					if (!response.ok || payload.ok !== true || typeof payload.url !== "string") {
						const detail = typeof payload.error === "string" ? payload.error : payload.error?.message;
						throw new Error(detail ?? `HTTP ${String(response.status)}`);
					}
					setSubPending((current) => [...current.filter((entry) => entry.provider !== provider), {
						provider,
						startedAt: Date.now()
					}]);
					window.open(payload.url, "_blank", "noopener");
					updateRow(provider, {
						message: t("subWaitingLogin"),
						messageIsError: false
					});
				} catch (cause) {
					updateRow(provider, {
						message: cause instanceof Error ? cause.message : String(cause),
						messageIsError: true
					});
				} finally {
					setSubBusy((current) => {
						const next = { ...current };
						delete next[provider];
						return next;
					});
				}
			};
			/** Sign out one subscription account; nothing else changes. */
			const subscriptionLogout = async (provider) => {
				setSubBusy((current) => ({
					...current,
					[provider]: "logout"
				}));
				try {
					const response = await fetch(SUBSCRIPTION_LOGIN_ROUTE, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							provider,
							action: "logout"
						})
					});
					if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
					updateRow(provider, {
						message: "",
						messageIsError: false
					});
				} catch (cause) {
					updateRow(provider, {
						message: cause instanceof Error ? cause.message : String(cause),
						messageIsError: true
					});
				} finally {
					setSubBusy((current) => {
						const next = { ...current };
						delete next[provider];
						return next;
					});
					setSubTick((tick) => tick + 1);
				}
			};
			const t = (keyName, params) => {
				let text = (lang === "en" ? DICT.en : DICT.zh)[keyName] || DICT.zh[keyName] || keyName;
				if (params) for (const [k, v] of Object.entries(params)) text = text.replace(`{${k}}`, v);
				return text;
			};
			const providerLabels = {
				google: t("providerGoogle"),
				openai: t("providerOpenAI"),
				"openai-compat": t("providerOpenAICompat"),
				seedream: t("providerSeedream"),
				dashscope: t("providerDashScope"),
				xai: t("providerXAI"),
				zhipu: t("providerZhipu"),
				comfyui: t("providerComfyUI"),
				"chatgpt-sub": t("providerChatGPTSub"),
				"grok-sub": t("providerGrokSub"),
				"google-sub": t("providerGoogleSub")
			};
			(0, react.useEffect)(() => {
				const value = snapshot.value;
				setDefaultProvider(value?.provider ?? "google");
				setSaveToWorkspace(value?.saveToWorkspace ?? true);
				setWorkspaceFolder(value?.workspaceFolder ?? "dsh-image-gen");
				setRows((current) => {
					const next = {};
					for (const provider of IMAGE_PROVIDERS) next[provider] = {
						...current[provider],
						model: modelOf(provider, value),
						baseURL: baseURLOf(provider, value),
						...provider === "comfyui" ? {
							workflows: resolveComfyUIWorkflows(value ?? {}),
							activeWorkflow: activeComfyUIWorkflow(value ?? {})?.name ?? "",
							timeoutSeconds: Math.max(1, Math.round((value?.comfyuiTimeoutMs ?? 3e5) / 1e3))
						} : {},
						...provider === "seedream" ? {
							outputFormat: value?.seedreamOutputFormat === "png" ? "png" : "jpeg",
							watermark: value?.seedreamWatermark !== false,
							background: value?.seedreamBackground === "transparent" ? "transparent" : "opaque"
						} : {}
					};
					return next;
				});
			}, [snapshot]);
			const credentials = props.credentials;
			const credentialsAvailable = props.credentialsAvailable;
			(0, react.useEffect)(() => {
				let active = true;
				if (!credentialsAvailable()) {
					setRows((current) => {
						const next = { ...current };
						for (const provider of CLOUD_IMAGE_PROVIDERS) next[provider] = {
							...current[provider],
							keyStatus: "unavailable",
							keyInfo: void 0
						};
						return next;
					});
					return () => {
						active = false;
					};
				}
				for (const provider of CLOUD_IMAGE_PROVIDERS) {
					const keyRef = cloudCredentialRef(provider);
					if (keyRef === void 0) continue;
					setRows((current) => ({
						...current,
						[provider]: {
							...current[provider],
							keyStatus: "checking"
						}
					}));
					credentials.describe([keyRef]).then((response) => {
						if (!active) return;
						const info = response.ok ? response.value?.[keyRef] : void 0;
						setRows((current) => ({
							...current,
							[provider]: {
								...current[provider],
								keyStatus: response.ok ? info?.configured ? "configured" : "missing" : "unknown",
								keyInfo: info
							}
						}));
					}).catch(() => {
						if (!active) return;
						setRows((current) => ({
							...current,
							[provider]: {
								...current[provider],
								keyStatus: "unknown"
							}
						}));
					});
				}
				return () => {
					active = false;
				};
			}, [
				credentials,
				credentialsAvailable,
				keyTick
			]);
			const updateRow = (provider, patch) => {
				setRows((current) => ({
					...current,
					[provider]: {
						...current[provider],
						...patch
					}
				}));
			};
			/** The only action that ever changes the default provider; saving a key never does. */
			const selectDefaultProvider = (provider) => {
				setDefaultProvider(provider);
				setProviderMessage("");
				setProviderMessageIsError(false);
				props.scope.set("provider", provider).catch((cause) => {
					setDefaultProvider(snapshot.value?.provider ?? "google");
					setProviderMessage(cause instanceof Error ? cause.message : String(cause));
					setProviderMessageIsError(true);
				});
			};
			const saveProviderRow = async (provider) => {
				const row = rows[provider];
				updateRow(provider, {
					saving: true,
					message: "",
					messageIsError: false
				});
				try {
					if (provider === "comfyui") {
						const entries = row.workflows.map((entry) => ({
							name: entry.name.trim(),
							json: entry.json,
							presetPrompt: (entry.presetPrompt ?? "").trim()
						}));
						for (const entry of entries) {
							if (entry.name.length === 0) throw new Error(t("workflowNameRequired"));
							validateComfyUIWorkflowJson(entry.json);
						}
						if (new Set(entries.map((entry) => entry.name)).size !== entries.length) throw new Error(t("workflowDuplicateName"));
						const activeEntry = entries.find((entry) => entry.name === row.activeWorkflow) ?? entries[0];
						await props.scope.set("comfyuiBaseURL", row.baseURL);
						await props.scope.set("comfyuiWorkflows", entries);
						await props.scope.set("comfyuiActiveWorkflow", activeEntry === void 0 ? "" : activeEntry.name);
						await props.scope.set("comfyuiWorkflowJson", activeEntry === void 0 ? "" : activeEntry.json);
						await props.scope.set("comfyuiWorkflowName", activeEntry === void 0 ? "" : activeEntry.name);
						await props.scope.set("comfyuiTimeoutMs", Math.max(1, Math.round(row.timeoutSeconds)) * 1e3);
					} else if (isSubscriptionProvider(provider)) await Promise.resolve();
					else {
						let editExtra = {};
						if (provider === "openai-compat") {
							const extraText = row.editExtraText.trim();
							if (extraText.length > 0) {
								let parsed;
								try {
									parsed = JSON.parse(extraText);
								} catch {
									throw new Error(t("editExtraInvalid"));
								}
								if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error(t("editExtraInvalid"));
								editExtra = parsed;
							}
						}
						await props.scope.set(modelFieldOf(provider), row.model);
						await props.scope.set(baseURLFieldOf(provider), row.baseURL);
						if (provider === "openai-compat") {
							await props.scope.set("openaiCompatEditFormat", row.editFormat);
							await props.scope.set("openaiCompatEditExtra", editExtra);
						}
						if (provider === "seedream") {
							await props.scope.set("seedreamOutputFormat", row.outputFormat);
							await props.scope.set("seedreamWatermark", row.watermark);
							await props.scope.set("seedreamBackground", row.background);
						}
						if (row.keyInput.trim().length > 0) {
							const keyRef = cloudCredentialRef(provider);
							if (keyRef === void 0) throw new Error(t("comfyuiNoKey"));
							if (!credentialsAvailable()) throw new Error(t("credentialsUnavailable"));
							const response = await props.credentials.set(keyRef, row.keyInput.trim());
							if (!response.ok) throw new Error(response.error?.message ?? t("saveKeyFailed"));
							updateRow(provider, {
								keyInput: "",
								keyStatus: "configured"
							});
						}
					}
					updateRow(provider, {
						message: t("saved"),
						messageIsError: false,
						testResult: void 0,
						modelFetchMessage: "",
						modelFetchIsError: false
					});
				} catch (cause) {
					updateRow(provider, {
						message: cause instanceof Error ? cause.message : String(cause),
						messageIsError: true
					});
				} finally {
					updateRow(provider, { saving: false });
				}
			};
			/** Probe through the host route so the browser side never touches credential values. */
			const testConnection = async (provider) => {
				if (rows[provider].keyInput.trim().length > 0) {
					updateRow(provider, {
						message: t("saveKeyFirst"),
						messageIsError: false,
						testResult: void 0
					});
					return;
				}
				updateRow(provider, {
					testing: true,
					testResult: void 0,
					message: "",
					messageIsError: false
				});
				try {
					const response = await fetch(TEST_CONNECTION_ROUTE, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ provider })
					});
					if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
					updateRow(provider, { testResult: await response.json() });
				} catch (cause) {
					updateRow(provider, { testResult: {
						ok: false,
						reason: "error",
						message: cause instanceof Error ? cause.message : String(cause)
					} });
				} finally {
					updateRow(provider, { testing: false });
				}
			};
			/** Pull the provider's image-capable model ids through the host route (Google and the OpenAI family). */
			const fetchProviderModels = async (provider) => {
				if (rows[provider].keyInput.trim().length > 0) {
					updateRow(provider, {
						modelFetchMessage: t("saveKeyFirst"),
						modelFetchIsError: false
					});
					return;
				}
				updateRow(provider, {
					fetchingModels: true,
					modelFetchMessage: "",
					modelFetchIsError: false
				});
				try {
					const response = await fetch(TEST_CONNECTION_ROUTE, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							provider,
							action: "models"
						})
					});
					if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
					const payload = await response.json();
					if (payload.ok && Array.isArray(payload.models)) {
						const models = payload.models.filter((id) => typeof id === "string");
						updateRow(provider, {
							modelOptions: models,
							modelFetchMessage: models.length > 0 ? t("modelsFound", { n: String(models.length) }) : t("modelsNone"),
							modelFetchIsError: models.length === 0
						});
					} else if (payload.reason === "missing-key") updateRow(provider, {
						modelFetchMessage: t("badgeMissing"),
						modelFetchIsError: true
					});
					else if (payload.reason === "unauthorized") updateRow(provider, {
						modelFetchMessage: t("testUnauthorized"),
						modelFetchIsError: true
					});
					else updateRow(provider, {
						modelFetchMessage: payload.message ?? t("testFailed"),
						modelFetchIsError: true
					});
				} catch (cause) {
					updateRow(provider, {
						modelFetchMessage: cause instanceof Error ? cause.message : String(cause),
						modelFetchIsError: true
					});
				} finally {
					updateRow(provider, { fetchingModels: false });
				}
			};
			const clearProviderKey = async (provider) => {
				const keyRef = cloudCredentialRef(provider);
				if (keyRef === void 0) return;
				if (typeof props.credentials.unset !== "function") {
					updateRow(provider, {
						message: t("clearKeyUnsupported"),
						messageIsError: true
					});
					return;
				}
				updateRow(provider, {
					saving: true,
					message: "",
					messageIsError: false
				});
				try {
					const response = await props.credentials.unset(keyRef);
					if (!response.ok) throw new Error(response.error?.message ?? t("clearKeyFailed"));
					updateRow(provider, {
						keyStatus: "missing",
						keyInput: "",
						testResult: void 0,
						message: t("keyCleared"),
						messageIsError: false
					});
				} catch (cause) {
					updateRow(provider, {
						message: cause instanceof Error ? cause.message : String(cause),
						messageIsError: true
					});
				} finally {
					updateRow(provider, { saving: false });
				}
			};
			const testResultText = (result) => {
				if (result === void 0) return "";
				if (result.ok) return t("testOk");
				if (result.reason === "missing-key") return t("badgeMissing");
				if (result.reason === "unauthorized") return t("testUnauthorized");
				return `${t("testFailed")}${result.message !== void 0 && result.message.length > 0 ? `: ${result.message}` : ""}`;
			};
			const badgeOf = (provider) => {
				if (provider === "comfyui") return {
					text: t("comfyuiNoKey"),
					className: "dsh-ig-badge dsh-ig-badge-neutral"
				};
				if (isSubscriptionProvider(provider)) {
					const status = subStatus[provider].state;
					if (status === "logged-in") return {
						text: t("subBadgeLoggedIn"),
						className: "dsh-ig-badge dsh-ig-badge-ok"
					};
					if (status === "logged-out") return {
						text: t("subBadgeLoggedOut"),
						className: "dsh-ig-badge dsh-ig-badge-missing"
					};
					return {
						text: t("subBadgeUnknown"),
						className: "dsh-ig-badge dsh-ig-badge-neutral"
					};
				}
				const status = rows[provider].keyStatus;
				if (status === "checking") return {
					text: t("badgeChecking"),
					className: "dsh-ig-badge dsh-ig-badge-neutral dsh-ig-badge-checking"
				};
				if (status === "configured") return {
					text: t("badgeConfigured"),
					className: "dsh-ig-badge dsh-ig-badge-ok"
				};
				if (status === "missing") return {
					text: t("badgeMissing"),
					className: "dsh-ig-badge dsh-ig-badge-missing"
				};
				if (status === "unavailable") return {
					text: t("badgeUnavailable"),
					className: "dsh-ig-badge dsh-ig-badge-neutral"
				};
				return {
					text: t("badgeUnknown"),
					className: "dsh-ig-badge dsh-ig-badge-neutral"
				};
			};
			const importWorkflow = async (event) => {
				const file = event.target.files?.[0];
				event.target.value = "";
				if (file === void 0) return;
				updateRow("comfyui", {
					message: "",
					messageIsError: false
				});
				try {
					if (file.size > 5242880) throw new Error(t("workflowTooLarge"));
					const json = await file.text();
					validateComfyUIWorkflowJson(json);
					const name = uniqueComfyUIWorkflowName(file.name, rows.comfyui.workflows.map((entry) => entry.name));
					setRows((current) => ({
						...current,
						comfyui: {
							...current.comfyui,
							workflows: [...current.comfyui.workflows, {
								name,
								json
							}],
							activeWorkflow: current.comfyui.activeWorkflow.length > 0 ? current.comfyui.activeWorkflow : name
						}
					}));
					updateRow("comfyui", {
						message: t("workflowImported", { name }),
						messageIsError: false
					});
				} catch (cause) {
					updateRow("comfyui", {
						message: cause instanceof Error ? cause.message : String(cause),
						messageIsError: true
					});
				}
			};
			/** Renaming the active entry keeps the active selection following its new name. */
			const renameWorkflow = (index, name) => {
				setRows((current) => {
					const previous = current.comfyui.workflows[index];
					const workflows = current.comfyui.workflows.map((entry, position) => position === index ? {
						...entry,
						name
					} : entry);
					const activeWorkflow = previous !== void 0 && previous.name === current.comfyui.activeWorkflow ? name : current.comfyui.activeWorkflow;
					return {
						...current,
						comfyui: {
							...current.comfyui,
							workflows,
							activeWorkflow
						}
					};
				});
			};
			/** Removing the active entry moves the selection to the first remaining workflow. */
			const removeWorkflow = (index) => {
				setRows((current) => {
					const previous = current.comfyui.workflows[index];
					const workflows = current.comfyui.workflows.filter((_entry, position) => position !== index);
					const activeWorkflow = previous !== void 0 && previous.name === current.comfyui.activeWorkflow ? workflows[0]?.name ?? "" : current.comfyui.activeWorkflow;
					return {
						...current,
						comfyui: {
							...current.comfyui,
							workflows,
							activeWorkflow
						}
					};
				});
			};
			/** Editing one entry's preset leaves the rest of the entry untouched. */
			const setWorkflowPreset = (index, presetPrompt) => {
				setRows((current) => {
					const workflows = current.comfyui.workflows.map((entry, position) => position === index ? {
						...entry,
						presetPrompt
					} : entry);
					return {
						...current,
						comfyui: {
							...current.comfyui,
							workflows
						}
					};
				});
			};
			/** Workspace checkbox persists immediately, like every other toggle on this card. */
			const toggleSaveToWorkspace = (next) => {
				setSaveToWorkspace(next);
				setWorkspaceMessage("");
				setWorkspaceMessageIsError(false);
				props.scope.set("saveToWorkspace", next).catch((cause) => {
					setSaveToWorkspace(snapshot.value?.saveToWorkspace ?? true);
					setWorkspaceMessage(cause instanceof Error ? cause.message : String(cause));
					setWorkspaceMessageIsError(true);
				});
			};
			/** Folder input persists on Enter or blur; no save button needed. */
			const commitWorkspaceFolder = () => {
				const next = workspaceFolder.trim();
				if (next === (snapshot.value?.workspaceFolder ?? "dsh-image-gen")) return;
				setWorkspaceMessage("");
				setWorkspaceMessageIsError(false);
				props.scope.set("workspaceFolder", next).then(() => {
					setWorkspaceMessage(t("saved"));
				}).catch((cause) => {
					setWorkspaceFolder(snapshot.value?.workspaceFolder ?? "dsh-image-gen");
					setWorkspaceMessage(cause instanceof Error ? cause.message : String(cause));
					setWorkspaceMessageIsError(true);
				});
			};
			const renderCloudBody = (provider) => {
				const row = rows[provider];
				const pickOptions = row.model.length > 0 && !row.modelOptions.includes(row.model) ? [row.model, ...row.modelOptions] : row.modelOptions;
				const keyRef = cloudCredentialRef(provider) ?? "";
				const keyReadOnly = row.keyInfo?.writable === false;
				const keyUnavailable = !credentialsAvailable();
				return (0, react_jsx_runtime.jsx)("div", {
					className: "dsh-ig-provider-body",
					children: (0, react_jsx_runtime.jsxs)("form", {
						onSubmit: (event) => {
							event.preventDefault();
							saveProviderRow(provider);
						},
						children: [
							(0, react_jsx_runtime.jsxs)("label", {
								className: "dsh-ig-field",
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-label",
										children: t("apiKeyLabel", { provider: providerLabels[provider] })
									}),
									(0, react_jsx_runtime.jsx)("input", {
										className: "dsh-ig-input",
										type: "password",
										autoComplete: "off",
										value: row.keyInput,
										onChange: (event) => {
											updateRow(provider, { keyInput: event.target.value });
										},
										placeholder: row.keyStatus === "configured" ? t("apiKeyPlaceholder") : "",
										disabled: !snapshot.writable || keyReadOnly || keyUnavailable
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-hint",
										children: keyUnavailable ? t("credentialsUnavailable") : keyReadOnly ? t("keyReadOnly", { source: row.keyInfo?.source ?? "" }) : t("apiKeyHint", { key: keyRef })
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("label", {
								className: "dsh-ig-field",
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-label",
										children: t("endpoint")
									}),
									(0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-ig-input-group",
										children: [(0, react_jsx_runtime.jsx)("input", {
											className: "dsh-ig-input",
											type: "url",
											value: row.baseURL,
											onChange: (event) => {
												updateRow(provider, { baseURL: event.target.value });
											},
											required: true,
											disabled: !snapshot.writable
										}), provider !== "openai-compat" ? (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-ig-btn-reset",
											title: t("resetTitle"),
											onClick: () => {
												updateRow(provider, { baseURL: DEFAULT_BASE_URLS[provider] });
											},
											disabled: !snapshot.writable,
											children: t("reset")
										}) : null]
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-hint",
										children: t(CLOUD_HINT_KEYS[provider])
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("label", {
								className: "dsh-ig-field",
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-label",
										children: t("model")
									}),
									modelPullSupported(provider) ? (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-ig-input-group",
										children: [
											(0, react_jsx_runtime.jsx)("input", {
												className: "dsh-ig-input",
												value: row.model,
												onChange: (event) => {
													updateRow(provider, { model: event.target.value });
												},
												list: `dsh-ig-${provider}-model-options`,
												required: provider !== "openai-compat",
												disabled: !snapshot.writable
											}),
											(0, react_jsx_runtime.jsx)("datalist", {
												id: `dsh-ig-${provider}-model-options`,
												children: row.modelOptions.map((id) => (0, react_jsx_runtime.jsx)("option", { value: id }, id))
											}),
											(0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dsh-ig-btn-secondary",
												disabled: row.fetchingModels || row.saving || !snapshot.writable,
												onClick: () => {
													fetchProviderModels(provider);
												},
												children: row.fetchingModels ? t("fetchingModels") : t("fetchModels")
											})
										]
									}) : (0, react_jsx_runtime.jsx)("input", {
										className: "dsh-ig-input",
										value: row.model,
										onChange: (event) => {
											updateRow(provider, { model: event.target.value });
										},
										required: true,
										disabled: !snapshot.writable
									}),
									modelPullSupported(provider) ? row.modelFetchMessage.length > 0 ? (0, react_jsx_runtime.jsx)("span", {
										className: `dsh-ig-hint${row.modelFetchIsError ? " dsh-ig-hint-error" : ""}`,
										role: "status",
										children: row.modelFetchMessage
									}) : (0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-hint",
										children: t("fetchModelsHint")
									}) : null
								]
							}),
							modelPullSupported(provider) && row.modelOptions.length > 0 ? (0, react_jsx_runtime.jsxs)("label", {
								className: "dsh-ig-field",
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: "dsh-ig-label",
									children: t("modelPick")
								}), (0, react_jsx_runtime.jsxs)("select", {
									className: "dsh-ig-input dsh-ig-select",
									value: row.model.length > 0 ? row.model : "",
									onChange: (event) => {
										if (event.target.value.length > 0) updateRow(provider, { model: event.target.value });
									},
									disabled: !snapshot.writable,
									children: [(0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: t("modelPickPlaceholder", { count: String(row.modelOptions.length) })
									}), pickOptions.map((id) => (0, react_jsx_runtime.jsx)("option", {
										value: id,
										children: row.modelOptions.includes(id) ? id : `${id} ${t("modelPickCurrent")}`
									}, id))]
								})]
							}) : null,
							provider === "openai-compat" ? (0, react_jsx_runtime.jsxs)("label", {
								className: "dsh-ig-field",
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-label",
										children: t("editFormat")
									}),
									(0, react_jsx_runtime.jsxs)("select", {
										className: "dsh-ig-input",
										value: row.editFormat,
										onChange: (event) => {
											updateRow(provider, { editFormat: event.target.value === "jsonImageUrlArray" ? "jsonImageUrlArray" : "multipart" });
										},
										disabled: !snapshot.writable,
										children: [(0, react_jsx_runtime.jsx)("option", {
											value: "multipart",
											children: t("editFormatMultipart")
										}), (0, react_jsx_runtime.jsx)("option", {
											value: "jsonImageUrlArray",
											children: t("editFormatJsonImageUrlArray")
										})]
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-hint",
										children: t("editFormatHint")
									})
								]
							}) : null,
							provider === "seedream" ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								(0, react_jsx_runtime.jsxs)("label", {
									className: "dsh-ig-field",
									children: [
										(0, react_jsx_runtime.jsx)("span", {
											className: "dsh-ig-label",
											children: t("arkOutputFormat")
										}),
										(0, react_jsx_runtime.jsxs)("select", {
											className: "dsh-ig-input",
											value: row.outputFormat,
											onChange: (event) => {
												updateRow(provider, { outputFormat: event.target.value === "png" ? "png" : "jpeg" });
											},
											disabled: !snapshot.writable,
											children: [(0, react_jsx_runtime.jsx)("option", {
												value: "jpeg",
												children: t("arkOutputFormatJpeg")
											}), (0, react_jsx_runtime.jsx)("option", {
												value: "png",
												children: t("arkOutputFormatPng")
											})]
										}),
										(0, react_jsx_runtime.jsx)("span", {
											className: "dsh-ig-hint",
											children: t("arkOutputFormatHint")
										})
									]
								}),
								(0, react_jsx_runtime.jsxs)("label", {
									className: "dsh-ig-field",
									children: [
										(0, react_jsx_runtime.jsx)("span", {
											className: "dsh-ig-label",
											children: t("arkWatermark")
										}),
										(0, react_jsx_runtime.jsxs)("select", {
											className: "dsh-ig-input",
											value: row.watermark ? "on" : "off",
											onChange: (event) => {
												updateRow(provider, { watermark: event.target.value === "on" });
											},
											disabled: !snapshot.writable,
											children: [(0, react_jsx_runtime.jsx)("option", {
												value: "on",
												children: t("arkWatermarkOn")
											}), (0, react_jsx_runtime.jsx)("option", {
												value: "off",
												children: t("arkWatermarkOff")
											})]
										}),
										(0, react_jsx_runtime.jsx)("span", {
											className: "dsh-ig-hint",
											children: t("arkWatermarkHint")
										})
									]
								}),
								(0, react_jsx_runtime.jsxs)("label", {
									className: "dsh-ig-field",
									children: [
										(0, react_jsx_runtime.jsx)("span", {
											className: "dsh-ig-label",
											children: t("arkBackground")
										}),
										(0, react_jsx_runtime.jsxs)("select", {
											className: "dsh-ig-input",
											value: row.background,
											onChange: (event) => {
												updateRow(provider, { background: event.target.value === "transparent" ? "transparent" : "opaque" });
											},
											disabled: !snapshot.writable,
											children: [(0, react_jsx_runtime.jsx)("option", {
												value: "opaque",
												children: t("arkBackgroundOpaque")
											}), (0, react_jsx_runtime.jsx)("option", {
												value: "transparent",
												children: t("arkBackgroundTransparent")
											})]
										}),
										(0, react_jsx_runtime.jsx)("span", {
											className: "dsh-ig-hint",
											children: t("arkBackgroundHint")
										})
									]
								})
							] }) : null,
							provider === "openai-compat" && row.editFormat === "jsonImageUrlArray" ? (0, react_jsx_runtime.jsxs)("label", {
								className: "dsh-ig-field",
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-label",
										children: t("editExtra")
									}),
									(0, react_jsx_runtime.jsx)("textarea", {
										className: "dsh-ig-input dsh-ig-textarea",
										value: row.editExtraText,
										onChange: (event) => {
											updateRow(provider, { editExtraText: event.target.value });
										},
										placeholder: t("editExtraPlaceholder"),
										rows: 2,
										disabled: !snapshot.writable
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-hint",
										children: t("editExtraHint")
									})
								]
							}) : null,
							(0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-ig-row-actions",
								children: [(0, react_jsx_runtime.jsx)("p", {
									className: `dsh-ig-status${row.messageIsError ? " dsh-ig-status-error" : ""}`,
									role: "status",
									children: row.message || testResultText(row.testResult)
								}), (0, react_jsx_runtime.jsxs)("span", {
									className: "dsh-ig-row-buttons",
									children: [
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-ig-btn-secondary",
											disabled: row.testing || row.saving,
											onClick: () => {
												testConnection(provider);
											},
											children: row.testing ? t("testing") : t("testConnection")
										}),
										row.keyStatus === "configured" && !keyReadOnly ? (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-ig-btn-secondary dsh-ig-btn-danger",
											disabled: row.saving,
											onClick: () => {
												clearProviderKey(provider);
											},
											children: t("clearKey")
										}) : null,
										(0, react_jsx_runtime.jsx)("button", {
											className: "dsh-ig-save",
											type: "submit",
											disabled: row.saving || row.testing || row.fetchingModels || !snapshot.writable,
											children: row.saving ? t("saving") : t("save")
										})
									]
								})]
							})
						]
					})
				});
			};
			const renderComfyUIBody = () => {
				const row = rows.comfyui;
				return (0, react_jsx_runtime.jsx)("div", {
					className: "dsh-ig-provider-body",
					children: (0, react_jsx_runtime.jsxs)("form", {
						onSubmit: (event) => {
							event.preventDefault();
							saveProviderRow("comfyui");
						},
						children: [
							(0, react_jsx_runtime.jsxs)("label", {
								className: "dsh-ig-field",
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-label",
										children: t("endpoint")
									}),
									(0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-ig-input-group",
										children: [(0, react_jsx_runtime.jsx)("input", {
											className: "dsh-ig-input",
											type: "url",
											value: row.baseURL,
											onChange: (event) => {
												updateRow("comfyui", { baseURL: event.target.value });
											},
											required: true,
											disabled: !snapshot.writable
										}), (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-ig-btn-reset",
											title: t("resetTitle"),
											onClick: () => {
												updateRow("comfyui", { baseURL: DEFAULT_BASE_URLS.comfyui });
											},
											disabled: !snapshot.writable,
											children: t("reset")
										})]
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-hint",
										children: t("endpointHintComfyUI")
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-ig-field",
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-label",
										children: t("workflow")
									}),
									(0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-ig-file-row",
										children: [(0, react_jsx_runtime.jsxs)("label", {
											className: "dsh-ig-file-button",
											children: [(0, react_jsx_runtime.jsx)("input", {
												className: "dsh-ig-file-input",
												type: "file",
												accept: ".json,application/json",
												onChange: (event) => {
													importWorkflow(event);
												}
											}), t("workflowImport")]
										}), row.workflows.length === 0 ? (0, react_jsx_runtime.jsx)("span", {
											className: "dsh-ig-file-name",
											children: t("workflowMissing")
										}) : null]
									}),
									row.workflows.length > 0 ? (0, react_jsx_runtime.jsx)("ul", {
										className: "dsh-ig-workflow-list",
										children: row.workflows.map((entry, index) => (0, react_jsx_runtime.jsxs)("li", {
											className: "dsh-ig-workflow-row",
											children: [(0, react_jsx_runtime.jsxs)("div", {
												className: "dsh-ig-workflow-main",
												children: [
													(0, react_jsx_runtime.jsx)("label", {
														className: "dsh-ig-workflow-active",
														title: t("workflowActiveTitle"),
														children: (0, react_jsx_runtime.jsx)("input", {
															type: "radio",
															name: "dsh-ig-active-workflow",
															"aria-label": t("workflowActiveTitle"),
															checked: entry.name === row.activeWorkflow,
															onChange: () => {
																updateRow("comfyui", { activeWorkflow: entry.name });
															}
														})
													}),
													(0, react_jsx_runtime.jsx)("input", {
														className: "dsh-ig-input dsh-ig-workflow-name",
														value: entry.name,
														title: entry.name,
														onChange: (event) => {
															renameWorkflow(index, event.target.value);
														}
													}),
													(0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dsh-ig-btn-reset",
														onClick: () => {
															removeWorkflow(index);
														},
														children: t("workflowRemove")
													})
												]
											}), (0, react_jsx_runtime.jsx)("input", {
												className: "dsh-ig-input dsh-ig-workflow-preset",
												value: entry.presetPrompt ?? "",
												placeholder: t("workflowPresetPlaceholder"),
												title: t("workflowPresetTitle"),
												onChange: (event) => {
													setWorkflowPreset(index, event.target.value);
												}
											})]
										}, String(index)))
									}) : null,
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-hint",
										children: t("workflowHint")
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("label", {
								className: "dsh-ig-field",
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-label",
										children: t("timeout")
									}),
									(0, react_jsx_runtime.jsx)("input", {
										className: "dsh-ig-input",
										type: "number",
										min: "1",
										max: "3600",
										step: "1",
										value: row.timeoutSeconds,
										onChange: (event) => {
											updateRow("comfyui", { timeoutSeconds: Number(event.target.value) });
										},
										required: true,
										disabled: !snapshot.writable
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-hint",
										children: t("timeoutHint")
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-ig-row-actions",
								children: [(0, react_jsx_runtime.jsx)("p", {
									className: `dsh-ig-status${row.messageIsError ? " dsh-ig-status-error" : ""}`,
									role: "status",
									children: row.message || testResultText(row.testResult)
								}), (0, react_jsx_runtime.jsxs)("span", {
									className: "dsh-ig-row-buttons",
									children: [(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsh-ig-btn-secondary",
										disabled: row.testing,
										onClick: () => {
											testConnection("comfyui");
										},
										children: row.testing ? t("testing") : t("testConnection")
									}), (0, react_jsx_runtime.jsx)("button", {
										className: "dsh-ig-save",
										type: "submit",
										disabled: row.saving || !snapshot.writable || row.workflows.length === 0,
										children: row.saving ? t("saving") : t("save")
									})]
								})]
							})
						]
					})
				});
			};
			/** Subscription rows: account login/logout, fixed model, edit limitation. */
			const renderSubscriptionBody = (provider) => {
				const row = rows[provider];
				const status = subStatus[provider];
				const busy = subBusy[provider];
				return (0, react_jsx_runtime.jsx)("div", {
					className: "dsh-ig-provider-body",
					children: (0, react_jsx_runtime.jsxs)("form", {
						onSubmit: (event) => {
							event.preventDefault();
							saveProviderRow(provider);
						},
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-ig-field",
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: "dsh-ig-label",
									children: t("subSectionTitle")
								}), (0, react_jsx_runtime.jsx)("p", {
									className: "dsh-ig-hint",
									children: t("subHint")
								})]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-ig-field",
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-label",
										children: t("subAccountLabel")
									}),
									(0, react_jsx_runtime.jsx)("p", {
										className: "dsh-ig-hint",
										children: status.state === "logged-in" ? t("subAccountEmail", { email: status.email ?? "" }) : status.state === "logged-out" ? t("subAccountNone") : t("subBadgeUnknown")
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-row-buttons",
										children: status.state === "logged-in" ? (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-ig-btn-secondary",
											disabled: busy !== void 0,
											onClick: () => {
												subscriptionLogout(provider);
											},
											children: busy === "logout" ? t("subLoggingOut") : t("subLogout")
										}) : (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-ig-save",
											disabled: busy !== void 0,
											onClick: () => {
												subscriptionLogin(provider);
												setSubTick((tick) => tick + 1);
											},
											children: busy === "login" ? t("subLoggingIn") : t("subLogin")
										})
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("label", {
								className: "dsh-ig-field",
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-label",
										children: t("subModelLabel")
									}),
									(0, react_jsx_runtime.jsx)("input", {
										className: "dsh-ig-input",
										type: "text",
										value: row.model,
										readOnly: true,
										disabled: true
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-hint",
										children: t("subModelHint")
									})
								]
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: "dsh-ig-field",
								children: (0, react_jsx_runtime.jsx)("span", {
									className: "dsh-ig-hint",
									children: t("subEditCapability")
								})
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-ig-row-actions",
								children: [(0, react_jsx_runtime.jsx)("p", {
									className: `dsh-ig-status${row.messageIsError ? " dsh-ig-status-error" : ""}`,
									role: "status",
									children: row.message || testResultText(row.testResult)
								}), (0, react_jsx_runtime.jsxs)("span", {
									className: "dsh-ig-row-buttons",
									children: [(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsh-ig-btn-secondary",
										disabled: row.testing,
										onClick: () => {
											testConnection(provider);
											setSubTick((tick) => tick + 1);
										},
										children: row.testing ? t("testing") : t("testConnection")
									}), (0, react_jsx_runtime.jsx)("button", {
										className: "dsh-ig-save",
										type: "submit",
										disabled: row.saving || !snapshot.writable,
										children: row.saving ? t("saving") : t("save")
									})]
								})]
							})
						]
					})
				});
			};
			const renderProviderRow = (provider) => {
				const row = rows[provider];
				const badge = badgeOf(provider);
				return (0, react_jsx_runtime.jsxs)("div", {
					className: `dsh-ig-provider-row ${row.expanded ? "dsh-ig-provider-row-open" : ""}`,
					children: [(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "dsh-ig-provider-head",
						"aria-expanded": row.expanded,
						onClick: () => {
							updateRow(provider, { expanded: !row.expanded });
						},
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: "dsh-ig-provider-name",
								children: providerLabels[provider]
							}),
							(0, react_jsx_runtime.jsxs)("span", {
								className: badge.className,
								title: badge.text,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: "dsh-ig-badge-dot",
									"aria-hidden": "true"
								}), badge.text]
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: `dsh-ig-provider-chevron ${row.expanded ? "dsh-ig-provider-chevron-open" : ""}`,
								"aria-hidden": "true",
								children: (0, react_jsx_runtime.jsx)("svg", {
									width: "12",
									height: "12",
									viewBox: "0 0 16 16",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "2",
									strokeLinecap: "round",
									strokeLinejoin: "round",
									children: (0, react_jsx_runtime.jsx)("path", { d: "M4 6l4 4 4-4" })
								})
							})
						]
					}), row.expanded ? provider === "comfyui" ? renderComfyUIBody() : isSubscriptionProvider(provider) ? renderSubscriptionBody(provider) : renderCloudBody(provider) : null]
				}, provider);
			};
			return (0, react_jsx_runtime.jsxs)("li", {
				className: `dsh-ig-card ${open ? "dsh-ig-card-open" : ""}`,
				children: [(0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dsh-ig-head",
					"aria-expanded": open,
					onClick: () => {
						setOpen((value) => !value);
					},
					children: [(0, react_jsx_runtime.jsxs)("span", {
						className: "dsh-ig-head-text",
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: "dsh-ig-title",
							children: t("title")
						}), (0, react_jsx_runtime.jsx)("span", {
							className: "dsh-ig-desc",
							children: t("description")
						})]
					}), (0, react_jsx_runtime.jsx)("span", {
						className: `dsh-ig-chevron ${open ? "dsh-ig-chevron-open" : ""}`,
						"aria-hidden": "true",
						children: (0, react_jsx_runtime.jsx)("svg", {
							width: "14",
							height: "14",
							viewBox: "0 0 16 16",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "2",
							strokeLinecap: "round",
							strokeLinejoin: "round",
							children: (0, react_jsx_runtime.jsx)("path", { d: "M4 6l4 4 4-4" })
						})
					})]
				}), open ? (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-ig-body",
					children: [
						!snapshot.writable ? (0, react_jsx_runtime.jsx)("p", {
							className: "dsh-ig-status dsh-ig-status-readonly",
							role: "note",
							children: t("settingsReadOnly")
						}) : null,
						(0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-ig-field",
							children: [
								(0, react_jsx_runtime.jsx)("span", {
									className: "dsh-ig-label",
									children: t("defaultProvider")
								}),
								(0, react_jsx_runtime.jsx)("div", {
									className: "dsh-ig-radios",
									role: "radiogroup",
									"aria-label": t("defaultProvider"),
									children: IMAGE_PROVIDERS.map((provider) => (0, react_jsx_runtime.jsxs)("label", {
										className: `dsh-ig-radio${defaultProvider === provider ? " dsh-ig-radio-checked" : ""}`,
										children: [(0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: "dsh-ig-default-provider",
											checked: defaultProvider === provider,
											onChange: () => {
												selectDefaultProvider(provider);
											},
											disabled: !snapshot.writable
										}), providerLabels[provider]]
									}, provider))
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: "dsh-ig-hint",
									children: t("defaultProviderHint")
								}),
								providerMessage.length > 0 ? (0, react_jsx_runtime.jsx)("span", {
									className: `dsh-ig-status${providerMessageIsError ? " dsh-ig-status-error" : ""}`,
									role: "status",
									children: providerMessage
								}) : null
							]
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: "dsh-ig-providers",
							children: IMAGE_PROVIDERS.map((provider) => renderProviderRow(provider))
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-ig-section",
							children: [
								(0, react_jsx_runtime.jsx)("span", {
									className: "dsh-ig-section-title",
									children: t("workspaceSection")
								}),
								(0, react_jsx_runtime.jsxs)("div", {
									className: "dsh-ig-field",
									children: [(0, react_jsx_runtime.jsxs)("label", {
										className: "dsh-ig-check-row",
										children: [(0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: saveToWorkspace,
											onChange: (event) => {
												toggleSaveToWorkspace(event.target.checked);
											},
											disabled: !snapshot.writable
										}), (0, react_jsx_runtime.jsx)("span", {
											className: "dsh-ig-label",
											children: t("saveToWorkspace")
										})]
									}), (0, react_jsx_runtime.jsx)("span", {
										className: "dsh-ig-hint",
										children: t("saveToWorkspaceHint")
									})]
								}),
								saveToWorkspace ? (0, react_jsx_runtime.jsxs)("label", {
									className: "dsh-ig-field",
									children: [
										(0, react_jsx_runtime.jsx)("span", {
											className: "dsh-ig-label",
											children: t("folder")
										}),
										(0, react_jsx_runtime.jsx)("input", {
											className: "dsh-ig-input",
											value: workspaceFolder,
											onChange: (event) => {
												setWorkspaceFolder(event.target.value);
											},
											onBlur: () => {
												commitWorkspaceFolder();
											},
											onKeyDown: (event) => {
												if (event.key === "Enter") commitWorkspaceFolder();
											},
											placeholder: "dsh-image-gen",
											disabled: !snapshot.writable
										}),
										(0, react_jsx_runtime.jsx)("span", {
											className: "dsh-ig-hint",
											children: t("folderHint")
										})
									]
								}) : null,
								workspaceMessage.length > 0 ? (0, react_jsx_runtime.jsx)("p", {
									className: `dsh-ig-status${workspaceMessageIsError ? " dsh-ig-status-error" : ""}`,
									role: "status",
									children: workspaceMessage
								}) : null
							]
						})
					]
				}) : null]
			});
		}
		/** Keep the legacy Tool row for old DSH and hand modern results to the independent Chat node. */
		function modelOf(provider, value) {
			const stored = provider === "comfyui" ? activeComfyUIWorkflow(value ?? {})?.name : isSubscriptionProvider(provider) ? DEFAULT_MODELS[provider] : value?.[CLOUD_MODEL_FIELDS[provider]];
			return typeof stored === "string" && stored.length > 0 ? stored : DEFAULT_MODELS[provider];
		}
		function baseURLOf(provider, value) {
			const stored = provider === "comfyui" ? value?.comfyuiBaseURL : isSubscriptionProvider(provider) ? "" : value?.[CLOUD_URL_FIELDS[provider]];
			return typeof stored === "string" && stored.length > 0 ? stored : DEFAULT_BASE_URLS[provider];
		}
		//#endregion
		exports.ImageGenerationSettingsCard = ImageGenerationSettingsCard;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map