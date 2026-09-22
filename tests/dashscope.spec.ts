import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateDashScopeImage } from '../src/dashscope.js'

const signal = new AbortController().signal
const endpoint = 'https://dashscope.aliyuncs.com/api/v1'
const imagePngBytes = Buffer.from('fake-dashscope-png-bytes')

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function imageResponse(bytes: Buffer, contentType = 'image/png'): Response {
  return new Response(bytes, {
    status: 200,
    headers: { 'content-type': contentType },
  })
}

describe('generateDashScopeImage', () => {
  it('uses the synchronous Qwen Image multimodal endpoint without async headers', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = String(url)
      if (urlStr.includes('/services/aigc/multimodal-generation/generation')) {
        return jsonResponse({
          output: {
            choices: [{ message: { content: [{ image: 'https://dashscope-result.oss.aliyuncs.com/qwen.png' }] } }],
          },
        })
      }
      if (urlStr === 'https://dashscope-result.oss.aliyuncs.com/qwen.png') {
        return imageResponse(imagePngBytes, 'image/png')
      }
      throw new Error(`Unexpected URL: ${urlStr}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await generateDashScopeImage({
      apiKey: 'sk-dashscope-test',
      endpoint,
      model: 'qwen-image-3.0',
      prompt: 'cyberpunk city',
      size: '1024x1024',
      maxBytes: 1024 * 1024,
      signal,
    })

    expect(result.mediaType).toBe('image/png')
    expect(result.data).toEqual(new Uint8Array(imagePngBytes))

    const [submitUrl, submitInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(submitUrl).toBe('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation')
    expect(submitInit.headers).toMatchObject({
      'content-type': 'application/json',
      authorization: 'Bearer sk-dashscope-test',
    })
    expect(submitInit.headers).not.toHaveProperty('X-DashScope-Async')
    expect(JSON.parse(submitInit.body as string)).toEqual({
      model: 'qwen-image-3.0',
      input: { messages: [{ role: 'user', content: [{ text: 'cyberpunk city' }] }] },
      parameters: { size: '1024*1024' },
    })
  })

  it('rejects non-Qwen DashScope image models before making a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateDashScopeImage({
      apiKey: 'sk-dashscope-test',
      endpoint,
      model: 'wanx2.1-t2i-turbo',
      prompt: 'test',
      maxBytes: 1024 * 1024,
      signal,
    })).rejects.toThrow('Unsupported DashScope image model wanx2.1-t2i-turbo. Configure a qwen-image model.')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a size the service would refuse, naming the accepted form', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateDashScopeImage({
      apiKey: 'sk-dashscope-test',
      endpoint,
      model: 'qwen-image-3.0',
      prompt: 'test',
      size: '1K',
      maxBytes: 1024 * 1024,
      signal,
    })).rejects.toThrow('Invalid image size "1K": use "WIDTH*HEIGHT" such as 1024*1024 or 1280*720.')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a size tier this route has no default for instead of forwarding it', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateDashScopeImage({
      apiKey: 'sk-dashscope-test',
      endpoint,
      model: 'qwen-image-3.0',
      prompt: 'test',
      size: 'auto',
      maxBytes: 1024 * 1024,
      signal,
    })).rejects.toThrow('Invalid image size "auto"')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('omits size entirely when the caller asks for the service default', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = String(url)
      if (urlStr.includes('/services/aigc/multimodal-generation/generation')) {
        return jsonResponse({ output: { choices: [{ message: { content: [{ image: 'https://dashscope-result.oss.aliyuncs.com/q.png' }] } }] } })
      }
      return imageResponse(imagePngBytes, 'image/png')
    })
    vi.stubGlobal('fetch', fetchMock)

    await generateDashScopeImage({
      apiKey: 'sk-dashscope-test',
      endpoint,
      model: 'qwen-image-2.0',
      prompt: 'keep my aspect ratio',
      maxBytes: 1024 * 1024,
      signal,
    })

    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as {
      parameters: Record<string, unknown>
    }
    expect(body.parameters).not.toHaveProperty('size')
  })

  it('honours a non-default size and normalizes every separator to an asterisk', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = String(url)
      if (urlStr.includes('/services/aigc/multimodal-generation/generation')) {
        return jsonResponse({ output: { choices: [{ message: { content: [{ image: 'https://dashscope-result.oss.aliyuncs.com/q.png' }] } }] } })
      }
      return imageResponse(imagePngBytes, 'image/png')
    })
    vi.stubGlobal('fetch', fetchMock)

    await generateDashScopeImage({
      apiKey: 'sk-dashscope-test',
      endpoint,
      model: 'qwen-image-2.0',
      prompt: 'wide shot',
      size: '1664×928',
      maxBytes: 1024 * 1024,
      signal,
    })

    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as {
      parameters: { size: string }
    }
    expect(body.parameters.size).toBe('1664*928')
  })

  it('accepts the Wan family only when the row allows it (Qwen Token Plan)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateDashScopeImage({
      apiKey: 'sk-dashscope-test',
      endpoint: 'https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1',
      model: 'wan2.7-image',
      prompt: 'test',
      maxBytes: 1024 * 1024,
      signal,
    })).rejects.toThrow('Unsupported DashScope image model wan2.7-image. Configure a qwen-image model.')
    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock.mockImplementation(async (url: string | URL | Request) => {
      const urlStr = String(url)
      if (urlStr.includes('/services/aigc/multimodal-generation/generation')) {
        return jsonResponse({ output: { choices: [{ message: { content: [{ image: 'https://dashscope-result.oss.aliyuncs.com/w.png' }] } }] } })
      }
      return imageResponse(imagePngBytes, 'image/png')
    })
    const result = await generateDashScopeImage({
      apiKey: 'sk-dashscope-test',
      endpoint: 'https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1',
      model: 'wan2.7-image',
      prompt: 'test',
      size: '1024*1024',
      maxBytes: 1024 * 1024,
      signal,
      allowWanModels: true,
    })
    expect(result.mediaType).toBe('image/png')
    expect(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[0]))
      .toBe('https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation')
  })

  it('throws upstream error on submit failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Invalid API key', { status: 401 })))

    await expect(generateDashScopeImage({
      apiKey: 'invalid-key',
      endpoint,
      model: 'qwen-image-3.0',
      prompt: 'test',
      maxBytes: 1024 * 1024,
      signal,
    })).rejects.toThrow('DashScope image generation failed (401): Invalid API key')
  })

  it('throws when the synchronous response contains no image URL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ output: { choices: [{ message: { content: [{ text: 'done' }] } }] } })))

    await expect(generateDashScopeImage({
      apiKey: 'sk-dashscope-test',
      endpoint,
      model: 'qwen-image-3.0',
      prompt: 'test',
      maxBytes: 1024 * 1024,
      signal,
    })).rejects.toThrow('DashScope image generation returned no image URL')
  })
})
