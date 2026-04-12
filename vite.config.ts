import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";
import { fileURLToPath } from 'url'; // Utilitario estndar de Node

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
  },  esbuild: {
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
})import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";
import { fileURLToPath } from 'url'; // Utilitario estándar de Node

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
