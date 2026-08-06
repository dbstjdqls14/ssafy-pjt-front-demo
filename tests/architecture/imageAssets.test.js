import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()

const imagePath = (relativePath) => resolve(projectRoot, relativePath)

const readPngDimensions = (buffer) => {
  const pngSignature = '89504e470d0a1a0a'
  if (buffer.subarray(0, 8).toString('hex') !== pngSignature) {
    throw new Error('Invalid PNG signature')
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

const jpegStartOfFrameMarkers = new Set([
  0xc0,
  0xc1,
  0xc2,
  0xc3,
  0xc5,
  0xc6,
  0xc7,
  0xc9,
  0xca,
  0xcb,
  0xcd,
  0xce,
  0xcf,
])

const readJpegDimensions = (buffer) => {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error('Invalid JPEG signature')
  }

  let offset = 2
  while (offset < buffer.length) {
    while (buffer[offset] === 0xff) offset += 1

    const marker = buffer[offset]
    offset += 1

    if (jpegStartOfFrameMarkers.has(marker)) {
      return {
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3),
      }
    }

    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue
    }

    const segmentLength = buffer.readUInt16BE(offset)
    offset += segmentLength
  }

  throw new Error('JPEG dimensions not found')
}

const readImageDimensions = (relativePath) => {
  const buffer = readFileSync(imagePath(relativePath))
  return relativePath.endsWith('.png') ? readPngDimensions(buffer) : readJpegDimensions(buffer)
}

describe('frontend image asset budget', () => {
  it.each(['1', '2', '3'])('keeps interviewer %s sharp at DPR 3 without oversized sources', (id) => {
    expect(readImageDimensions(`public/interviewers/${id}.jpg`)).toEqual({ width: 384, height: 384 })
  })

  it('bounds practice illustrations to their DPR 3 render size', () => {
    expect(readImageDimensions('src/assets/images/practice-interview-illustration.png')).toEqual({
      width: 600,
      height: 413,
    })
    expect(readImageDimensions('src/assets/images/practice-presentation-illustration.png')).toEqual({
      width: 456,
      height: 515,
    })
  })

  it('keeps the public social image at the optimized sharing size', () => {
    expect(readImageDimensions('public/home-presenter.png')).toEqual({ width: 1200, height: 675 })

    const html = readFileSync(`${projectRoot}/index.html`, 'utf8')
    expect(html).toContain('property="og:image" content="https://aivo.ai.kr/home-presenter.png"')
    expect(html).toContain('name="twitter:image" content="https://aivo.ai.kr/home-presenter.png"')
  })

  it('does not ship obsolete duplicate image files', () => {
    const obsoletePaths = [
      'public/interviewers/1.png',
      'public/interviewers/2.png',
      'public/interviewers/3.png',
      'src/assets/images/home-interview-persona.png',
    ]

    for (const relativePath of obsoletePaths) {
      expect(existsSync(imagePath(relativePath)), relativePath).toBe(false)
    }
  })
})
