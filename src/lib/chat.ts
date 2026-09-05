import type { ORMessage } from './openrouter/types'

/** Photo jointe à un message, conservée en data: URL pour l'affichage et l'API. */
export interface ChatAttachment {
  dataUrl: string
  name: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  attachment?: ChatAttachment
  at: number
  /** Réponse coupée par l'utilisateur : le texte partiel est conservé. */
  interrupted?: boolean
  /** L'appel au modèle a échoué ; le message reste affiché en l'état. */
  failed?: boolean
}

/**
 * Historique traduit pour OpenRouter. Un message sans photo garde un contenu
 * texte simple : la forme tableau n'est acceptée que par les modèles vision.
 */
export function toOrMessages(system: string, history: ChatMessage[]): ORMessage[] {
  const messages: ORMessage[] = [{ role: 'system', content: system }]

  for (const message of history) {
    messages.push({
      role: message.role,
      content: message.attachment
        ? [
            { type: 'text', text: message.text },
            { type: 'image_url', image_url: { url: message.attachment.dataUrl } },
          ]
        : message.text,
    })
  }

  return messages
}
