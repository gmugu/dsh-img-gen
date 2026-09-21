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
import { type CredentialRef } from '@deepseek-ai/dsh-credentials';
import type { Context } from '@deepseek-ai/cordis';
import { type SubscriptionBlob } from './blob.js';
import { type SubscriptionProvider } from '../shared.js';
/** Vendor ids used by the credential refs and the wire calls. */
export type SubscriptionVendor = 'codex' | 'grok' | 'antigravity';
/**
 * Reference image passed to edit calls. Structural so callers can pass their
 * own resolved types without importing from the plugin root.
 */
export interface SubscriptionReferenceImage {
    data: Uint8Array;
    mediaType: string;
}
/** The vendor each dsh-image-gen subscription provider maps onto. */
export declare function vendorOf(provider: SubscriptionProvider): SubscriptionVendor;
/** Credential ref one vendor's OAuth blob is stored under (index fixed at 1). */
export declare function subscriptionOauthRef(vendor: SubscriptionVendor): CredentialRef;
/** Sizes both vendors understand. */
export declare const SUBSCRIPTION_SIZES: readonly ["1024x1024", "1024x1536", "1536x1024", "auto"];
/**
 * Reference images per edit call. Every subscription channel accepts at
 * least this many (Codex edits up to 16, Grok up to 5, Antigravity up to 10),
 * so 5 keeps one shared guard in line with the Studio UI's upload cap.
 */
export declare const SUBSCRIPTION_MAX_REFERENCE_IMAGES = 5;
/** Login status the settings card renders as a badge. */
export type SubscriptionLoginStatus = {
    state: 'logged-in';
    email: string;
} | {
    state: 'logged-out';
} | {
    state: 'unknown';
};
/** Callback shape the login flow reports to the pending HTTP response. */
export interface LoginOutcome {
    ok: boolean;
    email?: string;
    message?: string;
}
export declare class SubscriptionManager {
    private readonly ctx;
    private readonly pending;
    private readonly refreshLocks;
    /** Cheap in-memory expiry cache so badges do not hit credentials on read. */
    private readonly blobCache;
    /** Antigravity needs a per-account project id on every generation call. */
    private readonly projectCache;
    constructor(ctx: Context);
    /** Read a vendor's stored blob, or undefined when signed out. */
    readBlob(vendor: SubscriptionVendor): Promise<SubscriptionBlob | undefined>;
    /** Login status for the settings card; never throws. */
    loginStatus(vendor: SubscriptionVendor): Promise<SubscriptionLoginStatus>;
    /**
     * Begin a login: registers PKCE state, starts the loopback catch server on
     * the vendor-fixed redirect port, and returns the authorize URL for the
     * browser to open. Completion lands in the loopback callback.
     */
    beginLogin(vendor: SubscriptionVendor): Promise<{
        url: string;
    }>;
    /** Loopback callback: validate state, exchange the code, store the blob. */
    private completeLoginFromCallback;
    /** Sign out: clear the blob and the caches. No other setting changes. */
    logout(vendor: SubscriptionVendor): Promise<void>;
    private saveBlob;
    /**
     * Return a blob whose access token is usable; refreshes first when the
     * stored one is expired (or expiring within the skew window). Single-flight
     * per vendor so concurrent generate calls share one refresh.
     */
    ensureFresh(vendor: SubscriptionVendor): Promise<SubscriptionBlob>;
    /** Generate one image through the logged-in account. b64 reply decoded host-side. */
    generate(options: {
        vendor: SubscriptionVendor;
        prompt: string;
        size?: string;
        quality?: string;
        referenceImages?: ReadonlyArray<SubscriptionReferenceImage>;
        signal?: AbortSignal;
    }): Promise<Array<{
        b64_json: string;
        revisedPrompt?: string;
    }>>;
    /**
     * Resolve (and cache per refresh token) the managed project id the
     * Antigravity generation envelope needs. Re-resolved when the account
     * signs out or a different account logs in.
     */
    private ensureAntigravityProject;
}
