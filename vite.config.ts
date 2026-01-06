import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', 'VITE_');
    // Support multiple environment variable naming conventions for Gemini API key
    // Priority: VITE_GEMINI_API_KEY (Vite convention) > GEMINI_API_KEY (from process.env)
    const geminiKey = env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(geminiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
        '__APP_VERSION__': JSON.stringify(packageJson.version)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
