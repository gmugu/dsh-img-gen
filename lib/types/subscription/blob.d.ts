/**
 * OAuth token blob persistence for subscription accounts.
 *
 * Adapted from @goodandready/dsh-subscriptions (MIT, (c) 2026 GooDAnDReaDY)
 * lib/blob.js — trimmed to the two image vendors this plugin ships. The blob
 * is stored through the DSH Credentials service under a provider-scoped ref
 * (see refs.ts); it never reaches the browser side.
 */
/** Everything a vendor needs to call its API plus display identity. */
export interface SubscriptionBlob {
    accessToken: string;
    refreshToken: string;
    /** Epoch ms when the access token stops working; 0 when unknown. */
    expiresAt: number;
    label: string;
    email: string;
    /** ChatGPT-only: the chatgpt-account-id request header value. */
    accountId: string;
}
/** Serialize a blob for storage; at least one token must be present. */
export declare function serializeBlob(obj: Partial<SubscriptionBlob>): string;
/** Parse a stored blob back; invalid input throws. */
export declare function parseBlob(text: string): SubscriptionBlob;
