const ZIP_LOCAL_FILE_HEADER = 0x04034b50
const ZIP_CENTRAL_FILE_HEADER = 0x02014b50
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50
const DEFAULT_SLIDE_WIDTH = 12192000
const DEFAULT_SLIDE_HEIGHT = 6858000

const decoder = new TextDecoder('utf-8')

const xmlEscape = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

const normalizeZipPath = (path) => {
  const result = []
  String(path).replaceAll('\\', '/').split('/').forEach((part) => {
    if (!part || part === '.') return
    if (part === '..') result.pop()
    else result.push(part)
  })
  return result.join('/')
}

const resolveRelationshipTarget = (ownerPath, target) => {
  if (/^[a-z]+:/i.test(target)) return target
  const directory = ownerPath.slice(0, ownerPath.lastIndexOf('/') + 1)
  return normalizeZipPath(`${directory}${target}`)
}

const findEndOfCentralDirectory = (bytes, view) => {
  const minimumOffset = Math.max(0, bytes.length - 0xffff - 22)
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_END_OF_CENTRAL_DIRECTORY) return offset
  }
  throw new Error('PPTX 압축 구조를 읽지 못했습니다.')
}

const inflateRaw = async (bytes) => {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('이 브라우저에서는 PPTX 로컬 변환을 지원하지 않습니다. Chrome 또는 Edge 최신 버전을 이용해 주세요.')
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const readZipEntries = async (file) => {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const endOffset = findEndOfCentralDirectory(bytes, view)
  const entryCount = view.getUint16(endOffset + 10, true)
  let centralOffset = view.getUint32(endOffset + 16, true)
  const records = []

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(centralOffset, true) !== ZIP_CENTRAL_FILE_HEADER) {
      throw new Error('PPTX 파일 목록이 손상되었습니다.')
    }
    const compressionMethod = view.getUint16(centralOffset + 10, true)
    const compressedSize = view.getUint32(centralOffset + 20, true)
    const fileNameLength = view.getUint16(centralOffset + 28, true)
    const extraLength = view.getUint16(centralOffset + 30, true)
    const commentLength = view.getUint16(centralOffset + 32, true)
    const localHeaderOffset = view.getUint32(centralOffset + 42, true)
    const nameStart = centralOffset + 46
    const name = normalizeZipPath(decoder.decode(bytes.subarray(nameStart, nameStart + fileNameLength)))
    records.push({ name, compressionMethod, compressedSize, localHeaderOffset })
    centralOffset = nameStart + fileNameLength + extraLength + commentLength
  }

  const entries = new Map()
  await Promise.all(records.map(async (record) => {
    const { localHeaderOffset, compressedSize, compressionMethod, name } = record
    if (view.getUint32(localHeaderOffset, true) !== ZIP_LOCAL_FILE_HEADER) return
    const fileNameLength = view.getUint16(localHeaderOffset + 26, true)
    const extraLength = view.getUint16(localHeaderOffset + 28, true)
    const dataStart = localHeaderOffset + 30 + fileNameLength + extraLength
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize)
    if (compressionMethod === 0) entries.set(name, compressed.slice())
    else if (compressionMethod === 8) entries.set(name, await inflateRaw(compressed))
  }))
  return entries
}

const parseXml = (entries, path) => {
  const bytes = entries.get(normalizeZipPath(path))
  if (!bytes) return null
  const document = new DOMParser().parseFromString(decoder.decode(bytes), 'application/xml')
  if (document.getElementsByTagName('parsererror').length) return null
  return document
}

const descendants = (node, localName) => Array.from(node?.getElementsByTagName('*') ?? [])
  .filter((element) => element.localName === localName)

const firstDescendant = (node, localName) => descendants(node, localName)[0] ?? null

const directChild = (node, localName) => Array.from(node?.children ?? [])
  .find((element) => element.localName === localName) ?? null

