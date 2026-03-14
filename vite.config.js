import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // ← เปิดให้มือถือเข้าได้
    proxy: {
      '/glo-api': {
        target: 'https://www.glo.or.th',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/glo-api/, ''),
      }
    }
  }
})