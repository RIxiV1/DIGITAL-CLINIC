/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
