/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Stub used to short-circuit jsPDF's optional html2canvas + dompurify +
// canvg deps. We use jsPDF only for programmatic text drawing (never
// .html(), and no SVG/addSvgAsImage — verified in reportPdf.ts), so those
// packages ship as dead lazy chunks (html2canvas/dompurify ~230KB, canvg
// + its core-js ~160KB) unless we alias them to an empty module here.
// Remove the relevant entry if you ever start using jsPDF.html() or its
// SVG rendering.
const emptyStub = fileURLToPath(
  new URL('./src/app/utils/emptyStub.js', import.meta.url),
);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Offline support. The whole point of the product — on-device parsing,
    // reports in localStorage — already works without a network; the missing
    // piece was the app SHELL not loading offline. This precaches the built
    // shell so a user on a train (India-first, intermittent connectivity) can
    // reopen the app and read their locally-stored reports with no signal.
    VitePWA({
      // A new deploy silently takes over on the next load — no update prompt,
      // and (with cleanupOutdatedCaches) no stale-version footgun.
      registerType: 'autoUpdate',
      // We call registerSW() ourselves from main.tsx (bundled, same-origin).
      // An injected INLINE registration script would be blocked by the strict
      // CSP (script-src 'self', no unsafe-inline) — same reason the app injects
      // its JSON-LD from a module instead of inline.
      injectRegister: false,
      // Keep the hand-authored public/manifest.webmanifest; don't generate a
      // second, competing manifest.
      manifest: false,
      workbox: {
        // Precache the app shell (hashed build output) only. Deliberately
        // EXCLUDE the ~16 MB vendored OCR/pdf runtime (public/tesseract,
        // public/cmaps) — far too large to precache; it's runtime-cached on
        // first use instead (below), which is enough to re-parse offline.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2,json}'],
        globIgnores: ['**/tesseract/**', '**/cmaps/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // Offline SPA navigations serve the shell; never hijack the Gemini
        // fallback endpoint.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Tesseract worker/core/lang + pdf.js cmaps: cache-first, so the
            // second parse (and any offline re-parse) needs no network.
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/tesseract/') ||
              url.pathname.startsWith('/cmaps/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-runtime',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      html2canvas: emptyStub,
      dompurify: emptyStub,
      canvg: emptyStub,
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Hoist the large, rarely-changing vendor libs out of the main
        // entry chunk into their own cacheable chunks. Effects:
        //   - returning users skip re-downloading ~300KB of react +
        //     framer-motion on every app-code deploy (the vendor hash is
        //     stable across our frequent UI changes)
        //   - the browser fetches the split chunks in parallel
        //   - clears Vite's >500KB main-chunk warning
        // Deliberately ONLY hoists react-family + framer-motion. Everything
        // else (incl. the dynamically-imported pdfjs / tesseract.js / jspdf)
        // is left to Rollup's default splitting, so those heavy libs stay
        // in their own async chunks and never get pulled into an eager
        // vendor bundle.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          const p = id.replace(/\\/g, '/');
          if (
            p.includes('/framer-motion/') ||
            p.includes('/motion-dom/') ||
            p.includes('/motion-utils/')
          ) {
            return 'motion';
          }
          if (
            p.includes('/react-router') ||
            p.includes('/@remix-run/') ||
            p.includes('/react-dom/') ||
            p.includes('/react/') ||
            p.includes('/scheduler/') ||
            p.includes('/react-is/')
          ) {
            return 'react-vendor';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    // Default environment is 'node' for fast pure-logic tests.
    // Files that need DOM rendering opt in via the file-level pragma:
    //   // @vitest-environment jsdom
    // at the top of the test file. See pages.smoke.test.tsx.
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    // pdfjs/tesseract dynamic imports would otherwise resolve their
    // worker URLs at test time and crash. Excluding their package
    // names from the resolve graph keeps them out of pure-logic tests.
    server: {
      deps: {
        inline: [],
      },
    },
  },
});
