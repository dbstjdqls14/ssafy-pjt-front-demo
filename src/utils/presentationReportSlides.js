export const hasPresentationSlideData = (slide) => (
  (slide?.transcriptSegments?.length ?? 0) > 0
  || (slide?.speech?.buckets?.length ?? 0) > 0
)

export const isUnmeasuredPresentationSlide = (slide) => !hasPresentationSlideData(slide)
