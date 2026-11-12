import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    host: '0.0.0.0',
    proxy: { '/api': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001', changeOrigin: true } },
  },
  build: { outDir: 'dist', sourcemap: false, target: ['chrome87', 'edge88', 'firefox78', 'safari14'] },
});
