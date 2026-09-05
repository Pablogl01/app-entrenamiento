import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA({
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',
    registerType: 'autoUpdate',
    injectManifest: {
      // Precache completo: fuentes y fotos de ejercicio incluidas. La app arranca sin red.
      globPatterns: ['**/*.{js,css,html,woff2,webp,svg,png}'],
      maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
    },
    manifest: {
      name: 'Entrenamiento',
      short_name: 'Entreno',
      description: 'Registro de entrenamiento y peso corporal',
      lang: 'es',
      display: 'standalone',
      start_url: '/',
      background_color: '#121315',
      theme_color: '#121315',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
  }), cloudflare()],
  server: {
    // IP explícita: `localhost` puede resolver a ::1 y caer en otro proceso; wrangler dev escucha en 127.0.0.1.
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
})