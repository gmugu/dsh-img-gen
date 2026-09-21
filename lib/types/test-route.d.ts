/** Same-origin connection probe the settings card runs per provider. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Config, ImageProvider } from './config.js';
import type { SubscriptionManager } from './subscription.js';
import { type CloudImageProvider } from './shared.js';
export { TEST_CONNECTION_ROUTE } from './shared.js';
/** One probe target a provider resolves to: a URL plus its auth headers. */
export interface ProbeTarget {
    url: string;
    headers: Record<string, string>;
}
/**
 * The endpoint each provider is probed on. All four cloud providers expose a
 * model-list GET that authenticates with the same credential image generation
 * uses; ComfyUI exposes its standard `system_stats` health endpoint.
 */
export declare function probeTarget(provider: ImageProvider, config: Config, apiKey?: string | undefined): ProbeTarget;
/** Structured probe outcome the settings card maps onto localized text. */
export type ProbeResult = {
    ok: true;
} | {
    ok: false;
    reason: 'missing-key' | 'unauthorized' | 'error';
    message?: string;
};
/** Model-pull outcome: a filtered list of image-capable model ids on success. */
export type ModelsResult = {
    ok: true;
    models: string[];
} | {
    ok: false;
    reason: 'missing-key' | 'unauthorized' | 'error';
    message?: string;
};
/** Extract bare model ids from a Google `list models` payload (`models/{id}`). */
export declare function parseGoogleModelIds(payload: unknown): string[];
/** Heuristic filter: Gemini image models carry `image`/`imagen` in the id. */
export declare function filterImageModelIds(ids: readonly string[]): string[];
/** Narrow filter for the official OpenAI catalog: gpt-image and DALL·E families. */
export declare function filterOpenAIImageModelIds(ids: readonly string[]): string[];
/** Broad filter for relays: common image-model id fragments across vendors. */
export declare function filterRelayImageModelIds(ids: readonly string[]): string[];
/** Ark catalog filter: the Seedream (generation) and SeedEdit (editing) families. */
export declare function filterSeedreamImageModelIds(ids: readonly string[]): string[];
/** Zhipu catalog filter: GLM-Image and CogView families. */
export declare function filterZhipuImageModelIds(ids: readonly string[]): string[];
/** Extract model ids from an OpenAI-style `{data:[{id}]}` or xAI-style `{models:[{id}]}` payload. */
export declare function parseOpenAIModelIds(payload: unknown): string[];
/**
 * Extract image-capable model ids from a DashScope native
 * `{output:{models:[{model,capabilities}]}}` payload. The `capabilities`
 * array marks image generation as `IG`; name fragments are a fallback for
 * payloads that omit the field.
 */
export declare function parseDashScopeImageModelIds(payload: unknown): string[];
/**
 * DashScope-compatible MaaS gateways serve no native `/api/v1/models` route but
 * do expose the OpenAI-style catalog beside it. Returns undefined for an
 * endpoint that is not an absolute URL.
 */
export declare function dashscopeCompatibleModelsUrl(endpoint: string): string | undefined;
/** DashScope catalog filter: the Qwen-Image and Wan (wanx / wan2.x) families. */
export declare function filterDashScopeImageModelIds(ids: readonly string[]): string[];
/** Pull and filter the image-capable models from the Google endpoint. */
export declare function fetchGoogleImageModels(config: Config, apiKey: string | undefined, signal?: AbortSignal | undefined): Promise<ModelsResult>;
/** Pull and filter image-capable models from an OpenAI-compatible endpoint (official, relay, Ark, xAI, Zhipu). */
export declare function fetchOpenAIImageModels(provider: 'openai' | 'openai-compat' | 'seedream' | 'xai' | 'zhipu', config: Config, apiKey: string | undefined, signal?: AbortSignal | undefined): Promise<ModelsResult>;
/** Pull and filter image-capable models from the DashScope native model list (`capabilities=IG`). */
export declare function fetchDashScopeImageModels(config: Config, apiKey: string | undefined, signal?: AbortSignal | undefined): Promise<ModelsResult>;
/** Run one provider probe and classify the outcome; secrets never leave redacted. */
export declare function probeProviderConnection(provider: CloudImageProvider, config: Config, apiKey: string | undefined, signal?: AbortSignal | undefined): Promise<ProbeResult>;
/** Probe the local ComfyUI service without any credential. */
export declare function probeComfyUIConnection(config: Config, signal?: AbortSignal | undefined): Promise<ProbeResult>;
/**
 * Probe a subscription provider: the internal manager's login state for the
 * matching vendor. No network call and no token access; the probe reports
 * signed-in (with the account email) or signed-out guidance.
 */
export declare function probeSubscriptionConnection(provider: 'chatgpt-sub' | 'grok-sub' | 'google-sub', manager: SubscriptionManager): Promise<ProbeResult>;
/** Dependencies the test route needs from the plugin entry. */
export interface TestRouteDeps {
    /** The credential each cloud provider probes with, when one is stored. */
    resolveKey(provider: CloudImageProvider): Promise<string | undefined>;
    /** The currently authoritative config, including unsaved defaults. */
    config(): Config;
    /** The internal subscription account manager for the login-state probes. */
    subscriptionManager: SubscriptionManager;
}
/** Serve the settings card's per-provider connectivity probe. */
export declare function serveTestConnection(req: IncomingMessage, res: ServerResponse, deps: TestRouteDeps): Promise<void>;
