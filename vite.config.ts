import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Phaser pèse ~1,4 Mo minifié ; il est déjà isolé dans son propre chunk (chargement à la demande).
  build: { chunkSizeWarningLimit: 1500 },
})
