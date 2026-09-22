import { describe, expect, it } from 'vitest'
import {
  ALIBABA_EDIT_SIZE_RANGE,
  ALIBABA_RATIO_SIZES,
  alibabaAspectSize,
  alibabaEditSize,
  sizeMismatch,
} from '../src/shared.js'

describe('alibabaEditSize', () => {
  it('returns the reference dimensions when they sit inside the documented window', () => {
    expect(alibabaEditSize([{ width: 1280, height: 960 }], 'qwen-image-2.0')).toBe('1280*960')
    expect(alibabaEditSize([{ width: 512, height: 512 }], 'qwen-image-2.0')).toBe('512*512')
    expect(alibabaEditSize([{ width: 2048, height: 2048 }], 'qwen-image-3.0')).toBe('2048*2048')
  })

  it('rejects one pixel outside either end of the documented total-pixel window', () => {
    const { minTotalPixels, maxTotalPixels } = ALIBABA_EDIT_SIZE_RANGE
    expect(minTotalPixels).toBe(512 * 512)
    expect(maxTotalPixels).toBe(2048 * 2048)
    expect(alibabaEditSize([{ width: 512, height: 511 }], 'qwen-image-2.0')).toBeUndefined()
    expect(alibabaEditSize([{ width: 2049, height: 2048 }], 'qwen-image-2.0')).toBeUndefined()
  })

  it("follows the last reference image, matching the service's multi-image rule", () => {
    expect(alibabaEditSize([
      { width: 512, height: 512 },
      { width: 1536, height: 1024 },
    ], 'qwen-image-2.0')).toBe('1536*1024')
  })

  it('leaves size unset outside the window so the service keeps the input aspect ratio', () => {
    expect(alibabaEditSize([{ width: 4096, height: 4096 }], 'qwen-image-2.0')).toBeUndefined()
    expect(alibabaEditSize([{ width: 256, height: 256 }], 'qwen-image-2.0')).toBeUndefined()
  })

  it('leaves size unset when the reference carries no usable dimensions', () => {
    expect(alibabaEditSize([], 'qwen-image-2.0')).toBeUndefined()
    expect(alibabaEditSize([{ width: 1280 }], 'qwen-image-2.0')).toBeUndefined()
    expect(alibabaEditSize([{ width: 0, height: 0 }], 'qwen-image-2.0')).toBeUndefined()
    expect(alibabaEditSize([{ width: 1280.5, height: 960 }], 'qwen-image-2.0')).toBeUndefined()
  })

  it('never guesses a size for the Wan family, whose window this route does not document', () => {
    expect(alibabaEditSize([{ width: 1280, height: 960 }], 'wan2.7-image')).toBeUndefined()
    expect(alibabaEditSize([{ width: 1280, height: 960 }], 'WAN2.7-IMAGE-PRO')).toBeUndefined()
  })
})

describe('alibabaAspectSize', () => {
  it('maps every ratio the tools accept onto a documented resolution', () => {
    expect(alibabaAspectSize('1:1')).toBe('1024*1024')
    expect(alibabaAspectSize('16:9')).toBe('1280*720')
    expect(alibabaAspectSize('9:16')).toBe('720*1280')
    expect(alibabaAspectSize('3:2')).toBe('1152*768')
    expect(alibabaAspectSize('2:3')).toBe('768*1152')
    expect(alibabaAspectSize('4:3')).toBe('1280*960')
    expect(alibabaAspectSize('3:4')).toBe('960*1280')
  })

  it('keeps every mapped resolution inside the route pixel window', () => {
    const { minTotalPixels, maxTotalPixels } = ALIBABA_EDIT_SIZE_RANGE
    for (const [ratio, size] of Object.entries(ALIBABA_RATIO_SIZES)) {
      const [width, height] = size.split('*').map(Number)
      const totalPixels = (width ?? 0) * (height ?? 0)
      expect(totalPixels, ratio).toBeGreaterThanOrEqual(minTotalPixels)
      expect(totalPixels, ratio).toBeLessThanOrEqual(maxTotalPixels)
    }
  })

  it('does nothing when the caller asked for no ratio', () => {
    expect(alibabaAspectSize(undefined)).toBeUndefined()
    expect(alibabaAspectSize('   ')).toBeUndefined()
  })

  it('refuses a ratio the table does not cover instead of returning a surprise shape', () => {
    expect(() => alibabaAspectSize('21:9')).toThrow('Unsupported aspect_ratio "21:9" for the Alibaba rows')
  })
})

describe('sizeMismatch', () => {
  it('accepts the service rounding an explicit size to a nearby multiple of 16', () => {
    expect(sizeMismatch('1280*720', { width: 1280, height: 720 })).toBeUndefined()
    expect(sizeMismatch('1280*720', { width: 1288, height: 712 })).toBeUndefined()
    expect(sizeMismatch('1024x1024', { width: 1024, height: 1024 })).toBeUndefined()
  })

  it('reports a provider that returned a different shape than requested', () => {
    // The failure this exists for: asked for 16:9, got the square default.
    expect(sizeMismatch('1280*720', { width: 1024, height: 1024 }))
      .toBe('the requested size was 1280*720 but the provider returned 1024×1024, so the upstream ignored or altered it.')
    // Exactly at the rounding tolerance is accepted; past it is reported.
    expect(sizeMismatch('1280*720', { width: 1280, height: 704 })).toBeUndefined()
    expect(sizeMismatch('1280*720', { width: 1280, height: 688 })).toBeDefined()
  })

  it('stays quiet when the label carries no concrete pixel size', () => {
    expect(sizeMismatch('2K', { width: 2048, height: 2048 })).toBeUndefined()
    expect(sizeMismatch('16:9, 2K', { width: 1024, height: 1024 })).toBeUndefined()
  })
})