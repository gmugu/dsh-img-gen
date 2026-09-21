import { type Pkce } from '../oauth.js';
import type { SubscriptionBlob } from '../blob.js';
/** Antigravity CLI's embedded OAuth client, treated as public like Codex's. */
export declare const ANTIGRAVITY_CLIENT_ID = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
export declare const ANTIGRAVITY_CLIENT_SECRET = "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";
export declare const ANTIGRAVITY_REDIRECT_URI = "http://localhost:51121/oauth-callback";
/**
 * Endpoint fallback order for generation, mirroring the reference (daily
 * sandbox first, then autopush, then prod).
 */
export declare const ANTIGRAVITY_ENDPOINTS: readonly ["https://daily-cloudcode-pa.sandbox.googleapis.com", "https://autopush-cloudcode-pa.sandbox.googleapis.com", "https://cloudcode-pa.googleapis.com"];
/** The image model served through this channel: Nano Banana Pro. */
export declare const ANTIGRAVITY_IMAGE_MODEL = "gemini-3-pro-image";
/** Current client version: the fetched one, or the fallback until fetched. */
export declare function getAntigravityVersion(): string;
/** Test seam: pin the version so unit tests never depend on the network. */
export declare function setAntigravityVersionForTest(version: string | undefined): void;
/** Fetch and cache the current version once; failures keep the fallback. */
export declare function initAntigravityVersion(): Promise<void>;
export interface AntigravityConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}
export declare function antigravityConfig(): AntigravityConfig;
export declare function antigravityAuthorizeUrl(cfg: AntigravityConfig, pkce: Pkce): string;
export declare function antigravityExchangeCode(cfg: AntigravityConfig, pkce: Pkce, code: string): Promise<SubscriptionBlob>;
export declare function antigravityRefresh(blob: SubscriptionBlob): Promise<SubscriptionBlob>;
/**
 * Resolve the managed project id for the logged-in account. Most accounts
 * have one; when loadCodeAssist reports none, the hardcoded fallback keeps
 * generation working (mirrors the reference's ensureProjectContext).
 * Returns '' only when every endpoint fails, letting generate() throw then.
 */
export declare function antigravityResolveProject(blob: SubscriptionBlob): Promise<string>;
/**
 * Build the streamGenerateContent request body for one image generation.
 * Ported from the reference buildImageRequest + the wrapping envelope: no
 * tools, no systemInstruction, no thinkingConfig; responseModalities asks
 * for TEXT+IMAGE. Reference images (edits) ride along as inlineData parts
 * before the text part, mirroring the reference implementation.
 */
export declare function antigravityImageBody(options: {
    prompt: string;
    aspectRatio?: string;
    hd?: boolean;
    referenceImages?: ReadonlyArray<{
        data: Uint8Array;
        mediaType: string;
    }>;
}): Record<string, unknown>;
/** Wrap the inner request in the Antigravity agent envelope. */
export declare function antigravityEnvelope(projectId: string, request: Record<string, unknown>): Record<string, unknown>;
export interface AntigravityImageResult {
    b64: string;
    mimeType: string;
    text?: string;
}
/**
 * Generate one image on the logged-in Antigravity account: resolve the
 * project, POST the wrapped body to each endpoint in fallback order, and
 * parse the SSE stream for the inlineData image part.
 */
export declare function antigravityGenerateImage(options: {
    blob: SubscriptionBlob;
    projectId: string;
    prompt: string;
    aspectRatio?: string;
    hd?: boolean;
    referenceImages?: ReadonlyArray<{
        data: Uint8Array;
        mediaType: string;
    }>;
    signal?: AbortSignal;
}): Promise<AntigravityImageResult>;
