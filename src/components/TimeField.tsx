interface TimeFieldProps {
  /** Heure au format HH:MM. */
  time: string
  /** Absent, l'heure se lit sans se modifier. */
  onChange?: (time: string) => void
  /** Ce que l'heure désigne, pour le lecteur d'écran. */
  label: string
  /** Classes de couleur et de graisse, communes aux deux états. */
  className?: string
}

/**
 * Heure d'un repas ou d'une activité. Éditable, c'est un champ natif : le
 * téléphone ouvre son propre sélecteur et garantit le format HH:MM, qu'aucune
 * validation maison n'a donc à contrôler.
 */
export function TimeField({ time, onChange, label, className = '' }: TimeFieldProps) {
  if (!onChange) {
    return <span className={`whitespace-nowrap ${className}`}>{time}</span>
  }

  return (
    <input
      aria-label={`Heure de ${label}`}
      className={`w-[4.5rem] cursor-pointer rounded-md bg-transparent px-xs py-[1px] outline-none ring-1 ring-inset ring-outline-variant/40 focus:ring-primary ${className}`}
      onChange={(event) => {
        // Le champ se vide le temps d'une saisie clavier : n'écrire qu'une heure
        // complète évite d'enregistrer un horaire vide au passage.
        if (event.target.value) onChange(event.target.value)
      }}
      type="time"
      value={time}
    />
  )
}
