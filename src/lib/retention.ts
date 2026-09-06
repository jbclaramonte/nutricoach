import { dbDelete, dbKeys } from './db'
import { oldestKey } from './day'

/** Magasins découpés par jour : tout le reste est hors du ménage. */
const DATED_PREFIXES = ['menu:', 'activities:', 'chat:']

/**
 * Clés sans date, héritées du modèle antérieur au découpage par jour. Elles
 * trient après les clés datées et échapperaient à la comparaison.
 */
const LEGACY_KEYS = ['chat:messages']

/** Clés à supprimer : hors de la fenêtre de rétention, ou héritées. */
export function expiredKeys(keys: string[], oldest: string): string[] {
  return keys.filter((key) => {
    if (LEGACY_KEYS.includes(key)) return true
    const prefix = DATED_PREFIXES.find((entry) => key.startsWith(entry))
    if (!prefix) return false
    return key.slice(prefix.length) < oldest
  })
}

/**
 * Ménage unique de l'historique, au démarrage. Sans lui le magasin grossirait
 * indéfiniment ; avec une fenêtre trop courte, le calendrier n'aurait rien à
 * montrer.
 */
export function purgeExpired(): Promise<void> {
  return dbKeys()
    .then((keys) => Promise.all(expiredKeys(keys, oldestKey()).map((key) => dbDelete(key))))
    .then(() => undefined)
    .catch((error) => console.error('[historique] purge impossible', error))
}
