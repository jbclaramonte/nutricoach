export interface AiSettings {
  /** Clé OpenRouter, conservée uniquement dans ce navigateur. */
  apiKey: string
  modelId: string
  updatedAt: number
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  apiKey: '',
  modelId: '',
  updatedAt: 0,
}

/** Le coach ne peut appeler l'API qu'une fois la clé et le modèle renseignés. */
export function isConfigured(settings: AiSettings): boolean {
  return settings.apiKey.trim().length > 0 && settings.modelId.trim().length > 0
}
