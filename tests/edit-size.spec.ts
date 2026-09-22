import type { Context } from '@deepseek-ai/cordis'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-settings', () => {
  class SettingsProvider {
    installSection(): void {}
  }
  return { SettingsProvider }
})

import { apply, type Config } from '../src/index.js'

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function imageRef(id: string, width: number, height: number): ImageAttachmentRef {
  return {
    attachmentId: id as ImageAttachmentRef['attachmentId'],
    mediaType: 'image/png',
    bytes: PNG_BYTES.byteLength,
    width,
    height,
    name: `${id}.png`,
  }
}

/** Tool exec carrying a latest user message with the given inline reference images. */
function execWithImages(refs: ImageAttachmentRef[], cwd?: string): never {
  return {
    signal: new AbortController().signal,
    agent: {
      session: {
        header: cwd === undefined ? {} : { cwd },
        deriveMessages: () => [{
          source: { kind: 'user' },
          content: refs.map(ref => ({ type: 'image', attachment: ref })),
        }],
      },
    },
  } as never
}

interface Harness {
  ctx: Context
  tools: ToolDefinition[]
}

/**
 * `saved` is the size the attachment store reports for the stored image — the
 * fixture for the "did the provider actually honour the request" check.
 */
function harness(config: Config, saved: { width: number; height: number } = { width: 1024, height: 1024 }): Harness {
  const tools: ToolDefinition[] = []
  const ctx = {
    tools: { register: (tool: ToolDefinition) => { tools.push(tool) } },
    effect: (setup: () => unknown) => setup(),
    webServer: { register: vi.fn(() => () => {}) },
    credentials: { resolve: vi.fn(async () => ({ value: 'test-key' })) },
    inject: (services: readonly string[], callback: (owner: unknown) => void) => {
      if (services.includes('settings')) callback({ settings: { installSection: vi.fn() } })
    },
    attachments: {
      imageLimits: {
        maxImageBytes: 10 * 1024 * 1024,
        mediaTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      },
      // The store echoes the durable ref, which is where the dimensions live.
      readImage: vi.fn(async (ref: ImageAttachmentRef) => ({ ref, data: PNG_BYTES })),
      saveImage: vi.fn(async () => imageRef('sha256:saved-image', saved.width, saved.height)),
    },
    logger: { warn: vi.fn() },
  } as unknown as Context
  apply(ctx, { saveToWorkspace: false, ...config })
  return { ctx, tools }
}

function toolByName(tools: ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find(candidate => candidate.name === name)
  if (tool === undefined) throw new Error(`missing tool ${name}`)
  return tool
}

