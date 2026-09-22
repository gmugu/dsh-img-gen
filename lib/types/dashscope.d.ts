/** DashScope Qwen Image generation and editing adapter. */
import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment';
export interface DashScopeImageOptions {
    apiKey: string;
    endpoint: string;
    model: string;
    prompt: string;
    size?: string;
    maxBytes: number;
    signal?: AbortSignal;
    /**
     * Accept the Wan image family on this route. Bailian serves only Qwen-Image
     * here (Wan lives behind its own asynchronous API); the Qwen Token Plan
     * gateway serves Qwen-Image and Wan on the same multimodal-generation route.
     */
    allowWanModels?: boolean;
}
export interface DashScopeEditOptions extends DashScopeImageOptions {
    sourceImages: Array<{
        data: Uint8Array;
        mediaType: ImageMediaType;
    }>;
}
export declare function generateDashScopeImage(options: DashScopeImageOptions): Promise<{
    data: Uint8Array;
    mediaType: ImageAttachmentRef['mediaType'];
}>;
export declare function editDashScopeImage(options: DashScopeEditOptions): Promise<{
    data: Uint8Array;
    mediaType: ImageAttachmentRef['mediaType'];
}>;
