import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'logo.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              url.hostname.endsWith('.blob.core.windows.net') && request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'azure-blob-images',
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 30,
                purgeOnQuotaError: true,
              },
            },
          },
        ],
      },
      manifest: {
        name: 'FitMate',
        short_name: 'FitMate',
        description: 'Track workouts, templates, sets, and progress.',
        theme_color: '#0e0e1a',
        background_color: '#09091a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'logo.png',
            sizes: '630x630',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@types': path.resolve(__dirname, './src/types'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@pages': path.resolve(__dirname, './src/pages'),
    }
  },
  server: {
    port: 5273,
    proxy: {
      '/api': {
        target: 'http://localhost:5265',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
