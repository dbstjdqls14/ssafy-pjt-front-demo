import { reactive } from 'vue'

// withMock()이 실제 API 대신 로컬/데모 데이터로 대체할 때마다 여기에 기록해둔다.
// 화면 어디서나 "지금 이 정보는 진짜 서버 응답이 아니에요"를 보여주기 위한
// 용도 — 이 값이 바뀌면 MockDataBanner.vue가 자동으로 반응해서 배너를 띄운다.
// key: 사람이 읽을 수 있는 한글 이름(예: '내 기록 폴더 목록'), value: 지금 그
// 데이터가 목업으로 대체된 상태인지(boolean).
export const mockStatus = reactive({})

export const setMockStatus = (label, isMock) => {
  if (!label) return
  mockStatus[label] = isMock
}
