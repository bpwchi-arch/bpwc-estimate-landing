import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";
import { fileURLToPath } from 'url'; // Node standard utility

// 1. Convertimos la URL del archivo a un path normal
const __filename = fileURLToPath(import.meta.url);
// 2. Sacamos el directorio de ese path (equivalente a __dirname)
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['@react-dev-inspector/babel-plugin']
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Force all non-ASCII characters (emojis, em dashes, okina, etc.)
    // to be escaped as \uXXXX in the output JS. This prevents encoding
    // issues when the server doesn't send a proper UTF-8 charset header.
    cssTarget: 'es2015',
    rollupOptions: {
      output: {
        generatedCode: 'es2015',
      }
    }
  },
  esbuild: {
    charset: 'ascii',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
