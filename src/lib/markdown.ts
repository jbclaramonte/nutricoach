/**
 * Rendu minimal du markdown que les modèles produisent réellement dans le chat :
 * gras, italique, code inline, listes à puces et paragraphes. Volontairement
 * limité et sans HTML brut — le texte reste rendu comme des éléments React.
 */

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string }

export type MarkdownBlock =
  | { type: 'paragraph'; content: InlineNode[] }
  | { type: 'list'; items: InlineNode[][] }

const INLINE_PATTERN = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/

/** Découpe une ligne en fragments ; tout ce qui n'est pas reconnu reste du texte. */
export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = []
  let rest = text

  while (rest) {
    const match = INLINE_PATTERN.exec(rest)
    if (!match) break
    if (match.index > 0) nodes.push({ type: 'text', value: rest.slice(0, match.index) })
    if (match[1] !== undefined) nodes.push({ type: 'bold', value: match[1] })
    else if (match[2] !== undefined) nodes.push({ type: 'italic', value: match[2] })
    else nodes.push({ type: 'code', value: match[3] })
    rest = rest.slice(match.index + match[0].length)
  }

  if (rest) nodes.push({ type: 'text', value: rest })
  return nodes
}

function isBullet(line: string): boolean {
  // Le « * » d'une puce est suivi d'une espace, ce qui le distingue de l'italique.
  return /^\s*[-*]\s+/.test(line)
}

export function parseMarkdown(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  let paragraph: string[] = []
  let items: InlineNode[][] = []

  function flush() {
    if (items.length) {
      blocks.push({ type: 'list', items })
      items = []
    }
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', content: parseInline(paragraph.join('\n')) })
      paragraph = []
    }
  }

  for (const line of text.split('\n')) {
    if (!line.trim()) {
      flush()
      continue
    }
    if (isBullet(line)) {
      if (paragraph.length) flush()
      items.push(parseInline(line.replace(/^\s*[-*]\s+/, '')))
      continue
    }
    if (items.length) flush()
    paragraph.push(line)
  }
  flush()

  return blocks
}
