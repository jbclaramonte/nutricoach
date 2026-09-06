/** Partie d'un message multimodal : texte, ou image passée en data: URL. */
export type ORContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface ORMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ORContentPart[]
}

/** Modèle normalisé à partir de GET /api/v1/models, prêt pour l'affichage. */
export interface ORModel {
  id: string
  name: string
  contextLength: number
  /** Prix en dollars par million de jetons d'entrée. */
  /** null quand le tarif est variable (modèles routeurs). */
  promptPricePerM: number | null
  /** Prix en dollars par million de jetons de sortie. */
  completionPricePerM: number | null
  supportsVision: boolean
  supportsStructuredOutputs: boolean
  isFree: boolean
  /** Plafond de jetons générés annoncé par le fournisseur principal. */
  maxCompletionTokens?: number
}

/** Réponse de GET /api/v1/key, utilisée pour valider une clé à moindre coût. */
export interface ORKeyInfo {
  label: string
  usage: number
  /** Crédit restant, null quand la clé n'a pas de plafond. */
  limitRemaining: number | null
  isFreeTier: boolean
}

/** Résultat d'un tour streamé. */
export interface StreamResult {
  text: string
  /**
   * Raison de fin annoncée par le modèle : « stop » pour une réponse complète,
   * « length » si le plafond de jetons a été atteint, « abort » sur
   * interruption volontaire. null quand le flux s'est fermé sans rien annoncer,
   * c'est-à-dire une coupure côté fournisseur.
   */
  finishReason: string | null
}
