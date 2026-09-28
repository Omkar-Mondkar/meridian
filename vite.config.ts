import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  // Prevent Vite from scanning the legacy HTML demo as an entry point
  optimizeDeps: {
    entries: ['src/main.tsx'],
  },
})
