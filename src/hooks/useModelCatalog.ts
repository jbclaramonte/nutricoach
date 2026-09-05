import { useCallback, useEffect, useState } from 'react'
import { dbGet, dbSet } from '../lib/db'
import { listModels } from '../lib/openrouter/client'
import { describeError } from '../lib/openrouter/errors'
import type { ORModel } from '../lib/openrouter/types'

const KEY = 'models:catalog'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

interface CachedCatalog {
  fetchedAt: number
  models: ORModel[]
}

export interface UseModelCatalogResult {
  models: ORModel[]
  /** false tant que le cache n'a pas été lu. */
  loaded: boolean
  /** Phrase française si le rafraîchissement réseau a échoué. */
  error: string
  refresh: () => void
}

/**
 * Sert d'abord le catalogue mis en cache — l'application reste utilisable hors
 * ligne — puis le rafraîchit s'il date de plus de 24 h.
 */
export function useModelCatalog(): UseModelCatalogResult {
  const [models, setModels] = useState<ORModel[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(() => {
    setError('')
    listModels()
      .then((fetched) => {
        setModels(fetched)
        return dbSet<CachedCatalog>(KEY, { fetchedAt: Date.now(), models: fetched })
      })
      .catch((fetchError) => setError(describeError(fetchError)))
  }, [])

  useEffect(() => {
    let cancelled = false
    dbGet<CachedCatalog>(KEY)
      .then((cached) => {
        if (cancelled) return
        if (cached?.models.length) setModels(cached.models)
        if (!cached || Date.now() - cached.fetchedAt > MAX_AGE_MS) refresh()
      })
      .catch((readError) => console.error('[models] lecture impossible', readError))
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [refresh])

  return { models, loaded, error, refresh }
}
