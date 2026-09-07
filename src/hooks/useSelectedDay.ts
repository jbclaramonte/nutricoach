import { useEffect, useRef, useState } from 'react'
import { todayKey } from '../lib/day'

/**
 * Jour affiché par l'application. Une session laissée ouverte la nuit
 * afficherait hier en le nommant « aujourd'hui » : au retour au premier plan,
 * seule la sélection qui valait « aujourd'hui » suit le jour réel. Un jour
 * consulté volontairement, lui, reste sous les yeux de l'utilisateur.
 */
export function useSelectedDay(): [string, (day: string) => void] {
  const [day, setDay] = useState(todayKey())
  // Jour réel au moment de la sélection : c'est lui qui distingue « aujourd'hui
  // devenu hier » d'un hier choisi à la main.
  const selectedOn = useRef(todayKey())

  function select(next: string) {
    selectedOn.current = todayKey()
    setDay(next)
  }

  useEffect(() => {
    function follow() {
      if (document.visibilityState !== 'visible') return
      const today = todayKey()
      if (today === selectedOn.current) return
      setDay((current) => (current === selectedOn.current ? today : current))
      selectedOn.current = today
    }
    document.addEventListener('visibilitychange', follow)
    return () => document.removeEventListener('visibilitychange', follow)
  }, [])

  return [day, select]
}
