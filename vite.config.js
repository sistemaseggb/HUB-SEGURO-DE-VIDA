import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // separa as bibliotecas do código do app: o navegador guarda o
        // "vendor" em cache e só rebaixa o que mudou a cada atualização
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('lucide-react')) return 'icones'
          if (id.includes('xlsx')) return undefined // já é dinâmico
          return 'vendor'
        },
      },
    },
  },
})
