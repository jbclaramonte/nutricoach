import { useEffect, useRef, useState } from 'react'
import { dbGet, dbSet } from '../lib/db'
import { DEFAULT_AI_SETTINGS, type AiSettings } from '../lib/ai/settings'
import { verifyKey } from '../lib/openrouter/client'
import { describeError } from '../lib/openrouter/errors'
import type { ORKeyInfo } from '../lib/openrouter/types'

const KEY = 'ai:settings'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'
export type TestState = 'idle' | 'testing' | 'ok' | 'error'

export interface UseAiSettingsResult {
  settings: AiSettings
  /** false tant que la lecture IndexedDB n'a pas répondu. */
  loaded: boolean
  saveState: SaveState
  /** Modifie les réglages en mémoire ; l'écriture se fait via save(). */
  update: (patch: Partial<AiSettings>) => void
  save: () => void
  testState: TestState
  /** Renseigné après un test réussi. */
  keyInfo: ORKeyInfo | null
  /** Phrase française expliquant l'échec du dernier test. */
  testError: string
  testKey: () => void
}

export function useAiSettings(): UseAiSettingsResult {
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [testState, setTestState] = useState<TestState>('idle')
  const [keyInfo, setKeyInfo] = useState<ORKeyInfo | null>(null)
  const [testError, setTestError] = useState('')
  const resetTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    dbGet<AiSettings>(KEY)
      .then((stored) => {
        if (!cancelled && stored) setSettings({ ...DEFAULT_AI_SETTINGS, ...stored })
      })
      .catch((error) => console.error('[ai-settings] lecture impossible', error))
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
      window.clearTimeout(resetTimer.current)
    }
  }, [])

  function update(patch: Partial<AiSettings>) {
    setSettings((current) => ({ ...current, ...patch }))
    if (patch.apiKey !== undefined) {
      setTestState('idle')
      setKeyInfo(null)
      setTestError('')
    }
  }

  function save() {
    setSaveState('saving')
    const next = { ...settings, updatedAt: Date.now() }
    setSettings(next)
    dbSet(KEY, next)
      .then(() => setSaveState('saved'))
      .catch((error) => {
        console.error('[ai-settings] écriture impossible', error)
        setSaveState('error')
      })
      .finally(() => {
        window.clearTimeout(resetTimer.current)
        resetTimer.current = window.setTimeout(() => setSaveState('idle'), 2500)
      })
  }

  function testKey() {
    const apiKey = settings.apiKey.trim()
    if (!apiKey) return
    setTestState('testing')
    setTestError('')
    verifyKey(apiKey)
      .then((info) => {
        setKeyInfo(info)
        setTestState('ok')
      })
      .catch((error) => {
        // La clé ne doit jamais transiter par la console ni par l'affichage.
        setKeyInfo(null)
        setTestError(describeError(error))
        setTestState('error')
      })
  }

  return { settings, loaded, saveState, update, save, testState, keyInfo, testError, testKey }
}
