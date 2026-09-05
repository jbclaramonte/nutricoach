export type ErrorKind =
  | 'auth'
  | 'credits'
  | 'rate-limit'
  | 'bad-request'
  | 'provider'
  | 'offline'
  | 'parse'

export class OpenRouterError extends Error {
  /** Code HTTP ; 0 lorsque la requête n'a jamais abouti (réseau, hors ligne). */
  readonly status: number
  readonly kind: ErrorKind
  /** Délai conseillé avant nouvelle tentative, issu de l'en-tête Retry-After. */
  readonly retryAfterSec?: number

  constructor(kind: ErrorKind, status: number, message: string, retryAfterSec?: number) {
    super(message)
    this.name = 'OpenRouterError'
    this.kind = kind
    this.status = status
    this.retryAfterSec = retryAfterSec
  }
}

/** Associe un code HTTP à la catégorie d'erreur correspondante. */
export function kindFromStatus(status: number): ErrorKind {
  if (status === 401) return 'auth'
  if (status === 402) return 'credits'
  if (status === 429) return 'rate-limit'
  if (status === 502 || status === 504 || status >= 500) return 'provider'
  return 'bad-request'
}

const MESSAGES: Record<ErrorKind, string> = {
  auth: "Clé API refusée : vérifiez qu'elle est complète et toujours active sur OpenRouter.",
  credits: 'Crédit OpenRouter épuisé : rechargez votre compte pour relancer le coach.',
  'rate-limit': 'Trop de requêtes envoyées au modèle : patientez quelques instants.',
  'bad-request': "La requête a été refusée par OpenRouter (modèle indisponible ou demande invalide).",
  provider: 'Le fournisseur du modèle ne répond pas : réessayez ou choisissez un autre modèle.',
  offline: 'Aucune connexion : le coach IA a besoin du réseau pour répondre.',
  parse: "La réponse du modèle est illisible : réessayez, ou changez de modèle.",
}

/**
 * Phrase française prête à afficher. Ne reprend jamais le détail brut renvoyé
 * par l'API, qui peut contenir la clé passée en en-tête.
 */
export function describeError(error: unknown): string {
  if (error instanceof OpenRouterError) {
    if (error.kind === 'rate-limit' && error.retryAfterSec) {
      return `${MESSAGES['rate-limit']} (environ ${error.retryAfterSec} s)`
    }
    return MESSAGES[error.kind]
  }
  if (error instanceof TypeError) return MESSAGES.offline
  return "Une erreur inattendue est survenue pendant l'appel au coach IA."
}
