import { defineConfig } from 'vite';

export default defineConfig({
  base: '/phager20/',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'es2020',
  },
});
