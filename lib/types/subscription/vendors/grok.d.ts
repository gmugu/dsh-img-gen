/**
 * Grok subscription image vendor.
 *
 * Adapted from @goodandready/dsh-subscriptions (MIT, (c) 2026 GooDAnDReaDY)
 * lib/vendors/grok.js and lib/images.js — only the pieces the image channel
 * needs: authorize URL, code exchange, refresh, and the generations call
 * (grok-cli token, not an xAI API key).
 */
import { type Pkce } from '../oauth.js';
import type { SubscriptionBlob } from '../blob.js';
/** Where the Grok subscription image request goes. */
export declare const GROK_IMAGE_URL = "https://api.x.ai/v1/images/generations";
/** Where the Grok subscription image edit request goes. */
export declare const GROK_IMAGE_EDIT_URL = "https://api.x.ai/v1/images/edits";
/** The model served by this endpoint. */
export declare const GROK_IMAGE_MODEL = "grok-imagine-image-2.0";
/** Public client id of the grok-cli; vendor-fixed redirect on 127.0.0.1:56121. */
export declare const GROK_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
export declare const GROK_REDIRECT_URI = "http://127.0.0.1:56121/callback";
export declare function grokConfig(): {
    clientId: string;
    redirectUri: string;
};
export declare function grokAuthorizeUrl(cfg: {
    clientId: string;
    redirectUri: string;
}, pkce: Pkce): string;
/** Identity fields every grok.com call must carry (the API host ignores them). */
export declare function grokIdentityHeaders(blob: SubscriptionBlob): Record<string, string>;
export declare function grokExchangeCode(cfg: {
    clientId: string;
    redirectUri: string;
}, pkce: Pkce, code: string): Promise<SubscriptionBlob>;
export declare function grokRefresh(blob: SubscriptionBlob): Promise<SubscriptionBlob>;
