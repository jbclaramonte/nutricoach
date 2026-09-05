/**
 * Lit un flux SSE OpenRouter et remet chaque objet `data:` décodé. Les morceaux
 * réseau coupent les lignes n'importe où : le reste est conservé d'un chunk au
 * suivant. Les commentaires (': OPENROUTER PROCESSING') et les lignes JSON
 * malformées sont ignorés ; « data: [DONE] » clôt la lecture.
 */
export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (payload: unknown) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      let newline = buffer.indexOf('\n')
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        newline = buffer.indexOf('\n')

        if (!line || line.startsWith(':')) continue
        if (!line.startsWith('data:')) continue

        const data = line.slice(5).trim()
        if (data === '[DONE]') return
        try {
          onEvent(JSON.parse(data))
        } catch {
          // Ligne tronquée ou non JSON : on passe à la suivante.
        }
      }
    }
  } finally {
    reader.cancel().catch(() => undefined)
  }
}
