import type { StudioWorkspaceInfo } from './shared.js';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
/**
 * Build the deterministic file name for a generated image:
 * `image-<digest-prefix>.<ext>`. The digest prefix comes from the
 * content-addressed attachment id, so the same image bytes always map to the
 * same file name regardless of when they were generated, and re-saving simply
 * overwrites the previous copy in place.
 * @param attachmentId - durable attachment id (`sha256:<hex>`).
 * @param mediaType - verified image media type.
 * @returns the file name (no directory).
 */
export declare function workspaceImageName(attachmentId: string, mediaType: ImageAttachmentRef['mediaType']): string;
/**
 * Resolve the configured image folder inside the session workspace. The
 * folder may nest, but must stay inside the workspace: absolute paths and
 * parent-traversal segments are rejected for both separator styles.
 *
 * This lexical pass is necessary but not sufficient: `saveImageToWorkspace`
 * additionally verifies the on-disk resolution so symlinked folders cannot
 * escape the workspace.
 * @param workspaceRoot - the session workspace directory.
 * @param folder - configured subfolder; empty/blank means the workspace root.
 * @returns the absolute image directory.
 * @throws when the folder would escape the workspace root.
 */
export declare function workspaceImageDir(workspaceRoot: string, folder: string | undefined): string;
/**
 * Write one generated image durably under the session workspace.
 *
 * Containment is enforced twice: lexically by `workspaceImageDir`, then
 * against real paths, so a configured folder (or any intermediate segment)
 * that is a symlink pointing outside the workspace is rejected before and
 * after anything is created.
 *
 * The bytes are written to a same-directory staging file and renamed onto the
 * target, so a crash never leaves a half-written image under its final name.
 * Re-saving identical bytes rewrites the same file (the name is content-
 * addressed), which keeps repeated generations idempotent. A cancellation is
 * honoured up to and including the final rename: an aborted save never
 * resolves successfully and never leaves the image behind under its final
 * name.
 * @param options - workspace root, configured folder, attachment identity, and image bytes.
 * @returns the absolute path of the written file.
 */
export declare function saveImageToWorkspace(options: {
    workspaceRoot: string;
    folder?: string | undefined;
    attachmentId: string;
    mediaType: ImageAttachmentRef['mediaType'];
    data: Uint8Array;
    signal?: AbortSignal;
}): Promise<string>;
/** Discover all DSH workspace paths recorded in local application storage. */
export declare function getDshWorkspaceRoots(): Promise<string[]>;
/** Discover detailed workspace records from DSH workspace.json storage. */
export declare function getDshWorkspacesFull(): Promise<StudioWorkspaceInfo[]>;
/**
 * Verify whether a candidate path lives within an allowed DSH workspace root.
 * Resolves symlinks via `realpath` to prevent symlink traversal attacks.
 * @returns the canonical realpath of the candidate root.
 * @throws when candidateRoot does not exist or falls outside the allowed roots.
 */
export declare function assertWorkspaceAllowed(candidateRoot: string, allowedRoots: Iterable<string>): Promise<string>;
/**
 * Safely delete a generated image file from workspace disk by its path.
 * Enforces strict safety gates:
 * 1. Base name must match generated image pattern (`image-<hex>.<ext>`) to avoid touching user files.
 * 2. Path must be a regular file and NOT a symbolic link.
 * 3. Real canonical path's basename must also match the pattern.
 * 4. Real canonical path must reside within an allowed workspace root (or process.cwd()).
 */
export declare function deleteImageFromWorkspace(filePath: string, allowedWorkspaceRoots?: Iterable<string>): Promise<boolean>;
/**
 * Safely find and delete a generated image file by its attachment ID within a single workspace root.
 * Strictly checks sha256:64hex format and avoids scanning unrelated workspaces.
 * Only used as fallback for historical images where savedTo was not persisted.
 */
export declare function deleteImageByAttachmentIdFromWorkspace(attachmentId: string, options?: {
    workspaceRoot?: string | undefined;
    folder?: string | undefined;
    allowedWorkspaceRoots?: Iterable<string> | undefined;
}): Promise<boolean>;
