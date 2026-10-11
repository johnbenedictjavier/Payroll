import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

const base = process.env.GITHUB_ACTIONS === 'true' ? '/Payroll/' : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'LCC Payroll Management System',
        short_name: 'LCC Payroll',
        description: 'Secure payroll management for administrators and employees',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        display: 'standalone',
        scope: base,
        start_url: `${base}login`,
        icons: [
          { src: `${base}favicon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{js,css,html,svg,ico,png,woff2}'],
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
