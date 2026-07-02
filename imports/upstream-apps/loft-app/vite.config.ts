import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  envDir: __dirname,
  envPrefix: 'VITE_',

  server: {
    port: 8082,
    host: '0.0.0.0',
    strictPort: true,
  },

  preview: {
    port: 8082,
    host: '0.0.0.0',
  },

  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
