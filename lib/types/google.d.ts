/** Google Gemini Interactions API adapter. */
import type { ImageMediaType } from '@deepseek-ai/dsh-attachment';
import type { AspectRatio, ImageSize } from './config.js';
/** Image bytes returned before Attachment persistence. */
export interface GeneratedImage {
    data: Uint8Array;
    mediaType: ImageMediaType;
}
interface GoogleRequestBase {
    apiKey: string;
    endpoint: string;
    model: string;
    aspectRatio: AspectRatio;
    imageSize: ImageSize;
    maxBytes: number;
    signal: AbortSignal;
}
/** Send one native Google text-to-image request. */
export declare function generateGoogleImage(input: GoogleRequestBase & {
    prompt: string;
}): Promise<GeneratedImage>;
/** Send one native Google image-editing request using already-resolved bytes. */
export declare function editGoogleImage(input: GoogleRequestBase & {
    prompt: string;
    sourceImages: Array<{
        data: Uint8Array;
        mediaType: ImageMediaType;
    }>;
}): Promise<GeneratedImage>;
export {};
