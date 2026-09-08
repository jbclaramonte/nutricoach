import { readFileSync } from 'node:fs'

/**
 * Clé lue dans .env.local, hors du dépôt. Absente, l'essai s'arrête net plutôt
 * que d'échouer plus loin sur un 401 difficile à lire.
 */
export function apiKey(): string {
  let raw: string
  try {
    raw = readFileSync(`${process.cwd()}/.env.local`, 'utf8')
  } catch {
    throw new Error('.env.local introuvable : renseignez OPENROUTER_API_KEY pour les essais live.')
  }
  const match = raw.match(/^OPENROUTER_API_KEY\s*=\s*(.+)$/m)
  if (!match) throw new Error('OPENROUTER_API_KEY absent de .env.local')
  return match[1].trim().replace(/^["']|["']$/g, '')
}

/** Modèle des essais : celui retenu pour la mise au point du parcours menu. */
export const LIVE_MODEL = 'z-ai/glm-5.3-flash'
