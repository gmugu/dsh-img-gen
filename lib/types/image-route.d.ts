/** Same-origin HTTP bridge from the Web result card to the Attachment service. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ImageAttachmentRef, StoredImageAttachment } from '@deepseek-ai/dsh-attachment';
export { IMAGE_ROUTE, DELETE_ROUTE, SAVE_WORKSPACE_ROUTE } from './shared.js';
/** Dependencies required by the save-workspace route. */
export interface SaveWorkspaceRouteDeps {
    readImage(ref: ImageAttachmentRef): Promise<{
        data: Uint8Array;
    }>;
    saveToWorkspace(options: {
        workspaceRoot: string;
        attachmentId: string;
        mediaType: ImageAttachmentRef['mediaType'];
        data: Uint8Array;
    }): Promise<string>;
    getActiveWorkspaceRoot(): string;
    getAllowedWorkspaceRoots(): Promise<Iterable<string>> | Iterable<string>;
    isSaveEnabled(): boolean;
}
/** Dependencies required by the image route. */
export interface ImageRouteDeps {
    readImage(ref: ImageAttachmentRef): Promise<StoredImageAttachment>;
}
/** Dependencies required by the delete route. */
export interface DeleteRouteDeps {
    deleteWorkspaceImage(filePath: string): Promise<boolean>;
}
/** Serve one verified durable image reference to a same-origin browser request. */
export declare function serveImage(req: IncomingMessage, res: ServerResponse, deps: ImageRouteDeps): Promise<void>;
/** Safely delete one or more generated image files from the workspace disk. */
export declare function serveDelete(req: IncomingMessage, res: ServerResponse, deps: DeleteRouteDeps): Promise<void>;
/** Serve on-demand image persistence into the workspace. */
export declare function serveSaveWorkspace(req: IncomingMessage, res: ServerResponse, deps: SaveWorkspaceRouteDeps): Promise<void>;
/** Validate the persisted reference carried by a tool presentation. */
export declare function imageAttachmentFromMeta(meta: unknown): ImageAttachmentRef | undefined;
