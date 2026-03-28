import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import glsl from 'vite-plugin-glsl'

export default defineConfig({
  plugins: [
    svelte(),
    tailwindcss(),
    glsl(),
  ],
  resolve: {
    alias: {
      '@lib': '/src/lib',
      '@ui': '/src/ui',
      '@shaders': '/src/lib/shaders',
    },
  },
})
