import type { ChatAttachment } from '../chat'

const MAX_SIDE = 1024
const QUALITY = 0.8

/**
 * Réduction obligatoire : un JPEG de téléphone pèse ~4 Mo et la même data: URL
 * sert à la fois à l'affichage et à l'appel API, donc à l'historique persisté.
 * Quelques dizaines de messages suffiraient à saturer le quota IndexedDB.
 */
export async function fileToDataUrl(file: File): Promise<ChatAttachment> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Seules les photos sont acceptées : choisissez une image.')
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Cette image n'a pas pu être lue : réessayez avec une autre photo.")
  })

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))

  const context = canvas.getContext('2d')
  if (!context) throw new Error("La photo n'a pas pu être préparée sur cet appareil.")
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  return { dataUrl: canvas.toDataURL('image/jpeg', QUALITY), name: file.name }
}
