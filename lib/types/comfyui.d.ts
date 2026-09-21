/** ComfyUI text-to-image and image-to-image adapters using an imported API-format workflow. */
import type { ImageMediaType } from '@deepseek-ai/dsh-attachment';
export interface GeneratedComfyUIImage {
    data: Uint8Array;
    mediaType: ImageMediaType;
    /** Concrete seed injected into the workflow, surfaced for provenance metadata. */
    seed: number;
}
/** Source image bytes a ComfyUI workflow accepts through its image input. */
export interface ComfyUISourceImage {
    data: Uint8Array;
    mediaType: ImageMediaType;
}
interface ComfyUIJobInput {
    baseURL: string;
    timeoutMs: number;
    signal: AbortSignal;
}
/** Run one ComfyUI text-to-image workflow and return its first final image. */
export declare function generateComfyUIImage(input: ComfyUIJobInput & {
    workflowJson: string;
    prompt: string;
    maxBytes: number;
}): Promise<GeneratedComfyUIImage>;
/** Upload one source image, run the workflow, and return its first final image. */
export declare function editComfyUIImage(input: ComfyUIJobInput & {
    workflowJson: string;
    prompt: string;
    sourceImage: ComfyUISourceImage;
    maxBytes: number;
}): Promise<GeneratedComfyUIImage>;
export {};
