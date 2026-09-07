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
  /** Classe un aliment dans une liste de goûts et enregistre aussitôt. */
  addTaste: (list: 'favorites' | 'dislikes', food: string) => void
}

/** Comparaison des goûts : « Coriandre » et « coriandre » sont le même aliment. */
function sameFood(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [loaded, setLoaded] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const resetTimer = useRef<number | undefined>(undefined)
  // Miroir synchrone du profil : une action d'aliment modifie puis enregistre
  // dans le même geste, où `profile` serait celui capturé au rendu.
  const profileRef = useRef<Profile>(DEFAULT_PROFILE)
  const loadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    dbGet<Profile>(KEY)
      .then((stored) => {
        // Les champs absents d'un profil enregistré par une version antérieure
        // reprennent leur valeur par défaut.
        if (!cancelled && stored) {
          const merged = { ...DEFAULT_PROFILE, ...stored }
          profileRef.current = merged
          setProfile(merged)
        }
      })
      .catch((error) => console.error('[profile] lecture impossible', error))
      .finally(() => {
        if (cancelled) return
        loadedRef.current = true
        setLoaded(true)
      })
    return () => {
      cancelled = true
      window.clearTimeout(resetTimer.current)
    }
  }, [])

  function update(patch: Partial<Profile>) {
    setProfile((current) => {
      const next = { ...current, ...patch }
      profileRef.current = next
      return next
    })
  }

  /** Unique point d'écriture du profil : porte aussi le cycle de saveState. */
  function persist(next: Profile) {
    setSaveState('saving')
    dbSet(KEY, next)
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

  function save() {
    persist(profileRef.current)
  }

  function addTaste(list: 'favorites' | 'dislikes', food: string) {
    // Écrire avant la fin de la lecture initiale écraserait le profil
    // enregistré par les valeurs par défaut.
    if (!loadedRef.current) return
    const current = profileRef.current
    if (current[list].some((entry) => sameFood(entry, food))) return
    // Un aliment ne peut pas être à la fois apprécié et rejeté.
    const other = list === 'favorites' ? 'dislikes' : 'favorites'
    const next: Profile = {
      ...current,
      [list]: [...current[list], food],
      [other]: current[other].filter((entry) => !sameFood(entry, food)),
    }
    profileRef.current = next
    setProfile(next)
    persist(next)
  }

  return { profile, loaded, saveState, update, save, addTaste }
}
