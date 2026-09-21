/**
 * Listen on the redirect_uri's port and resolve when the provider calls back.
 * Rejects on port conflicts, network errors, or when nothing arrives in time.
 */
export declare function startLoopback(options: {
    redirectUri: string;
    timeoutMs?: number;
    onCode: (params: URLSearchParams) => Promise<string>;
}): Promise<{
    ok: true;
}>;
