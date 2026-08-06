// 업로드한 발표 자료(PDF)를 브라우저에서 직접 슬라이드 이미지로 렌더링한다.
// 백엔드 슬라이드 변환이 없을 때 실제 업로드 자료를 미리보기로 보여주기 위한 용도.
// PPTX는 브라우저에서 안정적으로 렌더할 방법이 없어 지원하지 않는다(호출부에서 폴백).
//
// pdfjs(약 480KB)는 실제 PDF 업로드 시에만 필요하므로 동적 import로 지연 로드한다 —
// 발표 플로우 진입만으로 번들이 커지지 않게.
let pdfjsPromise = null
const loadPdfjs = async () => {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjsLib = await import('pdfjs-dist')
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
      return pdfjsLib
    })()
  }
  return pdfjsPromise
}

// 한 페이지 = 한 슬라이드. 각 페이지를 캔버스에 그린 뒤 JPEG data URL로 만든다.
export const renderPdfToSlides = async (file, { scale = 1.6, quality = 0.82 } = {}) => {
  const pdfjsLib = await loadPdfjs()
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  try {
    const slides = []
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
      const canvasContext = canvas.getContext('2d')
      await page.render({ canvasContext, viewport }).promise
      slides.push({
        id: pageNo,
        number: pageNo,
        title: `슬라이드 ${pageNo}`,
        keyPoints: '',
        previewUrl: canvas.toDataURL('image/jpeg', quality),
        extractedText: '',
        excluded: false,
      })
      page.cleanup()
    }
    return slides
  } finally {
    pdf.destroy()
  }
}
