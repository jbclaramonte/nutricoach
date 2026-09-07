import { useEffect, useRef, useState } from 'react'
import { dbGet, dbSet } from '../lib/db'
import { DEFAULT_PROFILE, type Profile } from '../lib/profile'

const KEY = 'profile'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface UseProfileResult {
  profile: Profile
  /** false tant que la lecture IndexedDB n'a pas répondu. */
  loaded: boolean
  /** La lecture initiale a échoué : le profil affiché n'est pas celui enregistré. */
  readFailed: boolean
  saveState: SaveState
  /** Modifie le profil en mémoire ; l'écriture se fait via save(). */
  update: (patch: Partial<Profile>) => void
  save: () => void
  /**
   * Classe un aliment dans une liste de goûts et enregistre aussitôt.
   * La promesse se résout après l'écriture, à false quand le goût n'a pas été
   * enregistré — écriture refusée, profil enregistré inconnu ou libellé vide :
   * l'appelant doit alors le dire à l'utilisateur.
   */
  addTaste: (list: 'favorites' | 'dislikes', food: string) => Promise<boolean>
}

/** Comparaison des goûts : « Coriandre » et « coriandre » sont le même aliment. */
function sameFood(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [loaded, setLoaded] = useState(false)
  const [readFailed, setReadFailed] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const resetTimer = useRef<number | undefined>(undefined)
  // Miroir synchrone du profil affiché, brouillon de l'écran Profil compris :
  // une action d'aliment modifie puis enregistre dans le même geste, où
  // `profile` serait celui capturé au rendu.
  const profileRef = useRef<Profile>(DEFAULT_PROFILE)
  // Dernier profil réellement écrit. Une action d'aliment part de celui-ci, et
  // non du brouillon : l'utilisateur qui a tapé un poids sans l'enregistrer ne
  // doit pas le voir partir en base parce qu'il a touché un aliment.
  const savedRef = useRef<Profile | null>(null)
  const writeGeneration = useRef(0)

  useEffect(() => {
    let cancelled = false
    dbGet<Profile>(KEY)
      .then((stored) => {
        if (cancelled) return
        // Les champs absents d'un profil enregistré par une version antérieure
        // reprennent leur valeur par défaut.
        const merged = stored ? { ...DEFAULT_PROFILE, ...stored } : DEFAULT_PROFILE
        profileRef.current = merged
        savedRef.current = merged
        setProfile(merged)
        setLoaded(true)
      })
      .catch((error) => {
        // `savedRef` reste vide : sans savoir ce qui est en base, toute écriture
        // remplacerait le profil de l'utilisateur par les valeurs par défaut.
        console.error('[profile] lecture impossible', error)
        if (cancelled) return
        // La lecture a répondu, elle a seulement échoué : ce qui dépend de la
        // fin du chargement peut avancer, seule l'écriture reste interdite.
        setReadFailed(true)
        setLoaded(true)
      })
    return () => {
      cancelled = true
      window.clearTimeout(resetTimer.current)
    }
  }, [])

  function update(patch: Partial<Profile>) {
    // Le miroir est la source de vérité : l'updater de setProfile ne s'évalue
    // pas toujours tout de suite, et deux update() de suite perdraient le
    // premier patch avant l'enregistrement.
    const next = { ...profileRef.current, ...patch }
    profileRef.current = next
    setProfile(next)
  }

  /**
   * Unique point d'écriture du profil : porte aussi le cycle de saveState.
   * Résout à false quand le magasin a refusé l'écriture.
   */
  function persist(next: Profile): Promise<boolean> {
    const generation = ++writeGeneration.current
    // Une écriture doublée par une plus récente ne dit plus rien de l'état
    // enregistré : son échec afficherait « Erreur » sur un profil bien écrit.
    const stale = () => writeGeneration.current !== generation
    // Le profil enregistré est tenu à jour dès le départ : attendre la
    // résolution ferait repartir une action lancée entre-temps d'un profil
    // périmé, qui écraserait cette écriture-ci.
    const previous = savedRef.current
    savedRef.current = next
    setSaveState('saving')
    return dbSet(KEY, next)
      .then(() => {
        if (!stale()) setSaveState('saved')
        return true
      })
      .catch((error) => {
        console.error('[profile] écriture impossible', error)
        // La base est restée sur la valeur précédente. Une écriture périmée ne
        // restaure rien : elle reculerait le profil enregistré sous une
        // écriture plus récente.
        if (stale()) return false
        savedRef.current = previous
        setSaveState('error')
        return false
      })
      .finally(() => {
        if (stale()) return
        window.clearTimeout(resetTimer.current)
        resetTimer.current = window.setTimeout(() => setSaveState('idle'), 2500)
      })
  }

  function save() {
    void persist(profileRef.current)
  }

  async function addTaste(list: 'favorites' | 'dislikes', food: string): Promise<boolean> {
    // Écrire avant la fin de la lecture initiale, ou après son échec, écraserait
    // le profil enregistré par les valeurs par défaut.
    const stored = savedRef.current
    if (!stored) return false
    // Les espaces de bord se retrouveraient dans la puce d'interface et dans le
    // prompt du coach.
    const value = food.trim()
    if (!value) return false
    if (stored[list].some((entry) => sameFood(entry, value))) return true
    // Un aliment ne peut pas être à la fois apprécié et rejeté.
    const other = list === 'favorites' ? 'dislikes' : 'favorites'
    const tastes = {
      [list]: [...stored[list], value],
      [other]: stored[other].filter((entry) => !sameFood(entry, value)),
    } as Pick<Profile, 'favorites' | 'dislikes'>
    // Le brouillon suit à l'écran, mais seul le profil enregistré part en base.
    const draft: Profile = { ...profileRef.current, ...tastes }
    profileRef.current = draft
    setProfile(draft)
    const ok = await persist({ ...stored, ...tastes })
    // Le goût s'affiche sans attendre l'écriture ; refusée, il ne doit pas
    // rester à l'écran comme s'il était acquis. Les goûts repartent de
    // `savedRef`, déjà restauré, ce qui les laisse cohérents avec la base même
    // si une action plus récente est passée entre-temps.
    if (!ok) showTastesOf(savedRef.current)
    return ok
  }

  /** Réaligne les goûts affichés sur un profil de référence, brouillon gardé. */
  function showTastesOf(reference: Profile | null) {
    if (!reference) return
    const next: Profile = {
      ...profileRef.current,
      favorites: reference.favorites,
      dislikes: reference.dislikes,
    }
    profileRef.current = next
    setProfile(next)
  }

  return { profile, loaded, readFailed, saveState, update, save, addTaste }
}
