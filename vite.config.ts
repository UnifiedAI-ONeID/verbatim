import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  build: {
    commonjsOptions: {
      include: ['node_modules', 'src']
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [
    react({
      jsxRuntime: 'automatic'
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
