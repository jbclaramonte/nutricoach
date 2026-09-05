import { useEffect, useRef, useState } from 'react'
import { dbGet, dbSet } from '../lib/db'
import { DEFAULT_PROFILE, type Profile } from '../lib/profile'

const KEY = 'profile'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface UseProfileResult {
  profile: Profile
  /** false tant que la lecture IndexedDB n'a pas répondu. */
  loaded: boolean
  saveState: SaveState
  /** Modifie le profil en mémoire ; l'écriture se fait via save(). */
  update: (patch: Partial<Profile>) => void
  save: () => void
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [loaded, setLoaded] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const resetTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    dbGet<Profile>(KEY)
      .then((stored) => {
        // Les champs absents d'un profil enregistré par une version antérieure
        // reprennent leur valeur par défaut.
        if (!cancelled && stored) setProfile({ ...DEFAULT_PROFILE, ...stored })
      })
      .catch((error) => console.error('[profile] lecture impossible', error))
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
      window.clearTimeout(resetTimer.current)
    }
  }, [])

  function update(patch: Partial<Profile>) {
    setProfile((current) => ({ ...current, ...patch }))
  }

  function save() {
    setSaveState('saving')
    dbSet(KEY, profile)
      .then(() => setSaveState('saved'))
      .catch((error) => {
        console.error('[profile] écriture impossible', error)
        setSaveState('error')
      })
      .finally(() => {
        window.clearTimeout(resetTimer.current)
        resetTimer.current = window.setTimeout(() => setSaveState('idle'), 2500)
      })
  }

  return { profile, loaded, saveState, update, save }
}
