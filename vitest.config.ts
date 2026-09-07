import { defineConfig } from 'vitest/config'

// Configuration à part : vite.config.ts embarque des plugins dont les types
// entrent en conflit avec la copie de Vite que vitest apporte.
export default defineConfig({
  test: {
    // Les hooks se testent avec un rendu React, qui exige un DOM.
    environment: 'jsdom',
  },
})
