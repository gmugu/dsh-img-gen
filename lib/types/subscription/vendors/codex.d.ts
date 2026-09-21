/**
 * ChatGPT (Codex) subscription image vendor.
 *
 * Adapted from @goodandready/dsh-subscriptions (MIT, (c) 2026 GooDAnDReaDY)
 * lib/vendors/codex.js and lib/images.js — only the pieces the image channel
 * needs: authorize URL, code exchange, refresh, and the generations call.
 * The device-code flow and chat streaming stay out of this bundle.
 */
import { type Pkce } from '../oauth.js';
import type { SubscriptionBlob } from '../blob.js';
export declare const CODEX_AUTH = "https://auth.openai.com/oauth/authorize";
export declare const CODEX_TOKEN = "https://auth.openai.com/oauth/token";
/** Where the ChatGPT subscription image request goes. */
export declare const CODEX_IMAGE_URL = "https://chatgpt.com/backend-api/codex/images/generations";
/** Where the ChatGPT subscription image edit request goes. */
export declare const CODEX_IMAGE_EDIT_URL = "https://chatgpt.com/backend-api/codex/images/edits";
/** The model served by this endpoint (probed live: gpt-image-2.5-flare works
 * on the ChatGPT internal generations route as of 2026-09-14). */
export declare const CODEX_IMAGE_MODEL = "gpt-image-2.5-flare";
/** Public client id of the Codex CLI; vendor-fixed redirect on port 1455. */
export declare const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export declare const CODEX_REDIRECT_URI = "http://localhost:1455/auth/callback";
export interface CodexConfig {
    clientId: string;
    redirectUri: string;
}
export declare function codexConfig(): CodexConfig;
export declare function codexAuthorizeUrl(cfg: CodexConfig, pkce: Pkce): string;
/** Identity fields every Codex API call must carry. */
export declare function codexIdentityHeaders(blob: SubscriptionBlob): Record<string, string>;
export declare function codexExchangeCode(cfg: CodexConfig, pkce: Pkce, code: string): Promise<SubscriptionBlob>;
export declare function codexRefresh(blob: SubscriptionBlob): Promise<SubscriptionBlob>;
