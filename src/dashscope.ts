/** DashScope Qwen Image generation and editing adapter. */
import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment'
import { redactSecrets } from './redact.js'

export interface DashScopeImageOptions {
  apiKey: string
  endpoint: string
  model: string
  prompt: string
  size?: string
  maxBytes: number
  signal?: AbortSignal
  /**
   * Accept the Wan image family on this route. Bailian serves only Qwen-Image
   * here (Wan lives behind its own asynchronous API); the Qwen Token Plan
   * gateway serves Qwen-Image and Wan on the same multimodal-generation route.
   */
  allowWanModels?: boolean
}

export interface DashScopeEditOptions extends DashScopeImageOptions {
  sourceImages: Array<{ data: Uint8Array; mediaType: ImageMediaType }>
}

interface DashScopeChoiceMessageContent {
  text?: string
  image?: string
  image_url?: string
  url?: string
}

interface DashScopeResponse {
  output?: {
    choices?: Array<{ message?: { content?: DashScopeChoiceMessageContent[] } }>
  }
  message?: string
  code?: string
}

export async function generateDashScopeImage(options: DashScopeImageOptions): Promise<{
  data: Uint8Array
  mediaType: ImageAttachmentRef['mediaType']
}> {
  assertImageModel(options.model, options.allowWanModels === true)
  const formattedSize = formatSize(options.size)
  return requestQwenImage({
    ...options,
    requestBody: {
      model: options.model,
      input: {
        messages: [{ role: 'user', content: [{ text: options.prompt }] }],
      },
      parameters: {
        ...(formattedSize === undefined ? {} : { size: formattedSize }),
      },
    },
    operation: 'generation',
  })
}

export async function editDashScopeImage(options: DashScopeEditOptions): Promise<{
  data: Uint8Array
  mediaType: ImageAttachmentRef['mediaType']
}> {
  if (options.sourceImages.length > 3) throw new Error(`DashScope image editing supports at most 3 reference images; this selection resolved ${options.sourceImages.length}. Select fewer images or choose a provider that supports more references. No images were omitted.`)
  assertImageModel(options.model, options.allowWanModels === true)
  const formattedSize = formatSize(options.size)
  return requestQwenImage({
    ...options,
    requestBody: {
      model: options.model,
      input: {
        messages: [{
          role: 'user',
          content: [
            ...options.sourceImages.map(sourceImage => ({ image: toDataUrl(sourceImage) })),
            { text: options.prompt },
          ],
        }],
      },
      parameters: {
        prompt_extend: true,
        ...(formattedSize === undefined ? {} : { size: formattedSize }),
      },
    },
    operation: 'editing',
  })
}

function assertImageModel(model: string, allowWanModels: boolean): void {
  const id = model.toLowerCase()
  if (id.startsWith('qwen-image')) return
  if (allowWanModels && id.startsWith('wan')) return
  throw new Error(allowWanModels
    ? `Unsupported image model ${model} for this endpoint. Use a qwen-image or wan image model such as qwen-image-2.0 or wan2.7-image.`
    : `Unsupported DashScope image model ${model}. Configure a qwen-image model.`)
}

/**
 * Normalize the output size to the form this route accepts. The service rejects
 * anything but `WIDTH*HEIGHT` ("Invalid size format: 1024x1024, expected format:
 * width*height"), so the common separators are folded to `*` and everything
 * else fails loudly here instead of as an opaque 400 — or, worse, as a size the
 * caller believes was applied. `auto` is deliberately not passed through: this
 * route documents no such value, and omitting `size` is how a caller asks for
 * the service's own default.
 */
function formatSize(size: string | undefined): string | undefined {
  const raw = size?.trim() ?? ''
  if (raw.length === 0) return undefined
  const normalized = raw.replace(/[x×X*]/g, '*')
  if (!/^\d+\*\d+$/.test(normalized)) {
    throw new Error(`Invalid image size ${JSON.stringify(size)}: use "WIDTH*HEIGHT" such as 1024*1024 or 1280*720.`)
  }
  return normalized
}

function toDataUrl(image: { data: Uint8Array; mediaType: ImageMediaType }): string {
  return `data:${image.mediaType};base64,${Buffer.from(image.data).toString('base64')}`
}

async function requestQwenImage(options: DashScopeImageOptions & {
  requestBody: unknown
  operation: 'generation' | 'editing'
}): Promise<{ data: Uint8Array; mediaType: ImageAttachmentRef['mediaType'] }> {
  const base = options.endpoint.replace(/\/+$/, '')
  const response = await fetch(`${base}/services/aigc/multimodal-generation/generation`, {
    method: 'POST',
    ...(options.signal ? { signal: options.signal } : {}),
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(options.requestBody),
  })

  if (!response.ok) {
    const errorText = redactSecrets(await response.text(), options.apiKey)
    throw new Error(`DashScope image ${options.operation} failed (${String(response.status)}): ${errorText}`)
  }

  const payload = (await response.json()) as DashScopeResponse
  const imageUrl = extractImageUrl(payload)
  if (imageUrl === undefined) {
    throw new Error(`DashScope image ${options.operation} returned no image URL: ${redactSecrets(payload.message ?? JSON.stringify(payload), options.apiKey)}`)
  }
  return downloadImageBlob(imageUrl, options)
}

function extractImageUrl(response: DashScopeResponse): string | undefined {
  const contents = response.output?.choices?.[0]?.message?.content
  if (!Array.isArray(contents)) return undefined
  for (const item of contents) {
    if (item.image !== undefined && item.image.length > 0) return item.image
    if (item.image_url !== undefined && item.image_url.length > 0) return item.image_url
    if (item.url !== undefined && item.url.length > 0) return item.url
  }
  return undefined
}

async function downloadImageBlob(
  imageUrl: string,
  options: DashScopeImageOptions,
): Promise<{ data: Uint8Array; mediaType: ImageAttachmentRef['mediaType'] }> {
  const imageResponse = await fetch(imageUrl, {
    ...(options.signal ? { signal: options.signal } : {}),
  })
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch DashScope image from URL (${String(imageResponse.status)})`)
  }
  const buffer = await imageResponse.arrayBuffer()
  if (buffer.byteLength > options.maxBytes) {
    throw new Error(`DashScope generated image (${String(buffer.byteLength)} bytes) exceeds the ${String(options.maxBytes)} byte limit`)
  }
  const contentType = imageResponse.headers.get('content-type')
  const mediaType: ImageAttachmentRef['mediaType'] =
    contentType?.includes('png') ? 'image/png' :
    contentType?.includes('webp') ? 'image/webp' :
    'image/jpeg'
  return { data: new Uint8Array(buffer), mediaType }
}
