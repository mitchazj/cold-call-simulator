import { defineConfig } from 'vite';

// Relative base so the build works at https://<user>.github.io/<repo>/ (GitHub Pages)
// as well as at a domain root.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2500 },
});
