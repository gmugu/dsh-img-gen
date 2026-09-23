/** Multi-provider image-generation Bundle for DeepSeek Harness. */
import type { Context } from '@deepseek-ai/cordis'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-host-webserver'
// Type-only: pulls the `settings` service declaration onto Context.
import type {} from '@deepseek-ai/dsh-settings'
import { defineTool, type ToolResult } from '@deepseek-ai/dsh-tools'
import { Config, migrateOpenAICompatConfig, resolveProvider, selectComfyUIWorkflow, withProviderOverrides, type AspectRatio, type ImageSize } from './config.js'
import { requireApiKey, resolveApiKey } from './credentials.js'
import { editComfyUIImage, generateComfyUIImage } from './comfyui.js'
import { editDashScopeImage, generateDashScopeImage } from './dashscope.js'
import { editGoogleImage, generateGoogleImage } from './google.js'
import { imageAttachmentFromMeta } from './image-route.js'
import { editOpenAICompatibleImage, generateOpenAICompatibleImage } from './openai-compatible.js'
import { type ResolvedReferenceImage, resolveReferenceImages } from './reference-image.js'
import { editSeedreamImage } from './seedream.js'
import { generateSubscriptionImage, registerSubscriptionRoutes, SubscriptionManager } from './subscription.js'
import { IMAGE_PROVIDERS, TEST_CONNECTION_ROUTE, alibabaAspectSize, alibabaEditSize, mergeComfyUIPrompt, sizeMismatch, type ImageProvider } from './shared.js'
import { serveTestConnection } from './test-route.js'
import { saveImageToWorkspace } from './workspace-save.js'

export { Config } from './config.js'
export { imageAttachmentFromMeta } from './image-route.js'
export { TEST_CONNECTION_ROUTE } from './shared.js'

export const name = 'dsh-image-gen'
export const inject = ['tools', 'attachments', 'credentials', 'webServer']

/** Realized image plus the provenance the tool output advertises. */
interface GeneratedValue {
  attachment: ImageAttachmentRef
  provider: ImageProvider
  model: string
  output: string
  savedTo?: string
  saveError?: string
  /** Set when the provider returned a size the caller did not ask for. */
  sizeWarning?: string
  /** Concrete workflow seed, exposed by the ComfyUI provider for provenance. */
  seed?: number
}

/** Validate the untrusted per-call provider override from tool arguments. */
function providerOverrideOf(value: unknown): ImageProvider | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !(IMAGE_PROVIDERS as readonly string[]).includes(value)) {
    throw new Error(`Unsupported provider ${JSON.stringify(value)}. Supported providers: ${IMAGE_PROVIDERS.join(', ')}.`)
  }
  return value as ImageProvider
}

/**
 * Unwrap the volatile config the Loader hands the plugin on DSH 0.1.6+:
 * with the whole Config schema marked volatile, `config` is a stable
 * reference cell whose `.get()` always returns the current values (edits
 * through the settings form update it in place without remounting). The
 * plain-object branch only serves unit tests that call `apply` directly.
 */
function liveConfig(source: unknown): Config {
  const cell = source as { get?: unknown } | null | undefined
  const raw = cell !== null && typeof cell === 'object' && typeof cell.get === 'function'
    ? cell.get()
    : source
  return (raw ?? {}) as Config
}