const readRelationships = (entries, ownerPath) => {
  const slash = ownerPath.lastIndexOf('/')
  const relationshipPath = `${ownerPath.slice(0, slash + 1)}_rels/${ownerPath.slice(slash + 1)}.rels`
  const document = parseXml(entries, relationshipPath)
  const relationships = new Map()
  descendants(document, 'Relationship').forEach((relationship) => {
    if (relationship.getAttribute('TargetMode') === 'External') return
    relationships.set(
      relationship.getAttribute('Id'),
      resolveRelationshipTarget(ownerPath, relationship.getAttribute('Target') ?? ''),
    )
  })
  return relationships
}

const getRelationshipId = (element, attribute = 'embed') => {
  const namespaced = element?.getAttributeNS?.('http://schemas.openxmlformats.org/officeDocument/2006/relationships', attribute)
  return namespaced || element?.getAttribute?.(`r:${attribute}`) || element?.getAttribute?.(attribute) || null
}

const slideOrder = (entries) => {
  const presentationPath = 'ppt/presentation.xml'
  const presentation = parseXml(entries, presentationPath)
  const relationships = readRelationships(entries, presentationPath)
  const ordered = descendants(presentation, 'sldId')
    .map((element) => relationships.get(getRelationshipId(element, 'id')))
    .filter((path) => path && entries.has(path))

  if (ordered.length) return ordered
  return Array.from(entries.keys())
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1]) - Number(b.match(/slide(\d+)/i)?.[1]))
}

const slideSize = (entries) => {
  const document = parseXml(entries, 'ppt/presentation.xml')
  const size = firstDescendant(document, 'sldSz')
  return {
    width: Number(size?.getAttribute('cx')) || DEFAULT_SLIDE_WIDTH,
    height: Number(size?.getAttribute('cy')) || DEFAULT_SLIDE_HEIGHT,
  }
}

const SCHEME_COLORS = {
  dk1: '1f2937', lt1: 'ffffff', dk2: '334155', lt2: 'f8fafc',
  accent1: '6366f1', accent2: '8b5cf6', accent3: '06b6d4',
  accent4: '22c55e', accent5: 'f59e0b', accent6: 'ef4444',
  hlink: '2563eb', folHlink: '7c3aed',
}

const readColor = (node, fallback = null) => {
  const solidFill = firstDescendant(node, 'solidFill')
  if (!solidFill) return fallback
  const rgb = firstDescendant(solidFill, 'srgbClr')?.getAttribute('val')
  const scheme = firstDescendant(solidFill, 'schemeClr')?.getAttribute('val')
  return rgb ? `#${rgb}` : scheme ? `#${SCHEME_COLORS[scheme] ?? SCHEME_COLORS.dk1}` : fallback
}

const readTransform = (node, size) => {
  const transform = firstDescendant(node, 'xfrm')
  const offset = directChild(transform, 'off')
  const extent = directChild(transform, 'ext')
  if (offset && extent) {
    return {
      x: Number(offset.getAttribute('x')) || 0,
      y: Number(offset.getAttribute('y')) || 0,
      width: Number(extent.getAttribute('cx')) || size.width,
      height: Number(extent.getAttribute('cy')) || size.height,
    }
  }

  const placeholderType = firstDescendant(node, 'ph')?.getAttribute('type')
  if (placeholderType === 'title' || placeholderType === 'ctrTitle') {
    return { x: size.width * 0.08, y: size.height * 0.08, width: size.width * 0.84, height: size.height * 0.18 }
  }
  if (placeholderType === 'subTitle') {
    return { x: size.width * 0.12, y: size.height * 0.32, width: size.width * 0.76, height: size.height * 0.22 }
  }
  return { x: size.width * 0.08, y: size.height * 0.28, width: size.width * 0.84, height: size.height * 0.58 }
}

const bytesToDataUrl = (bytes, path) => {
  const extension = path.split('.').pop()?.toLowerCase()
  const mime = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff',
  }[extension] ?? 'application/octet-stream'
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return `data:${mime};base64,${btoa(binary)}`
}

