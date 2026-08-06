import { mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import PresentationReportVideoPanel from '../../../src/components/presentation-report/PresentationReportVideoPanel.vue'
import { usePresentationReportVideo } from '../../../src/composables/usePresentationReportVideo.js'

const slides = [
  {
    slideId: 101,
    slideNumber: 1,
    startTimeSec: 0,
    endTimeSec: 12,
    durationSec: 12,
    transcriptSegments: [{ text: '첫 번째 발표', startSec: 0, endSec: 2 }],
  },
  {
    slideId: 102,
    slideNumber: 2,
    startTimeSec: 12,
    endTimeSec: 22,
    durationSec: 10,
    transcriptSegments: [{ text: '두 번째 발표', startSec: 12, endSec: 14 }],
  },
]

describe('presentation report video synchronization', () => {
  it('resets playback state when the report media identity changes', async () => {
    const selectedIndex = ref(1)
    const controller = usePresentationReportVideo({
      slides: computed(() => slides),
      selectedIndex,
    })
    const wrapper = mount(PresentationReportVideoPanel, {
      props: {
        slides,
        selectedIndex: 1,
        videoUrl: 'https://example.com/report-12.webm',
        mediaKey: '12:120:report-12',
        controller,
      },
    })
    const previousVideoElement = controller.videoEl.value
    controller.onTimeUpdate({ target: { currentTime: 14 } })
    controller.onPlay()

    await wrapper.setProps({
      selectedIndex: 0,
      videoUrl: 'https://example.com/report-13.webm',
      mediaKey: '13:130:report-13',
    })

    expect(controller.absoluteSec.value).toBe(0)
    expect(controller.isPlaying.value).toBe(false)
    expect(controller.videoEl.value).not.toBe(previousVideoElement)
    expect(controller.videoEl.value.getAttribute('src')).toBe('https://example.com/report-13.webm')
  })

  it('seeks to a selected slide and follows video time within contiguous slide ranges', () => {
    const selectedIndex = ref(0)
    const controller = usePresentationReportVideo({
      slides: computed(() => slides),
      selectedIndex,
    })
    const video = { currentTime: 0, paused: true, play: vi.fn(), pause: vi.fn() }
    controller.setVideoElement(video)

    controller.selectSlide(1)
    expect(selectedIndex.value).toBe(1)
    expect(video.currentTime).toBe(12)

    controller.onTimeUpdate({ target: { currentTime: 4 } })
    expect(selectedIndex.value).toBe(0)
    expect(controller.localSec.value).toBe(4)
  })

  it('delegates thumbnail selection to the presentation controller', async () => {
    const controller = {
      setVideoElement: vi.fn(),
      selectSlide: vi.fn(),
      togglePlay: vi.fn(),
      onTimeUpdate: vi.fn(),
      scrubFromPointer: vi.fn(),
      absoluteSec: ref(0),
      isPlaying: ref(false),
    }
    const wrapper = mount(PresentationReportVideoPanel, {
      props: {
        slides,
        selectedIndex: 0,
        videoUrl: '',
        controller,
      },
    })

    await wrapper.get('[data-slide-thumbnail="1"]').trigger('click')
    expect(controller.selectSlide).toHaveBeenCalledWith(1)
  })

  it('disables thumbnails for slides without presentation data', async () => {
    const controller = {
      setVideoElement: vi.fn(),
      selectSlide: vi.fn(),
      togglePlay: vi.fn(),
      onTimeUpdate: vi.fn(),
      scrubFromPointer: vi.fn(),
      absoluteSec: ref(0),
      isPlaying: ref(false),
    }
    const slidesWithSkippedSlide = [
      slides[0],
      { ...slides[1], transcriptSegments: [], speech: null },
    ]
    const wrapper = mount(PresentationReportVideoPanel, {
      props: {
        slides: slidesWithSkippedSlide,
        selectedIndex: 0,
        videoUrl: '',
        controller,
      },
    })

    const skippedThumbnail = wrapper.get('[data-slide-thumbnail="1"]')
    expect(skippedThumbnail.attributes('disabled')).toBeDefined()
    await skippedThumbnail.trigger('click')
    expect(controller.selectSlide).not.toHaveBeenCalled()
  })

  it('seeks to a caption only when the API supplied an absolute timestamp', async () => {
    const seekAbsolute = vi.fn()
    const controller = {
      setVideoElement: vi.fn(),
      selectSlide: vi.fn(),
      seekAbsolute,
      togglePlay: vi.fn(),
      onTimeUpdate: vi.fn(),
      absoluteSec: ref(3.5),
      totalDurationSec: ref(12),
      progressPct: ref(29),
      isPlaying: ref(false),
    }
    const wrapper = mount(PresentationReportVideoPanel, {
      props: {
        slides: [{
          ...slides[0],
          transcriptSegments: [{
            text: 'timestamped caption',
            absoluteStartSec: 3.5,
            absoluteEndSec: 5,
            isTimestamped: true,
          }],
        }],
        selectedIndex: 0,
        videoUrl: '',
        controller,
      },
    })

    await wrapper.get('[data-caption-seek]').trigger('click')
    expect(seekAbsolute).toHaveBeenCalledWith(3.5)
  })

  it('does not make a synthetic presentation caption seekable', () => {
    const controller = {
      setVideoElement: vi.fn(),
      selectSlide: vi.fn(),
      seekAbsolute: vi.fn(),
      togglePlay: vi.fn(),
      onTimeUpdate: vi.fn(),
      absoluteSec: ref(0),
      totalDurationSec: ref(12),
      progressPct: ref(0),
      isPlaying: ref(false),
    }
    const wrapper = mount(PresentationReportVideoPanel, {
      props: { slides, selectedIndex: 0, videoUrl: '', controller },
    })

    expect(wrapper.find('[data-caption-seek]').exists()).toBe(false)
  })
})
