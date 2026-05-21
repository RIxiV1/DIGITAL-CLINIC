/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Stub used to short-circuit jsPDF's optional html2canvas + dompurify
// deps. We use jsPDF only for programmatic text drawing (never .html()),
// so those packages ship as ~230KB of dead lazy chunks unless we alias
// them to an empty module here. Remove these entries if you ever start
// using jsPDF.html().
const emptyStub = fileURLToPath(
  new URL('./src/app/utils/emptyStub.js', import.meta.url),
);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      html2canvas: emptyStub,
      dompurify: emptyStub,
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    // Tests don't touch the DOM (yet) — they exercise pure parsing
    // logic against text fixtures. Node env keeps startup fast.
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
