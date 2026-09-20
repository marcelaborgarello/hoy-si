import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Separar firebase en su propio chunk para mejor caching
          if (id.includes('firebase')) {
            return 'firebase-vendor'
          }
        },
      },
    },
  },
})
