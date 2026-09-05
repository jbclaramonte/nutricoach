import type { ChatMessage } from '../../lib/chat'
import { Icon } from '../Icon'

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex flex-col gap-xs ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-md py-sm font-body-md text-body-md ${
          isUser
            ? 'bg-primary-container text-on-primary-container'
            : 'bg-surface-container-lowest text-on-surface shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
        }`}
      >
        {message.attachment && (
          <img
            alt={message.attachment.name}
            className="mb-sm max-h-40 w-full rounded-xl object-cover"
            src={message.attachment.dataUrl}
          />
        )}
        {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
      </div>

      {(message.interrupted || message.failed) && (
        <span className="flex items-center gap-xs font-caption text-caption text-on-surface-variant">
          <Icon className="text-[14px]" name={message.failed ? 'error' : 'stop_circle'} />
          {message.failed ? 'Réponse interrompue par une erreur' : 'Réponse arrêtée'}
        </span>
      )}
    </div>
  )
}
