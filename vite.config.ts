import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          mdxeditor: ['@mdxeditor/editor']
        }
      }
    }
  },
  test: {
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/vite-env.d.ts']
    },
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts'
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['jot-down.svg'],
      manifest: {
        name: 'Jot Down',
        short_name: 'Jot Down',
        description: 'Local-first Markdown notes with checkable tasks.',
        theme_color: '#f4f0e8',
        background_color: '#f4f0e8',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/jot-down.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,png,webmanifest}']
      }
    })
  ]
});
