import type { ChatMessage } from '../../lib/chat'
import { parseMarkdown, type InlineNode } from '../../lib/markdown'
import { Icon } from '../Icon'

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, index) =>
        node.type === 'bold' ? (
          <strong key={index}>{node.value}</strong>
        ) : node.type === 'italic' ? (
          <em key={index}>{node.value}</em>
        ) : node.type === 'code' ? (
          <code className="rounded bg-surface-container px-xs font-mono" key={index}>
            {node.value}
          </code>
        ) : (
          <span key={index}>{node.value}</span>
        ),
      )}
    </>
  )
}

/** Les réponses du modèle contiennent du markdown ; les messages saisis, non. */
function Markdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-sm">
      {parseMarkdown(text).map((block, index) =>
        block.type === 'list' ? (
          <ul className="flex list-disc flex-col gap-xs pl-md" key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Inline nodes={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="whitespace-pre-wrap" key={index}>
            <Inline nodes={block.content} />
          </p>
        ),
      )}
    </div>
  )
}

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
        {message.text &&
          (isUser ? (
            <p className="whitespace-pre-wrap">{message.text}</p>
          ) : (
            <Markdown text={message.text} />
          ))}
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
