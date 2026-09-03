import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // generateSW: Workbox genera el SW completo como script clásico (no módulo ES).
      // Esto funciona en todos los browsers incluyendo iOS Safari y Android Chrome.
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Rutina — Seguimiento de hábitos',
        short_name: 'Rutina',
        description: 'App de seguimiento de hábitos y gestión del tiempo',
        theme_color: '#0B1120',
        background_color: '#0B1120',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Precaché de todos los assets estáticos del build
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Rutas de navegación SPA → siempre servir index.html desde caché
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        // Estrategia NetworkFirst para llamadas a la API:
        // intenta la red primero; si falla, usa la caché.
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 horas
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    allowedHosts: true,
    historyApiFallback: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
