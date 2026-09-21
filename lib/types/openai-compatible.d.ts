/** OpenAI Images API and compatible response adapter. */
import type { ImageMediaType } from '@deepseek-ai/dsh-attachment';
import { type ArkOutputOptions } from './shared.js';
export interface GeneratedCompatibleImage {
    data: Uint8Array;
    mediaType: ImageMediaType;
}
export interface CompatibleReferenceImage {
    data: Uint8Array;
    mediaType: ImageMediaType;
}
export declare function generateOpenAICompatibleImage(input: {
    provider: 'openai' | 'openai-compat' | 'seedream' | 'xai' | 'zhipu';
    apiKey: string;
    baseURL: string;
    model: string;
    prompt: string;
    size: string;
    maxBytes: number;
    signal: AbortSignal;
    /** Ark-only output controls; ignored by every other provider. */
    arkOptions?: ArkOutputOptions;
}): Promise<GeneratedCompatibleImage>;
/** How the edits endpoint expects its request body (#41). */
export type CompatEditFormat = 'multipart' | 'jsonImageUrlArray';
export declare function editOpenAICompatibleImage(input: {
    apiKey: string;
    baseURL: string;
    model: string;
    prompt: string;
    sourceImages: CompatibleReferenceImage[];
    size?: string;
    maxBytes: number;
    signal: AbortSignal;
    /**
     * Request shape for the edits call. Most OpenAI-compatible channels take
     * the standard multipart form; some (e.g. SenseNova) accept OpenAI's
     * generations endpoint but run edits on their own JSON contract with
     * `images: [{ image_url }]` objects. Defaults to the standard multipart.
     */
    editFormat?: CompatEditFormat;
    /**
     * Channel-specific extra fields merged into the JSON edit body last (so
     * they can override the defaults above), e.g. SenseNova's
     * `watermark`/`prompt_extend`. Ignored in multipart mode.
     */
    editExtra?: Readonly<Record<string, unknown>>;
}): Promise<GeneratedCompatibleImage>;
