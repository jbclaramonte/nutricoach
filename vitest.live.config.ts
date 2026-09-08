import { defineConfig } from 'vitest/config'

// Les essais « live » appellent réellement OpenRouter : ils coûtent des crédits
// et dépendent du réseau, donc ils vivent hors de la suite lancée en boucle.
export default defineConfig({
  test: {
    // client.ts lit window.location.origin pour l'en-tête HTTP-Referer.
    environment: 'jsdom',
    include: ['live/**/*.live.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
})
