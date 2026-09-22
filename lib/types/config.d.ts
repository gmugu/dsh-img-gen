/** User-facing configuration for supported image providers. */
import z from '@deepseek-ai/schemastery';
import { ARK_BACKGROUND_MODES, ARK_OUTPUT_FORMATS, DEFAULT_DASHSCOPE_ENDPOINT, DEFAULT_DASHSCOPE_MODEL, DEFAULT_DASHSCOPE_SIZE, DEFAULT_COMFYUI_BASE_URL, DEFAULT_COMFYUI_TIMEOUT_MS, DEFAULT_COMFYUI_WORKFLOW_LABEL, DEFAULT_GOOGLE_ENDPOINT, DEFAULT_GOOGLE_MODEL, DEFAULT_OPENAI_BASE_URL, DEFAULT_OPENAI_MODEL, DEFAULT_QWEN_TOKEN_PLAN_ENDPOINT, DEFAULT_QWEN_TOKEN_PLAN_MODEL, DEFAULT_SEEDREAM_BASE_URL, DEFAULT_SEEDREAM_MODEL, DEFAULT_XAI_BASE_URL, DEFAULT_XAI_MODEL, DEFAULT_ZHIPU_BASE_URL, DEFAULT_ZHIPU_MODEL, DASHSCOPE_API_KEY_ENV, GOOGLE_API_KEY_ENV, IMAGE_PROVIDERS, OPENAI_API_KEY_ENV, OPENAI_COMPAT_API_KEY_ENV, QWEN_TOKEN_PLAN_API_KEY_ENV, SEEDREAM_API_KEY_ENV, XAI_API_KEY_ENV, ZHIPU_API_KEY_ENV, activeComfyUIWorkflow, resolveComfyUIWorkflows, type ArkBackgroundMode, type ArkOutputFormat, type ArkOutputOptions, type ComfyUIWorkflowEntry, type ImageProvider } from './shared.js';
export { ARK_BACKGROUND_MODES, ARK_OUTPUT_FORMATS, DEFAULT_DASHSCOPE_ENDPOINT, DEFAULT_DASHSCOPE_MODEL, DEFAULT_DASHSCOPE_SIZE, DEFAULT_COMFYUI_BASE_URL, DEFAULT_COMFYUI_TIMEOUT_MS, DEFAULT_COMFYUI_WORKFLOW_LABEL, DEFAULT_GOOGLE_ENDPOINT, DEFAULT_GOOGLE_MODEL, DEFAULT_OPENAI_BASE_URL, DEFAULT_OPENAI_MODEL, DEFAULT_QWEN_TOKEN_PLAN_ENDPOINT, DEFAULT_QWEN_TOKEN_PLAN_MODEL, DEFAULT_SEEDREAM_BASE_URL, DEFAULT_SEEDREAM_MODEL, DEFAULT_XAI_BASE_URL, DEFAULT_XAI_MODEL, DEFAULT_ZHIPU_BASE_URL, DEFAULT_ZHIPU_MODEL, DASHSCOPE_API_KEY_ENV, GOOGLE_API_KEY_ENV, IMAGE_PROVIDERS, OPENAI_API_KEY_ENV, OPENAI_COMPAT_API_KEY_ENV, QWEN_TOKEN_PLAN_API_KEY_ENV, SEEDREAM_API_KEY_ENV, XAI_API_KEY_ENV, ZHIPU_API_KEY_ENV, activeComfyUIWorkflow, resolveComfyUIWorkflows, type ArkBackgroundMode, type ArkOutputFormat, type ArkOutputOptions, type ComfyUIWorkflowEntry, type ImageProvider, };
/** Default workspace subfolder that receives generated image files. */
export declare const DEFAULT_WORKSPACE_FOLDER = "dsh-image-gen";
/** Google tool-level controls. */
export declare const ASPECT_RATIOS: readonly ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"];
export declare const IMAGE_SIZES: readonly ["1K", "2K", "4K"];
export type AspectRatio = typeof ASPECT_RATIOS[number];
export type ImageSize = typeof IMAGE_SIZES[number];
/** Bundle configuration from the profile patch and the Web settings page. */
export interface Config {
    provider?: ImageProvider;
    googleModel?: string;
    googleEndpoint?: string;
    openaiBaseURL?: string;
    openaiModel?: string;
    /** OpenAI-compatible relay settings; independent from the official OpenAI row. */
    openaiCompatBaseURL?: string;
    openaiCompatModel?: string;
    /**
     * Request shape the relay's images/edits endpoint expects (#41). Most
     * relays take OpenAI's multipart form; some (e.g. SenseNova) accept the
     * generations endpoint but run edits on their own JSON contract with
     * `images: [{ image_url }]` objects. Defaults to `multipart`.
     */
    openaiCompatEditFormat?: 'multipart' | 'jsonImageUrlArray';
    /**
     * Extra JSON fields merged into the JSON edit body last (can override the
     * built-in defaults), e.g. SenseNova's `watermark`/`prompt_extend`.
     * Ignored unless `openaiCompatEditFormat` is `jsonImageUrlArray`.
     */
    openaiCompatEditExtra?: Record<string, unknown>;
    seedreamBaseURL?: string;
    seedreamModel?: string;
    /**
     * Ark `output_format`. Ark defaults to `jpeg`, which is lossy and cannot
     * carry an alpha channel; `png` is lossless, so it survives later editing
     * (e.g. background removal) without JPEG ringing around the subject.
     */
    seedreamOutputFormat?: ArkOutputFormat;
    /**
     * Ark `watermark`. Ark defaults to `true`, which bakes an "AI generated"
     * mark into the bottom-right corner.
     */
    seedreamWatermark?: boolean;
    /**
     * Ark `background`. Only the edit path can honour `transparent`, and only
     * when every reference image already carries an alpha channel.
     */
    seedreamBackground?: ArkBackgroundMode;
    dashscopeEndpoint?: string;
    dashscopeModel?: string;
    qwenTokenPlanEndpoint?: string;
    qwenTokenPlanModel?: string;
    xaiBaseURL?: string;
    xaiModel?: string;
    zhipuBaseURL?: string;
    zhipuModel?: string;
    comfyuiBaseURL?: string;
    /** Named ComfyUI workflows managed by the Web settings page. */
    comfyuiWorkflows?: ComfyUIWorkflowEntry[];
    /** Name of the workflow ComfyUI calls use by default. */
    comfyuiActiveWorkflow?: string;
    /** Legacy single-workflow storage; synced to the active entry for downgrades. */
    comfyuiWorkflowJson?: string;
    /** Original imported file name of the legacy single workflow. */
    comfyuiWorkflowName?: string;
    comfyuiTimeoutMs?: number;
    /** Also write every generated image as a file under the session workspace. */
    saveToWorkspace?: boolean;
    /** Workspace subfolder for generated images; empty means the workspace root. */
    workspaceFolder?: string;
}
/** Cordis configuration schema. */
export declare const Config: z<Config>;
/** Resolve exactly one provider profile for a tool call. */
export declare function resolveProvider(config: Config): {
    provider: 'google';
    apiKeyEnv: string;
    model: string;
    endpoint: string;
    aspectRatio: AspectRatio;
    imageSize: ImageSize;
} | {
    provider: 'openai';
    apiKeyEnv: string;
    model: string;
    baseURL: string;
    imageSize: string;
} | {
    provider: 'openai-compat';
    apiKeyEnv: string;
    model: string;
    baseURL: string;
    imageSize: string;
    editFormat: 'multipart' | 'jsonImageUrlArray';
    editExtra: Record<string, unknown>;
} | {
    provider: 'seedream';
    apiKeyEnv: string;
    model: string;
    baseURL: string;
    imageSize: string;
    arkOptions: ArkOutputOptions;
} | {
    provider: 'dashscope';
    apiKeyEnv: string;
    model: string;
    endpoint: string;
    imageSize: string;
    allowWanModels: boolean;
} | {
    provider: 'qwen-token-plan';
    apiKeyEnv: string;
    model: string;
    endpoint: string;
    imageSize: string;
    allowWanModels: boolean;
} | {
    provider: 'xai';
    apiKeyEnv: string;
    model: string;
    baseURL: string;
    imageSize: string;
} | {
    provider: 'zhipu';
    apiKeyEnv: string;
    model: string;
    baseURL: string;
    imageSize: string;
} | {
    provider: 'comfyui';
    baseURL: string;
    workflows: ComfyUIWorkflowEntry[];
    workflow?: ComfyUIWorkflowEntry;
    timeoutMs: number;
} | {
    provider: 'chatgpt-sub';
    model: string;
} | {
    provider: 'grok-sub';
    model: string;
} | {
    provider: 'google-sub';
    model: string;
};
/**
 * Apply a per-call provider and/or model override on top of the saved config.
 * `model` is ignored for ComfyUI, whose per-call equivalent is `workflow`.
 */
export declare function withProviderOverrides(config: Config, provider?: ImageProvider, model?: string): Config;
/**
 * One-time migration: when the legacy single OpenAI slot points at a relay
 * (non-official base URL) and the compat row is empty, move the relay config
 * to the compat row so both can coexist. Returns the input untouched when
 * nothing needs moving.
 */
export declare function migrateOpenAICompatConfig(config: Config): Config;
/** The workflow a ComfyUI call runs: the requested name when given, else the active one. */
export declare function selectComfyUIWorkflow(active: {
    workflows: ComfyUIWorkflowEntry[];
    workflow?: ComfyUIWorkflowEntry;
}, requested?: string): ComfyUIWorkflowEntry;
