import type { ImageAttachmentRef, ImageMediaType, StoredImageAttachment } from '@deepseek-ai/dsh-attachment';
import type { Message } from '@deepseek-ai/dsh-llm';
/** Provider-neutral image bytes passed across the DSH/provider boundary. */
export interface ResolvedReferenceImage {
    data: Uint8Array;
    mediaType: ImageMediaType;
}
/** The small latest-DSH session surface this Bundle depends on. */
export interface ReferenceImageAgent {
    session: {
        deriveMessages(): readonly Message[];
        header?: {
            cwd?: string;
        };
    };
}
/** The small latest-DSH attachment surface this Bundle depends on. */
export interface ReferenceImageStore {
    readImage(ref: ImageAttachmentRef, signal?: AbortSignal): Promise<StoredImageAttachment>;
}
/**
 * Resolve and read the image to edit from the current effective conversation.
 *
 * This is the only module allowed to know how DSH sessions expose effective
 * messages or how nested model-facing content stores durable image refs.
 */
export declare function resolveReferenceImage(input: {
    agent?: ReferenceImageAgent;
    attachments: ReferenceImageStore;
    sourceAttachmentId?: string;
    sourcePath?: string;
    maxBytes?: number;
    signal: AbortSignal;
}): Promise<ResolvedReferenceImage>;
/**
 * Resolve one or more edit references while keeping every DSH-specific detail
 * behind this compatibility boundary. Explicit selectors preserve caller order;
 * without selectors, all images in the newest image-bearing message are used.
 */
export declare function resolveReferenceImages(input: {
    agent?: ReferenceImageAgent;
    attachments: ReferenceImageStore;
    sourceAttachmentId?: string;
    sourceAttachmentIds?: readonly string[];
    sourcePath?: string;
    sourcePaths?: readonly string[];
    maxBytes?: number;
    signal: AbortSignal;
}): Promise<ResolvedReferenceImage[]>;
/** Find images in caller order, or every image in the newest image-bearing message. */
export declare function findReferenceImages(messages: readonly Message[], sourceAttachmentIds?: readonly string[]): ImageAttachmentRef[];
/** Find the newest matching image in the effective, replacement-aware history. */
export declare function findReferenceImage(messages: readonly Message[], sourceAttachmentId?: string): ImageAttachmentRef | undefined;
/** Validate an untrusted serialized image reference at an HTTP/UI boundary. */
export declare function parseImageAttachmentRef(value: unknown): ImageAttachmentRef | undefined;
export declare function detectImageMediaType(data: Uint8Array): ImageMediaType | undefined;
