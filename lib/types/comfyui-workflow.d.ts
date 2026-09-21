export declare const COMFYUI_PROMPT_PLACEHOLDER = "{{prompt}}";
export declare const COMFYUI_SEED_PLACEHOLDER = "{{seed}}";
export declare const COMFYUI_IMAGE_PLACEHOLDER = "{{image}}";
type JsonRecord = Record<string, unknown>;
/** Validate imported JSON without exposing workflow graph details to callers. */
export declare function validateComfyUIWorkflowJson(workflowJson: string): void;
/**
 * Parse, clone, and inject one prompt plus an optional randomized seed.
 *
 * Prompt and seed placeholders are replaced inside any string so existing
 * workflows that embed them in longer text keep working. The image
 * placeholder is stricter: it only matches a dedicated `inputs.image` field
 * whose value is exactly the placeholder, and at most one may exist, because
 * the field must carry a single uploaded file name.
 */
export declare function prepareComfyUIWorkflow(workflowJson: string, prompt: string, seed?: number, image?: string): JsonRecord;
/** Random seed in the 32-bit range ComfyUI samplers accept. */
export declare function randomSeed(): number;
export {};
