import { unwrapApiResponse } from '../response.js'

export const normalizePresentationSlide = (slide = {}, index = 0) => {
  const number = Number(slide.number ?? slide.slideNumber ?? slide.pageNumber ?? slide.order ?? index + 1)
  return {
    ...slide,
    id: slide.id ?? slide.slideId ?? slide.pageId ?? number,
    number: Number.isFinite(number) ? number : index + 1,
    title: slide.title ?? slide.name ?? slide.extractedTitle ?? `슬라이드 ${index + 1}`,
    keyPoints: slide.keyPoints ?? slide.description ?? slide.coreContent ?? slide.script ?? slide.speakerNotes ?? slide.notes ?? '',
    previewUrl: slide.previewUrl ?? slide.previewImageUrl ?? slide.imageUrl ?? slide.renderedImageUrl ?? slide.convertedImageUrl ?? slide.thumbnailUrl ?? slide.fileUrl ?? null,
    thumbnailUrl: slide.thumbnailUrl ?? slide.thumbnailImageUrl ?? slide.previewUrl ?? slide.previewImageUrl ?? slide.imageUrl ?? null,
    extractedText: slide.extractedText ?? slide.text ?? slide.content ?? '',
    excluded: Boolean(slide.excluded ?? slide.isExcluded),
  }
}

export const extractPresentationSlides = (response) => {
  const value = unwrapApiResponse(response)
  const candidates = [
    value.slides,
    value.pages,
    value.items,
    value.content,
    value.result?.slides,
    value.result?.pages,
    value.presentation?.slides,
    value.session?.slides,
  ]
  const items = candidates.find(Array.isArray) ?? []
  return items.map(normalizePresentationSlide)
}

export const mergePresentationSlides = (apiSlides = [], renderedSlides = null) => (
  apiSlides.length
    ? apiSlides.map((slide, index) => normalizePresentationSlide({
        ...(renderedSlides?.[index] ?? {}),
        ...slide,
        previewUrl: slide.previewUrl ?? renderedSlides?.[index]?.previewUrl ?? null,
        thumbnailUrl: slide.thumbnailUrl ?? renderedSlides?.[index]?.thumbnailUrl ?? null,
        extractedText: slide.extractedText || renderedSlides?.[index]?.extractedText || '',
      }, index))
    : renderedSlides ?? []
)
