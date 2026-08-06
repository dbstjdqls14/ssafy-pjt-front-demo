import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    // 개발 중 프론트는 same-origin `/api/*`로 호출하고, Vite가 배포 백엔드로
    // 전달한다. 이렇게 하면 CORS와 (배포서버가 http라 생기는) mixed-content를
    // 한 번에 피할 수 있다. 배포 주소가 바뀌면 target만 교체.
    proxy: {
      '/api': {
        target: 'http://i15B109.p.ssafy.io',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    restoreMocks: true,
  },
})
