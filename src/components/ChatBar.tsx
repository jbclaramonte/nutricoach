import { useRef, useState } from 'react'
import { Icon } from './Icon'

interface ChatBarProps {
  /** Appelé à l'envoi ; la photo est optionnelle. */
  onSend: (message: string, photo: File | null) => void
  /** Verrouille la saisie tant que le coach IA n'est pas configuré. */
  disabled?: boolean
}

export function ChatBar({ onSend, disabled = false }: ChatBarProps) {
  const [message, setMessage] = useState('')
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  /** Remplace la photo jointe en libérant l'URL objet précédente. */
  function replacePhoto(file: File | null) {
    if (photo) URL.revokeObjectURL(photo.url)
    setPhoto(file ? { file, url: URL.createObjectURL(file) } : null)
  }

  const canSend = !disabled && (message.trim().length > 0 || photo !== null)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSend) return
    onSend(message.trim(), photo?.file ?? null)
    setMessage('')
    replacePhoto(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <div className="pointer-events-none fixed bottom-16 left-0 right-0 z-40 flex flex-col gap-xs px-margin-mobile pb-4 pb-safe">
      {photo && (
        <div className="pointer-events-auto flex items-center gap-sm self-start rounded-xl bg-surface-container-lowest p-xs pr-sm shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          <img alt="Photo jointe" className="h-10 w-10 rounded-lg object-cover" src={photo.url} />
          <span className="font-caption text-caption text-on-surface-variant">Photo jointe</span>
          <button
            aria-label="Retirer la photo"
            className="flex items-center justify-center text-on-surface-variant"
            onClick={() => replacePhoto(null)}
            type="button"
          >
            <Icon className="text-[18px]" name="close" />
          </button>
        </div>
      )}

      <form
        className="pointer-events-auto flex h-12 items-center gap-xs rounded-full bg-surface-container-lowest px-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        onSubmit={handleSubmit}
      >
        <input
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => replacePhoto(event.target.files?.[0] ?? null)}
          ref={fileInput}
          type="file"
        />
        <button
          aria-label="Joindre une photo"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors active:bg-surface-container-highest"
          disabled={disabled}
          onClick={() => fileInput.current?.click()}
          type="button"
        >
          <Icon name="photo_camera" />
        </button>
        <input
          className="min-w-0 flex-1 bg-transparent font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none"
          disabled={disabled}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={
            disabled ? 'Configurez votre clé OpenRouter dans Profil' : "Message à l'IA..."
          }
          type="text"
          value={message}
        />
        <button
          aria-label="Envoyer"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm transition-transform active:scale-95 disabled:opacity-40"
          disabled={!canSend}
          type="submit"
        >
          <Icon filled name="send" />
        </button>
      </form>
    </div>
  )
}
