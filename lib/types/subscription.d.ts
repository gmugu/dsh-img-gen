/**
 * Subscription-based image generation: the internal, self-contained channel.
 *
 * Login (PKCE loopback), token storage through the DSH Credentials service,
 * refresh and the wire calls all live in `./subscription/` — adapted from
 * @goodandready/dsh-subscriptions (MIT, (c) 2026 GooDAnDReaDY), trimmed to
 * the two image vendors this bundle ships. This file keeps the same
 * `{ data, mediaType }` contract as the API-key adapters so `saveGenerated`
 * and everything downstream is shared.
 *
 * Isolation invariants (project rules):
 * - OAuth blobs live under CODEX_OAUTH_1 / GROK_OAUTH_1 refs — never the
 *   API-key refs — and the API-key paths never consult subscription state.
 * - Login/logout changes nothing except one vendor's own blob.
 */
import type { ImageMediaType } from '@deepseek-ai/dsh-attachment';
import { SubscriptionManager } from './subscription/manager.js';
import { type SubscriptionProvider } from './shared.js';
export { SubscriptionManager, vendorOf } from './subscription/manager.js';
export { registerSubscriptionRoutes } from './subscription/subscription-route.js';
export { SUBSCRIPTION_TIMEOUT_MS } from './shared.js';
/**
 * Generate one image through a logged-in subscription account. Returns the
 * same `{ data, mediaType }` contract as the API-key adapters so the caller
 * can feed it straight into `saveGenerated`. With sourceImages the call is
 * an edit: the vendor layer picks the channel's edit endpoint.
 */
export declare function generateSubscriptionImage(options: {
    manager: SubscriptionManager;
    provider: SubscriptionProvider;
    prompt: string;
    size?: string;
    quality?: string;
    sourceImages?: ReadonlyArray<{
        data: Uint8Array;
        mediaType: ImageMediaType;
    }>;
    maxBytes: number;
    signal: AbortSignal;
}): Promise<{
    data: Uint8Array;
    mediaType: ImageMediaType;
    revisedPrompt?: string;
}>;