/** Fetch stub answering the DashScope-native generation route, then the image URL. */
function dashscopeFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const target = String(url)
    if (target.includes('/services/aigc/multimodal-generation/generation')) {
      return new Response(JSON.stringify({
        output: { choices: [{ message: { content: [{ image: 'https://dashscope-result.oss.aliyuncs.com/out.png' }] } }] },
      }), { headers: { 'content-type': 'application/json' } })
    }
    return new Response(PNG_BYTES, { headers: { 'content-type': 'image/png' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Request body of the first fetch call the stub saw. */
function bodyOf(fetchMock: ReturnType<typeof vi.fn>): { parameters: Record<string, unknown> } {
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  return JSON.parse(String(init.body)) as { parameters: Record<string, unknown> }
}

describe('Alibaba-native image size policy', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('always sends the profile default explicitly on generation', async () => {
    const { ctx, tools } = harness({ provider: 'qwen-token-plan' })
    const fetchMock = dashscopeFetch()

    const value = await toolByName(tools, 'generate_image').execute(
      { prompt: 'a cat' },
      execWithImages([]),
    ) as { output: string; sizeWarning?: string }

    expect(bodyOf(fetchMock).parameters.size).toBe('1024*1024')
    expect(value.output).toBe('1024*1024')
    expect(value.sizeWarning).toBeUndefined()
    expect(vi.mocked(ctx.attachments.saveImage)).toHaveBeenCalledOnce()
  })

  it('translates aspect_ratio into the native size on generation', async () => {
    // The regression this exists for: a caller asking for 16:9 used to get the
    // square default because this route cannot carry `aspect_ratio`.
    const { tools } = harness({ provider: 'qwen-token-plan' }, { width: 1280, height: 720 })
    const fetchMock = dashscopeFetch()

    const value = await toolByName(tools, 'generate_image').execute(
      { prompt: 'a black hole', aspect_ratio: '16:9' },
      execWithImages([]),
    ) as { output: string; sizeWarning?: string }

    expect(bodyOf(fetchMock).parameters.size).toBe('1280*720')
    expect(value.output).toBe('1280*720')
    expect(value.sizeWarning).toBeUndefined()
  })

  it('lets an explicit size win over a translated ratio', async () => {
    const { tools } = harness({ provider: 'dashscope' }, { width: 1664, height: 936 })
    const fetchMock = dashscopeFetch()

    await toolByName(tools, 'generate_image').execute(
      { prompt: 'a black hole', aspect_ratio: '16:9', size: '1664*936' },
      execWithImages([]),
    )

    expect(bodyOf(fetchMock).parameters.size).toBe('1664*936')
  })

  it('rejects a ratio outside the declared enum before any request goes out', async () => {
    // The tool schema's enum is enforced by the harness, so `alibabaAspectSize`'s
    // own unsupported-ratio error is only a backstop for direct callers.
    const { tools } = harness({ provider: 'qwen-token-plan' })
    const fetchMock = dashscopeFetch()

    await expect(toolByName(tools, 'generate_image').execute(
      { prompt: 'a black hole', aspect_ratio: '21:9' },
      execWithImages([]),
    )).rejects.toThrow('must be one of')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the reference image resolution when editing, so the edit keeps it', async () => {
    const { ctx, tools } = harness({ provider: 'qwen-token-plan' }, { width: 1280, height: 960 })
    const fetchMock = dashscopeFetch()

    const value = await toolByName(tools, 'edit_image').execute(
      { prompt: 'add sunglasses' },
      execWithImages([imageRef('source', 1280, 960)]),
    ) as { output: string; sizeWarning?: string }

    expect(bodyOf(fetchMock).parameters.size).toBe('1280*960')
    expect(value.output).toBe('1280*960')
    expect(value.sizeWarning).toBeUndefined()
    expect(vi.mocked(ctx.attachments.saveImage)).toHaveBeenCalledOnce()
  })

  it('lets an explicit ratio win over the reference image size when editing', async () => {
    const { tools } = harness({ provider: 'qwen-token-plan' }, { width: 1280, height: 720 })
    const fetchMock = dashscopeFetch()

    await toolByName(tools, 'edit_image').execute(
      { prompt: 'crop to cinematic', aspect_ratio: '16:9' },
      execWithImages([imageRef('source', 1280, 960)]),
    )

    expect(bodyOf(fetchMock).parameters.size).toBe('1280*720')
  })

  it('leaves size out when the reference resolution is outside the documented window', async () => {
    const { ctx, tools } = harness({ provider: 'qwen-token-plan' }, { width: 1024, height: 1024 })
    const fetchMock = dashscopeFetch()

    const value = await toolByName(tools, 'edit_image').execute(
      { prompt: 'add sunglasses' },
      execWithImages([imageRef('huge', 4096, 4096)]),
    ) as { output: string; sizeWarning?: string }

    // No size at all: the service then keeps the input aspect ratio itself.
    expect(bodyOf(fetchMock).parameters).not.toHaveProperty('size')
    expect(value.output).toBe('auto (source aspect)')
    // Nothing was requested, so there is nothing to warn about.
    expect(value.sizeWarning).toBeUndefined()
    expect(vi.mocked(ctx.attachments.saveImage)).toHaveBeenCalledOnce()
  })

  it('lets the caller override the reference resolution', async () => {
    const { tools } = harness({ provider: 'qwen-token-plan' }, { width: 1664, height: 928 })
    const fetchMock = dashscopeFetch()

    await toolByName(tools, 'edit_image').execute(
      { prompt: 'wider crop', size: '1664x928' },
      execWithImages([imageRef('source', 1280, 960)]),
    )

    expect(bodyOf(fetchMock).parameters.size).toBe('1664*928')
  })

  it('never guesses a size for a Wan model, whose window this route does not document', async () => {
    const { tools } = harness({ provider: 'qwen-token-plan', qwenTokenPlanModel: 'wan2.7-image' })
    const fetchMock = dashscopeFetch()

    await toolByName(tools, 'edit_image').execute(
      { prompt: 'add sunglasses' },
      execWithImages([imageRef('source', 1280, 960)]),
    )

    expect(bodyOf(fetchMock).parameters).not.toHaveProperty('size')
  })

  it('leaves size out for a workspace file, whose dimensions nothing measured', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'dsh-image-gen-edit-size-'))
    await writeFile(join(workspaceRoot, 'source.png'), PNG_BYTES)
    const { tools } = harness({ provider: 'qwen-token-plan' })
    const fetchMock = dashscopeFetch()

    await toolByName(tools, 'edit_image').execute(
      { prompt: 'add sunglasses', source_path: 'source.png' },
      execWithImages([], workspaceRoot),
    )

    expect(bodyOf(fetchMock).parameters).not.toHaveProperty('size')
  })

  it('warns when the provider returns a size the caller did not ask for', async () => {
    // The store reports the square the upstream actually produced.
    const { tools } = harness({ provider: 'qwen-token-plan' }, { width: 1024, height: 1024 })
    dashscopeFetch()

    const value = await toolByName(tools, 'generate_image').execute(
      { prompt: 'a black hole', aspect_ratio: '16:9' },
      execWithImages([]),
    ) as { output: string; sizeWarning?: string }

    expect(value.sizeWarning).toBe('the requested size was 1280*720 but the provider returned 1024×1024, so the upstream ignored or altered it.')
    const rendered = toolByName(tools, 'generate_image').output.render({ prompt: 'a black hole' }, value as never)
    expect(JSON.stringify(rendered)).toContain('WARNING: the requested size was 1280*720')
  })

  it('keeps other providers on the upstream generation size and ignores Gemini-only args', async () => {
    const { tools } = harness({ provider: 'openai' })
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ data: [{ b64_json: Buffer.from('edited image').toString('base64') }] }),
      { headers: { 'content-type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)

    await toolByName(tools, 'edit_image').execute(
      // `image_size` is Gemini-only; upstream silently ignores it elsewhere and
      // this fork keeps that behaviour instead of failing the call.
      { prompt: 'add sunglasses', image_size: '2K' },
      execWithImages([imageRef('source', 1280, 960)]),
    )

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.body as FormData).get('size')).toBe('1024x1024')
  })
})