import { useEffect, useState } from 'react'

/**
 * Route courante dérivée du hash. GitHub Pages ne sait pas réécrire les URL
 * vers index.html : un chemin réel renverrait un 404 au rechargement.
 */
export function useHashRoute(fallback: string): string {
  const [route, setRoute] = useState(() => readHash(fallback))

  useEffect(() => {
    function handleChange() {
      setRoute(readHash(fallback))
    }
    window.addEventListener('hashchange', handleChange)
    return () => window.removeEventListener('hashchange', handleChange)
  }, [fallback])

  return route
}

function readHash(fallback: string): string {
  const value = window.location.hash.replace(/^#\/?/, '')
  return value || fallback
}
