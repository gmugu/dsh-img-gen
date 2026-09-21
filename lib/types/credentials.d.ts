import type { Context } from '@deepseek-ai/cordis';
import { type CloudImageProvider } from './shared.js';
/**
 * Resolve one provider's stored API key to a non-blank value. Blank values
 * never count as configured: the host treats an empty stored value as absent,
 * and a whitespace-only key is never sent to a provider.
 */
export declare function resolveApiKey(ctx: Context, provider: CloudImageProvider): Promise<string | undefined>;
/**
 * Resolve one provider's API key or fail with a user-facing message that says
 * where to configure it. Passing `tool` selects the Agent-facing English
 * wording; without it the message is the browser-facing Chinese one used by
 * the Studio route.
 */
export declare function requireApiKey(ctx: Context, provider: CloudImageProvider, tool?: string): Promise<string>;
