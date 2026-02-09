import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import packageJson from './package.json';

// Plugin to remove importmap from production builds
function removeImportmapPlugin(): Plugin {
  return {
    name: 'remove-importmap',
    transformIndexHtml(html, ctx) {
      // Only remove importmap in production build
      if (ctx.bundle) {
        return html.replace(/<script type="importmap">[\s\S]*?<\/script>/g, '');
      }
      return html;
    }
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', 'VITE_');

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [tailwindcss(), react(), removeImportmapPlugin()],
      define: {
        '__APP_VERSION__': JSON.stringify(packageJson.version)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        chunkSizeWarningLimit: 1600,
        rollupOptions: {
          output: {
            manualChunks(id) {
              // React core
              if (id.includes('node_modules/react-dom')) {
                return 'vendor-react-dom';
              }
              if (id.includes('node_modules/react/')) {
                return 'vendor-react';
              }
              // Maps
              if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) {
                return 'vendor-maps';
              }
              // Supabase
              if (id.includes('node_modules/@supabase')) {
                return 'vendor-supabase';
              }
              // PDF generation
              if (id.includes('node_modules/jspdf')) {
                return 'vendor-jspdf';
              }
              if (id.includes('node_modules/html2canvas')) {
                return 'vendor-html2canvas';
              }
              if (id.includes('node_modules/jszip')) {
                return 'vendor-jszip';
              }
              // QR code
              if (id.includes('node_modules/qrcode') || id.includes('node_modules/jsqr')) {
                return 'vendor-qr';
              }
              // DnD kit
              if (id.includes('node_modules/@dnd-kit')) {
                return 'vendor-dnd';
              }
              // Lucide icons
              if (id.includes('node_modules/lucide-react')) {
                return 'vendor-icons';
              }
              // Date picker and crop
              if (id.includes('node_modules/react-datepicker') || id.includes('node_modules/react-easy-crop')) {
                return 'vendor-ui-utils';
              }
              // DOMPurify
              if (id.includes('node_modules/dompurify')) {
                return 'vendor-purify';
              }
            }
          }
        }
      }
    };
});
