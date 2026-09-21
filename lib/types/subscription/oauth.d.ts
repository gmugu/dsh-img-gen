/** A PKCE pair plus the OAuth state binding the callback to this login. */
export interface Pkce {
    verifier: string;
    challenge: string;
    state: string;
}
export declare function createPkce(): Promise<Pkce>;
/** Build an authorization-code URL with PKCE and optional extra params. */
export declare function buildAuthorizeUrl(input: {
    authUrl: string;
    clientId: string;
    redirectUri: string;
    challenge: string;
    state: string;
    scope?: string;
    extra?: Record<string, string>;
}): string;
/** Decode a JWT payload without signature verification (identity read only). */
export declare function decodeJwtPayload(token: string): Record<string, unknown> | undefined;
/** The chatgpt-account-id a Codex API call must carry. */
export declare function chatgptAccountId(token: string): string;
/** The account email for badges and login confirmation. */
export declare function emailFromToken(token: string): string;
/** POST an OAuth token endpoint with form encoding; 25s cap like the source. */
export declare function formTokenRequest(url: string, params: Record<string, string>, fetchImpl: typeof fetch): Promise<Record<string, unknown>>;
