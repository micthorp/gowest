import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/.amplify': 'http://localhost:3000'
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
