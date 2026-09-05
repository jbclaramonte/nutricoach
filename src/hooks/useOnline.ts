import { useEffect, useState } from 'react'

/**
 * État de connexion. `navigator.onLine` ment régulièrement — il signale une
 * interface réseau associée, pas une route utilisable — mais il suffit à
 * afficher un bandeau ; les échecs réels sont traités à l'appel.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    function update() {
      setOnline(navigator.onLine)
    }
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return online
}
