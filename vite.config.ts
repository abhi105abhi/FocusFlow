import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,ico}'],
        navigateFallbackDenylist: [/^\/api/]
      },
      manifest: {
        name: 'FocusFlow: ADHD Manager',
        short_name: 'FocusFlow',
        description: 'A neurodivergent-optimized task management application.',
        theme_color: '#F5F7F6',
        background_color: '#F5F7F6',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        start_url: '/',
        orientation: 'portrait',
        protocol_handlers: [
          {
            protocol: 'web+focus',
            url: '/?action=focus'
          },
          {
            protocol: 'web+dump',
            url: '/?action=dump'
          }
        ],
        share_target: {
          action: '/?action=share',
          method: 'GET',
          enctype: 'application/x-www-form-urlencoded',
          params: {
            title: 'title',
            text: 'text',
            url: 'url'
          }
        },
        shortcuts: [
          {
            name: "Focus Mode",
            short_name: "Focus",
            description: "Go to focus mode",
            url: "/?action=focus",
            icons: [{ src: "/icon.svg", sizes: "192x192" }]
          },
          {
            name: "Capture Task",
            short_name: "Capture",
            description: "Quickly dump a thought",
            url: "/?action=dump",
            icons: [{ src: "/icon.svg", sizes: "192x192" }]
          }
        ],
        icons: [
          {
            src: '/icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'maskable'
          },
          {
            src: '/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      }
    })
  ]
});
