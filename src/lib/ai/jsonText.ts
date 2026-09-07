/** Retire l'éventuel bloc de code entourant la réponse du modèle. */
export function stripFences(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('```')) return trimmed
  return trimmed
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/```\s*$/, '')
    .trim()
}

/** Étendue de la première valeur JSON composite du texte, prose comprise. */
function span(text: string, open: string, close: string): string | null {
  const start = text.indexOf(open)
  const end = text.lastIndexOf(close)
  if (start === -1 || end <= start) return null
  return text.slice(start, end + 1)
}

/**
 * Lit la charge JSON d'une réponse de modèle. Renvoie `undefined` quand rien
 * d'exploitable n'en sort : sans schéma strict, un modèle entoure volontiers sa
 * sortie d'une phrase d'introduction, qu'il faut savoir écarter.
 */
export function parseJsonPayload(raw: string): unknown | undefined {
  const cleaned = stripFences(raw)
  try {
    return JSON.parse(cleaned)
  } catch {
    // Rien : la récupération ci-dessous est le cas nominal du modèle bavard.
  }
  for (const candidate of [span(cleaned, '{', '}'), span(cleaned, '[', ']')]) {
    if (candidate === null) continue
    try {
      return JSON.parse(candidate)
    } catch {
      // Candidat suivant.
    }
  }
  return undefined
}