export function apply(ctx: Context, config: Config = {}): void {
  // Migration on every read: relay configs saved under the old single OpenAI
  // slot keep moving to the dedicated compat row until the persisted copy is
  // rewritten, so both rows coexist after any upgrade.
  let current: () => Config = () => migrateOpenAICompatConfig(liveConfig(config))
  const knownWorkspaceRoots = new Set<string>()
  // Subscription image accounts: login flows, blob storage, refresh, and the
  // vendor wire calls. One instance per application; tokens stay host-side.
  const subscriptionManager = new SubscriptionManager(ctx)
  registerSubscriptionRoutes(ctx, subscriptionManager)

  // DSH 0.1.6+ settings: the Config schema above is volatile, so the settings
  // service derives the editable form and keeps the live values flowing into
  // `current()` without remounting. This bundle ships its own settings card,
  // so opt out of the schema-generated page. The optional `ctx.inject` child
  // is the registration pattern documented by dsh-settings; the extra
  // `configure` probe only degrades silently in unit-test harnesses whose
  // mock settings service omits the method.
  ctx.inject(['settings'], (settingsCtx: Context) => {
    const configure = (settingsCtx.settings as unknown as { configure?: (presentation: { auto?: boolean }, owner?: unknown) => () => void }).configure
    if (typeof configure !== 'function') return
    settingsCtx.effect(() => configure.call(settingsCtx.settings, { auto: false }, ctx.fiber), 'dsh-image-gen: settings page policy')
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: TEST_CONNECTION_ROUTE,
    handler: (req, res) => serveTestConnection(req, res, {
      resolveKey: provider => resolveApiKey(ctx, provider),
      config: () => current(),
      subscriptionManager,
    }),
  }), 'dsh-image-gen: test connection route')
  ctx.tools.register(defineTool({
    name: 'generate_image',
    description: 'Generate a new image with the configured provider. Use when the user asks to create or draw a new image; use edit_image instead when they want to change an existing image. Give a complete visual prompt including subject, composition, style, lighting, and any exact text that should appear. The optional provider/model arguments switch provider or model for this call only when the user asks for a specific one. A successful image is attached directly to the conversation and may also be saved under the session workspace. Do not call read, glob, or other tools to locate or verify the image.',
    parameters: {
      prompt: { type: 'string', required: true, description: 'Complete description of the image to generate.' },
      provider: { type: 'string', enum: ['google', 'openai', 'openai-compat', 'seedream', 'dashscope', 'qwen-token-plan', 'xai', 'zhipu', 'comfyui', 'chatgpt-sub', 'grok-sub', 'google-sub'], description: 'Optional provider for this call only (for example when the user asks to use a specific provider); omit to use the configured default. chatgpt-sub, grok-sub, and google-sub generate through the logged-in subscription account instead of an API key.' },
      model: { type: 'string', description: 'Optional model name for this call only, overriding the configured model. Not used by ComfyUI (use workflow instead) nor by the subscription providers (model fixed by the subscription).' },
      aspect_ratio: { type: 'string', enum: ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16'], description: 'Optional output aspect ratio. Google Gemini sends it as-is; the Alibaba rows translate it into their own size. Every other provider ignores it, so pass size instead.' },
      image_size: { type: 'string', enum: ['1K', '2K', '4K'], description: 'Optional output resolution for Google Gemini.' },
      size: { type: 'string', description: 'Optional output size. Google Gemini uses image_size (1K/2K/4K) instead. The Alibaba rows take "WIDTH*HEIGHT" (for example 1280*720); every other provider keeps its own form (for example 1024x1024 or 2K).' },
      workflow: { type: 'string', description: 'Optional name of the ComfyUI workflow to run; omit to use the active workflow from settings. Only meaningful when the ComfyUI provider is selected.' },
    },
    output: imageOutput('Generated'),
    async execute(args, exec): Promise<GeneratedValue> {
      const active = resolveProvider(withProviderOverrides(current(), providerOverrideOf(args.provider), args.model))
      if (active.provider === 'comfyui') {
        const workflow = selectComfyUIWorkflow(active, args.workflow)
        const generated = await generateComfyUIImage({
          baseURL: active.baseURL,
          workflowJson: workflow.json,
          prompt: mergeComfyUIPrompt(workflow.presetPrompt, args.prompt),
          timeoutMs: active.timeoutMs,
          maxBytes: ctx.attachments.imageLimits.maxImageBytes,
          signal: exec.signal,
        })
        return saveGenerated(ctx, generated, active.provider, workflow.name, 'API workflow', current(), exec, knownWorkspaceRoots)
      }
      if (active.provider === 'chatgpt-sub' || active.provider === 'grok-sub' || active.provider === 'google-sub') {
        const generated = await generateSubscriptionImage({
          manager: subscriptionManager,
          provider: active.provider,
          prompt: args.prompt,
          ...(args.size !== undefined ? { size: args.size } : {}),
          maxBytes: ctx.attachments.imageLimits.maxImageBytes,
          signal: exec.signal,
        })
        return saveGenerated(ctx, generated, active.provider, active.model, 'subscription', current(), exec, knownWorkspaceRoots)
      }
      const credential = await requireApiKey(ctx, active.provider, 'generate_image')
      if (active.provider === 'google') {
        const aspectRatio = (args.aspect_ratio ?? active.aspectRatio) as AspectRatio
        const imageSize = (args.image_size ?? active.imageSize) as ImageSize
        const generated = await generateGoogleImage({ apiKey: credential, endpoint: active.endpoint, model: active.model, prompt: args.prompt, aspectRatio, imageSize, maxBytes: ctx.attachments.imageLimits.maxImageBytes, signal: exec.signal })
        return saveGenerated(ctx, generated, active.provider, active.model, `${aspectRatio}, ${imageSize}`, current(), exec, knownWorkspaceRoots)
      }
      if (active.provider === 'dashscope' || active.provider === 'qwen-token-plan') {
        // `aspect_ratio` is a Google-shaped parameter this route cannot carry;
        // translating it here is what keeps a caller's "16:9" from silently
        // becoming the square default.
        const size = args.size ?? alibabaAspectSize(args.aspect_ratio) ?? active.imageSize
        const generated = await generateDashScopeImage({ apiKey: credential, endpoint: active.endpoint, model: active.model, prompt: args.prompt, size, maxBytes: ctx.attachments.imageLimits.maxImageBytes, signal: exec.signal, allowWanModels: active.allowWanModels })
        return saveGenerated(ctx, generated, active.provider, active.model, size, current(), exec, knownWorkspaceRoots, size)
      }
      const size = args.size ?? active.imageSize
      // Ark output controls exist only on the Seedream profile; every other
      // provider in this branch ignores them.
      const arkOptions = active.provider === 'seedream' ? active.arkOptions : undefined
      const generated = await generateOpenAICompatibleImage({ provider: active.provider, apiKey: credential, baseURL: active.baseURL, model: active.model, prompt: args.prompt, size, maxBytes: ctx.attachments.imageLimits.maxImageBytes, signal: exec.signal, ...(arkOptions === undefined ? {} : { arkOptions }) })
      return saveGenerated(ctx, generated, active.provider, active.model, size, current(), exec, knownWorkspaceRoots, size)
    },
    presentResult: (_args, result) => imagePresentation(result),
  }))

  ctx.tools.register(defineTool({
    name: 'edit_image',
    description: 'Edit, combine, or restyle existing images with the configured provider. Images attached inline to the latest human message are already readable DSH attachments even when no workspace file exists. In that case, call edit_image immediately with prompt only; NEVER call read_image, glob, or shell to locate them, and NEVER invent @ paths. All inline images will be used in upload order. For specific older conversation images use source_attachment_id or source_attachment_ids; both canonical sha256: IDs and full bare SHA-256 digests are accepted. For files the user explicitly names in the workspace use source_path or source_paths. Provide at most one selector field. Without a selector, images from the latest human message take priority; only when that message has no images does editing fall back to the newest conversation image.',
    parameters: {
      prompt: { type: 'string', required: true, description: 'Describe the changes to make while preserving everything else that should remain.' },
      provider: { type: 'string', enum: ['google', 'openai', 'openai-compat', 'seedream', 'dashscope', 'qwen-token-plan', 'xai', 'zhipu', 'comfyui', 'chatgpt-sub', 'grok-sub', 'google-sub'], description: 'Optional provider for this call only (for example when the user asks to use a specific provider); omit to use the configured default. chatgpt-sub, grok-sub, and google-sub edit images through the logged-in subscription account instead of an API key.' },
      model: { type: 'string', description: 'Optional model name for this call only, overriding the configured model. Not used by ComfyUI (use workflow instead) nor by the subscription providers (model fixed by the subscription).' },
      source_attachment_id: { type: 'string', description: 'Optional attachment id of a specific image already present in the current conversation.' },
      source_attachment_ids: { type: 'array', items: { type: 'string' }, description: 'Optional ordered attachment ids of multiple images already present in the current conversation. Prompt references such as image 1 and image 2 follow this order.' },
      source_path: { type: 'string', description: 'Optional absolute or workspace-relative path of a specific image file inside the active session workspace. Prefer this when the user names a saved file.' },
      source_paths: { type: 'array', items: { type: 'string' }, description: 'Optional ordered absolute or workspace-relative paths of multiple image files inside the active session workspace.' },
      aspect_ratio: { type: 'string', enum: ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16'], description: 'Optional output aspect ratio. Google Gemini sends it as-is; the Alibaba rows translate it into their own size and it wins over the reference image size. Every other provider ignores it, so pass size instead.' },
      image_size: { type: 'string', enum: ['1K', '2K', '4K'], description: 'Optional output resolution for Google Gemini.' },
      size: { type: 'string', description: 'Optional output size. Google Gemini uses image_size (1K/2K/4K) instead. The Alibaba rows take "WIDTH*HEIGHT" (for example 1280*720) and otherwise keep the reference image size; every other provider keeps its own form (for example 1024x1024 or 2K).' },
      workflow: { type: 'string', description: 'Optional name of the ComfyUI workflow to run; omit to use the active workflow from settings. Only meaningful when the ComfyUI provider is selected.' },
    },
    output: imageOutput('Edited'),
    async execute(args, exec): Promise<GeneratedValue> {
      const active = resolveProvider(withProviderOverrides(current(), providerOverrideOf(args.provider), args.model))
      const sourceImages: ResolvedReferenceImage[] = await resolveReferenceImages({
        ...(exec.agent === undefined ? {} : { agent: exec.agent }),
        attachments: ctx.attachments,
        ...(typeof args.source_attachment_id === 'string' ? { sourceAttachmentId: args.source_attachment_id } : {}),
        ...(Array.isArray(args.source_attachment_ids) ? { sourceAttachmentIds: args.source_attachment_ids } : {}),
        ...(typeof args.source_path === 'string' ? { sourcePath: args.source_path } : {}),
        ...(Array.isArray(args.source_paths) ? { sourcePaths: args.source_paths } : {}),
        maxBytes: ctx.attachments.imageLimits.maxImageBytes,
        signal: exec.signal,
      })

      if (active.provider === 'comfyui') {
        if (sourceImages.length > 1) {
          throw new Error(`ComfyUI edit_image supports exactly one source image per call; this call resolved ${String(sourceImages.length)} images. Call edit_image again with source_attachment_id set to the single attachment ID of the image to edit.`)
        }
        const sourceImage = sourceImages[0]
        if (sourceImage === undefined) throw new Error('edit_image requires a reference image')
        const workflow = selectComfyUIWorkflow(active, args.workflow)
        const generated = await editComfyUIImage({
          baseURL: active.baseURL,
          workflowJson: workflow.json,
          prompt: mergeComfyUIPrompt(workflow.presetPrompt, args.prompt),
          sourceImage: { data: sourceImage.data, mediaType: sourceImage.mediaType },
          timeoutMs: active.timeoutMs,
          maxBytes: ctx.attachments.imageLimits.maxImageBytes,
          signal: exec.signal,
        })
        return saveGenerated(ctx, generated, active.provider, workflow.name, 'API workflow', current(), exec, knownWorkspaceRoots)
      }

      if (active.provider === 'chatgpt-sub' || active.provider === 'grok-sub' || active.provider === 'google-sub') {
        if (sourceImages.length === 0) throw new Error('edit_image requires a reference image')
        const generated = await generateSubscriptionImage({
          manager: subscriptionManager,
          provider: active.provider,
          prompt: args.prompt,
          sourceImages,
          ...(args.size !== undefined ? { size: args.size } : {}),
          maxBytes: ctx.attachments.imageLimits.maxImageBytes,
          signal: exec.signal,
        })
        return saveGenerated(ctx, generated, active.provider, active.model, 'subscription edit', current(), exec, knownWorkspaceRoots)
      }

      const credential = await requireApiKey(ctx, active.provider, 'edit_image')
      if (active.provider === 'google') {
        const aspectRatio = (args.aspect_ratio ?? active.aspectRatio) as AspectRatio
        const imageSize = (args.image_size ?? active.imageSize) as ImageSize
        const generated = await editGoogleImage({ apiKey: credential, endpoint: active.endpoint, model: active.model, prompt: args.prompt, sourceImages, aspectRatio, imageSize, maxBytes: ctx.attachments.imageLimits.maxImageBytes, signal: exec.signal })
        return saveGenerated(ctx, generated, active.provider, active.model, `${aspectRatio}, ${imageSize}`, current(), exec, knownWorkspaceRoots)
      }

      const size = args.size ?? active.imageSize
      if (active.provider === 'openai' || active.provider === 'openai-compat' || active.provider === 'xai' || active.provider === 'zhipu') {
        const generated = await editOpenAICompatibleImage({ apiKey: credential, baseURL: active.baseURL, model: active.model, prompt: args.prompt, sourceImages, size, maxBytes: ctx.attachments.imageLimits.maxImageBytes, signal: exec.signal, ...(active.provider === 'openai-compat' ? { editFormat: active.editFormat, editExtra: active.editExtra } : {}) })
        return saveGenerated(ctx, generated, active.provider, active.model, size, current(), exec, knownWorkspaceRoots, size)
      }
      if (active.provider === 'seedream') {
        const generated = await editSeedreamImage({ apiKey: credential, baseURL: active.baseURL, model: active.model, prompt: args.prompt, sourceImages, size, maxBytes: ctx.attachments.imageLimits.maxImageBytes, signal: exec.signal, arkOptions: active.arkOptions })
        return saveGenerated(ctx, generated, active.provider, active.model, size, current(), exec, knownWorkspaceRoots, size)
      }
      // Alibaba-native editing: an explicit size wins, then an explicit ratio,
      // then the reference image's own resolution when it is known and inside
      // the route's documented window, so the edit keeps the original size.
      // Otherwise leave `size` out entirely — the service then keeps the input
      // aspect ratio at roughly 1024*1024 pixels instead of failing on an
      // out-of-range value.
      const editSize = args.size ?? alibabaAspectSize(args.aspect_ratio) ?? alibabaEditSize(sourceImages, active.model)
      const generated = await editDashScopeImage({ apiKey: credential, endpoint: active.endpoint, model: active.model, prompt: args.prompt, sourceImages, ...(editSize === undefined ? {} : { size: editSize }), maxBytes: ctx.attachments.imageLimits.maxImageBytes, signal: exec.signal, allowWanModels: active.allowWanModels })
      return saveGenerated(ctx, generated, active.provider, active.model, editSize ?? 'auto (source aspect)', current(), exec, knownWorkspaceRoots, editSize)
    },
    presentResult: (_args, result) => imagePresentation(result),
  }))
}

function imageOutput(verb: 'Generated' | 'Edited') {
  return {
    schema: {
      type: 'object', additionalProperties: false, properties: {
        attachment: { type: 'object', required: true, additionalProperties: false, properties: {
          attachmentId: { type: 'string', required: true }, mediaType: { type: 'string', required: true }, bytes: { type: 'integer', required: true }, width: { type: 'integer', required: true }, height: { type: 'integer', required: true }, name: { type: 'string' }, originalDimensions: { type: 'object', additionalProperties: false, properties: { width: { type: 'integer', required: true }, height: { type: 'integer', required: true } } },
        } },
        provider: { type: 'string', required: true }, model: { type: 'string', required: true }, output: { type: 'string', required: true }, savedTo: { type: 'string' }, saveError: { type: 'string' }, sizeWarning: { type: 'string' }, seed: { type: 'integer' },
      },
    },
    render: (_args: unknown, value: GeneratedValue) => {
      const saved = typeof value.savedTo === 'string' ? ` It was also saved to the workspace as ${value.savedTo}.` : typeof value.saveError === 'string' ? ` Saving it to the workspace failed: ${value.saveError}.` : ' It has no local file path.'
      const action = verb === 'Generated' ? 'It is already attached to the conversation.' : 'The edited image is attached to the conversation.'
      const warning = typeof value.sizeWarning === 'string' ? ` WARNING: ${value.sizeWarning}` : ''
      return [
        { type: 'text' as const, text: `${verb} one image with ${value.provider}/${value.model} (${value.output}).${warning} Attachment ID: ${String(value.attachment.attachmentId)}. ${action}${saved} Respond to the user without reading or searching for the image.` },
        { type: 'image' as const, attachment: value.attachment },
      ]
    },
    presentationMeta: (args: unknown, value: GeneratedValue) => ({
      kind: 'dsh-image-gen', attachment: attachmentMeta(value.attachment), provider: value.provider, model: value.model, output: value.output,
      ...(value.sizeWarning === undefined ? {} : { sizeWarning: value.sizeWarning }),
      ...(verb === 'Edited' ? { operation: 'edit' } : {}),
      ...(typeof value.savedTo === 'string' ? { savedTo: value.savedTo } : {}),
      ...(typeof value.seed === 'number' ? { seed: value.seed } : {}),
      prompt: (args as { prompt: string }).prompt,
    }),
  } as const
}

function attachmentMeta(ref: ImageAttachmentRef) {
  return {
    attachmentId: String(ref.attachmentId), mediaType: ref.mediaType, bytes: ref.bytes, width: ref.width, height: ref.height,
    ...(ref.name === undefined ? {} : { name: ref.name }),
    ...(ref.originalDimensions === undefined ? {} : { originalDimensions: { width: ref.originalDimensions.width, height: ref.originalDimensions.height } }),
  }
}

async function saveGenerated(
  ctx: Context,
  generated: { data: Uint8Array; mediaType: ImageAttachmentRef['mediaType']; seed?: number },
  provider: ImageProvider,
  model: string,
  output: string,
  config: Config,
  exec: { agent?: { session: { header: { cwd?: string } } }; signal: AbortSignal },
  knownRoots?: Set<string>,
  /** Size the caller asked for, when it was a concrete `WIDTH*HEIGHT`. */
  expectedSize?: string,
): Promise<GeneratedValue> {
  if (!ctx.attachments.imageLimits.mediaTypes.includes(generated.mediaType)) throw new Error(`This DSH deployment does not accept ${generated.mediaType} generated images`)
  const attachment = await ctx.attachments.saveImage({ data: generated.data, mediaType: generated.mediaType, name: 'generated-image' })
  // The stored attachment already carries the real pixel size, so a provider
  // that ignored the requested size is caught here instead of being trusted.
  const sizeWarning = expectedSize === undefined ? undefined : sizeMismatch(expectedSize, attachment)
  const value: GeneratedValue = {
    attachment, provider, model, output,
    ...(sizeWarning === undefined ? {} : { sizeWarning }),
    ...(typeof generated.seed === 'number' ? { seed: generated.seed } : {}),
  }
  if (config.saveToWorkspace === false) return value
  const workspaceRoot = exec.agent?.session.header.cwd
  if (workspaceRoot === undefined) return value
  knownRoots?.add(workspaceRoot)
  try {
    value.savedTo = await saveImageToWorkspace({ workspaceRoot, folder: config.workspaceFolder, attachmentId: attachment.attachmentId, mediaType: generated.mediaType, data: generated.data, signal: exec.signal })
  } catch (error) {
    exec.signal.throwIfAborted()
    ctx.logger.warn(`dsh-image-gen: failed to save image to workspace: ${error instanceof Error ? error.message : String(error)}`)
    value.saveError = error instanceof Error ? error.message : String(error)
  }
  return value
}

function imagePresentation(result: ToolResult) {
  const attachment = imageAttachmentFromMeta(result.meta)
  return attachment === undefined ? undefined : { card: 'generic' as const, title: 'Generated image', content: [{ type: 'image' as const, attachment }] }
}
