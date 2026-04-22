import { defineConfig } from 'vite';

export default defineConfig({
  root: '.', // O index.html está na raiz
  build: {
    outDir: 'dist',
    target: 'esnext'
  },
  server: {
    port: 3000,
    open: false
  }
});
