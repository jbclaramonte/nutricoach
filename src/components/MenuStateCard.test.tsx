import { cleanup, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { MenuStateCard } from './MenuStateCard'

// Sans `globals`, vitest n'enregistre pas le nettoyage automatique : le rendu
// précédent resterait dans le document.
beforeEach(cleanup)

describe('MenuStateCard', () => {
  it("parle du jour affiché, pas d'aujourd'hui", () => {
    render(
      <MenuStateCard
        configured
        dayLabel="Demain"
        error=""
        onGenerate={() => {}}
        state="idle"
        tomorrow
      />,
    )
    expect(screen.getByText(/Aucun menu pour demain/)).toBeTruthy()
    expect(screen.getByText('Générer le menu de demain')).toBeTruthy()
  })

  it("garde le geste du jour même sur aujourd'hui", () => {
    render(
      <MenuStateCard
        configured
        dayLabel="Aujourd'hui"
        error=""
        onGenerate={() => {}}
        state="idle"
        tomorrow={false}
      />,
    )
    expect(screen.getByText(/Aucun menu pour aujourd'hui/)).toBeTruthy()
    expect(screen.getByText('Générer mon menu')).toBeTruthy()
  })
})
