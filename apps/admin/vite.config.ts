import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  envPrefix: ['VITE_', 'ADMIN_'],
  plugins: [tailwindcss()],
})