const createSvgPreviewUrl = (svg) => {
  if (typeof URL?.createObjectURL === 'function') {
    return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const renderPicture = (element, size, relationships, entries) => {
  const blip = firstDescendant(element, 'blip')
  const mediaPath = relationships.get(getRelationshipId(blip))
  const media = mediaPath ? entries.get(mediaPath) : null
  if (!media) return ''
  const frame = readTransform(element, size)
  return `<image x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" preserveAspectRatio="none" href="${bytesToDataUrl(media, mediaPath)}"/>`
}

const renderShape = (element, size) => {
  const frame = readTransform(element, size)
  const shapeProperties = directChild(element, 'spPr')
  const fill = readColor(shapeProperties)
  const lineElement = firstDescendant(shapeProperties, 'ln')
  const line = readColor(lineElement, 'none')
  const radius = firstDescendant(shapeProperties, 'prstGeom')?.getAttribute('prst') === 'roundRect'
    ? Math.min(frame.width, frame.height) * 0.08
    : 0
  const background = fill
    ? `<rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="${radius}" fill="${fill}" stroke="${line}"/>`
    : ''

  const paragraphs = descendants(element, 'p').filter((paragraph) => descendants(paragraph, 't').length)
  if (!paragraphs.length) return background
  const marginX = Math.max(size.width * 0.006, 30000)
  let cursorY = frame.y + Math.max(size.height * 0.025, 120000)
  const text = paragraphs.map((paragraph) => {
    const runs = descendants(paragraph, 't').map((node) => node.textContent ?? '').join('')
    if (!runs.trim()) return ''
    const properties = firstDescendant(paragraph, 'rPr') || firstDescendant(paragraph, 'defRPr')
    const fontSize = Math.max(14, (Number(properties?.getAttribute('sz')) || 2000) / 100)
    const fontSizeEmu = fontSize * 12700
    cursorY += fontSizeEmu * 1.15
    const alignment = firstDescendant(paragraph, 'pPr')?.getAttribute('algn')
    const anchor = alignment === 'ctr' ? 'middle' : alignment === 'r' ? 'end' : 'start'
    const x = anchor === 'middle' ? frame.x + frame.width / 2 : anchor === 'end' ? frame.x + frame.width - marginX : frame.x + marginX
    const color = readColor(properties, '#1f2937')
    const weight = properties?.getAttribute('b') === '1' ? '700' : '400'
    return `<text x="${x}" y="${cursorY}" fill="${color}" font-family="Arial, sans-serif" font-size="${fontSizeEmu}" font-weight="${weight}" text-anchor="${anchor}">${xmlEscape(runs)}</text>`
  }).join('')
  return `${background}${text}`
}

const renderSlide = (entries, slidePath, size, index) => {
  const document = parseXml(entries, slidePath)
  if (!document) throw new Error(`${index + 1}번 슬라이드 내용을 읽지 못했습니다.`)
  const relationships = readRelationships(entries, slidePath)
  const background = readColor(firstDescendant(document, 'bg'), '#ffffff')
  const shapeTree = firstDescendant(document, 'spTree')
  const elements = Array.from(shapeTree?.children ?? []).map((element) => {
    if (element.localName === 'pic') return renderPicture(element, size, relationships, entries)
    if (element.localName === 'sp') return renderShape(element, size)
    return ''
  }).join('')
  const text = descendants(document, 't').map((node) => node.textContent?.trim()).filter(Boolean)
  const title = text[0] || `슬라이드 ${index + 1}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${size.width} ${size.height}" width="1280" height="720"><rect width="100%" height="100%" fill="${background}"/>${elements}</svg>`
  // Blob URLs keep large embedded images out of Vue's reactive strings and
  // prevent big PPTX files from exhausting the renderer process memory.
  const previewUrl = createSvgPreviewUrl(svg)
  return {
    id: index + 1,
    number: index + 1,
    title,
    keyPoints: '',
    previewUrl,
    thumbnailUrl: previewUrl,
    extractedText: text.join('\n'),
    excluded: false,
    previewSource: 'local-pptx',
  }
}

// Backend-rendered images remain the source of truth. This lightweight browser
// renderer only unblocks the setup flow while that endpoint is unavailable.
export const renderPptxToSlides = async (file) => {
  const entries = await readZipEntries(file)
  const paths = slideOrder(entries)
  if (!paths.length) throw new Error('PPTX에서 슬라이드를 찾지 못했습니다.')
  const size = slideSize(entries)
  return paths.map((path, index) => renderSlide(entries, path, size, index))
}
