import { OpenRouterError, kindFromStatus } from './errors'
import { readSseStream } from './sse'
import type { ORKeyInfo, ORMessage, ORModel, StreamResult } from './types'

const BASE_URL = 'https://openrouter.ai/api/v1'

export interface CompletionRequest {
  apiKey: string
  model: string
  messages: ORMessage[]
  /** Force une réponse JSON conforme, via `structured_outputs`. */
  jsonSchema?: { name: string; schema: object }
  /**
   * Effort de raisonnement demandé au modèle. Les jetons de raisonnement se
   * prennent sur le même budget que la réponse : sur un menu complet, un modèle
   * laissé libre s'y épuise et rend un JSON tronqué.
   */
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': window.location.origin,
    'X-Title': 'NutriAdapt',
  }
}

function buildBody(request: CompletionRequest, stream: boolean): string {
  return JSON.stringify({
    model: request.model,
    messages: request.messages,
    stream,
    temperature: request.temperature,
    max_tokens: request.maxTokens,
    reasoning: request.reasoningEffort ? { effort: request.reasoningEffort } : undefined,
    response_format: request.jsonSchema
      ? {
          type: 'json_schema',
          json_schema: { ...request.jsonSchema, strict: true },
        }
      : undefined,
  })
}

/** Traduit une réponse non-OK en OpenRouterError, sans exposer la clé. */
async function toError(response: Response): Promise<OpenRouterError> {
  const retryAfter = Number(response.headers.get('Retry-After'))
  let detail = response.statusText
  try {
    const payload = (await response.json()) as { error?: { message?: string } }
    if (payload.error?.message) detail = payload.error.message
  } catch {
    // Corps vide ou non JSON : le code HTTP suffit à classer l'erreur.
  }
  return new OpenRouterError(
    kindFromStatus(response.status),
    response.status,
    detail,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  )
}

function wrapNetworkError(error: unknown): never {
  if (error instanceof OpenRouterError) throw error
  if (error instanceof DOMException && error.name === 'AbortError') throw error
  throw new OpenRouterError('offline', 0, 'Requête réseau impossible')
}

/** Une erreur peut arriver au milieu du flux, après un HTTP 200. */
function throwIfStreamError(payload: unknown): void {
  // Un évènement « data: null » est valide dans le flux : le déréférencer
  // lèverait un TypeError et couperait un flux pourtant sain.
  if (typeof payload !== 'object' || payload === null) return
  const error = (payload as { error?: { code?: number; message?: string } }).error
  if (!error) return
  const status = typeof error.code === 'number' ? error.code : 500
  throw new OpenRouterError(kindFromStatus(status), status, error.message ?? 'Erreur du flux')
}

export async function complete(request: CompletionRequest): Promise<string> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(request.apiKey),
      body: buildBody(request, false),
      signal: request.signal,
    })
  } catch (error) {
    wrapNetworkError(error)
  }
  if (!response.ok) throw await toError(response)

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string | null }[]
  }
  throwIfStreamError(payload)
  const choice = payload.choices?.[0]
  const content = choice?.message?.content
  // Un modèle qui réfléchit dépense ses jetons de raisonnement sur le même
  // budget : coupé à la limite, il renvoie un JSON tronqué, illisible au
  // parsing. Le dire ici évite d'accuser le modèle de ne pas répondre en JSON.
  if (choice?.finish_reason === 'length') {
    throw new OpenRouterError('truncated', response.status, 'Réponse coupée à la limite de jetons')
  }
  if (typeof content !== 'string' || content.trim() === '') {
    throw new OpenRouterError('parse', response.status, 'Réponse sans contenu')
  }
  return content
}

/**
 * Version incrémentale de complete(). Une interruption volontaire n'est pas une
 * erreur : le texte déjà reçu est renvoyé tel quel.
 *
 * `finishReason` vaut null quand le flux s'est fermé sans que le modèle ait
 * annoncé sa fin — un fournisseur qui coupe la connexion ne produit ni erreur
 * HTTP ni événement d'erreur, et la réponse tronquée passerait sinon pour
 * complète.
 */
export async function streamComplete(
  request: CompletionRequest & { onDelta: (delta: string) => void },
): Promise<StreamResult> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(request.apiKey),
      body: buildBody(request, true),
      signal: request.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { text: '', finishReason: 'abort' }
    }
    wrapNetworkError(error)
  }
  if (!response.ok) throw await toError(response)
  if (!response.body) throw new OpenRouterError('parse', response.status, 'Flux vide')

  let text = ''
  let finishReason: string | null = null
  try {
    await readSseStream(
      response.body,
      (payload) => {
        throwIfStreamError(payload)
        const choice = (
          payload as {
            choices?: { delta?: { content?: string }; finish_reason?: string | null }[]
          }
        ).choices?.[0]
        if (choice?.finish_reason) finishReason = choice.finish_reason
        const delta = choice?.delta?.content
        if (!delta) return
        text += delta
        request.onDelta(delta)
      },
      request.signal,
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { text, finishReason: 'abort' }
    }
    if (error instanceof OpenRouterError) throw error
    throw new OpenRouterError('parse', 0, 'Flux interrompu')
  }
  return { text, finishReason }
}

interface RawModel {
  id: string
  name: string
  context_length?: number
  architecture?: { input_modalities?: string[] }
  supported_parameters?: string[]
  pricing?: { prompt?: string; completion?: string }
  top_provider?: { max_completion_tokens?: number | null }
}

/**
 * Les prix arrivent en dollars par jeton, sous forme de chaîne. Les routeurs
 * annoncent -1 : leur tarif dépend du modèle finalement retenu. On renvoie null
 * pour ce cas, qu'il ne faut pas confondre avec la gratuité.
 */
function pricePerMillion(value: string | undefined): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed * 1e6
}

function normaliseModel(raw: RawModel): ORModel {
  const promptPricePerM = pricePerMillion(raw.pricing?.prompt)
  const completionPricePerM = pricePerMillion(raw.pricing?.completion)
  return {
    id: raw.id,
    name: raw.name,
    contextLength: raw.context_length ?? 0,
    promptPricePerM,
    completionPricePerM,
    supportsVision: (raw.architecture?.input_modalities ?? []).includes('image'),
    supportsStructuredOutputs: (raw.supported_parameters ?? []).includes('structured_outputs'),
    isFree: promptPricePerM === 0 && completionPricePerM === 0,
    maxCompletionTokens: raw.top_provider?.max_completion_tokens ?? undefined,
  }
}

/** Catalogue public : aucun jeton d'authentification n'est requis. */
export async function listModels(signal?: AbortSignal): Promise<ORModel[]> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}/models`, { signal })
  } catch (error) {
    wrapNetworkError(error)
  }
  if (!response.ok) throw await toError(response)

  const payload = (await response.json()) as { data?: RawModel[] }
  return (payload.data ?? []).map(normaliseModel)
}

export async function verifyKey(apiKey: string, signal?: AbortSignal): Promise<ORKeyInfo> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}/key`, { headers: authHeaders(apiKey), signal })
  } catch (error) {
    wrapNetworkError(error)
  }
  if (!response.ok) throw await toError(response)

  const payload = (await response.json()) as {
    data?: { label?: string; usage?: number; limit_remaining?: number | null; is_free_tier?: boolean }
  }
  const data = payload.data ?? {}
  return {
    label: data.label ?? '',
    usage: data.usage ?? 0,
    limitRemaining: data.limit_remaining ?? null,
    isFreeTier: data.is_free_tier ?? false,
  }
}
