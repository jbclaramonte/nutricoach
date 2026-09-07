import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '../../lib/chat'
import { shiftDay, todayKey } from '../../lib/day'
import { CoachSheet } from './CoachSheet'

const yesterday = shiftDay(todayKey(), -1)

/** Un échange terminé : c'est lui qui fait apparaître « Appliquer au menu ». */
const messages: ChatMessage[] = [
  { id: '1', role: 'user', text: 'Remplace le déjeuner', at: 1 },
  { id: '2', role: 'assistant', text: 'Voici une idée', at: 2 },
]

function renderSheet(day: string, readOnly: boolean) {
  render(
    <CoachSheet
      coachName="Dr. Anya"
      configured
      day={day}
      error=""
      hasMenu
      messages={messages}
      onApplyToMenu={vi.fn()}
      onClear={vi.fn()}
      onSend={vi.fn()}
      onStop={vi.fn()}
      online
      readOnly={readOnly}
      reviseError=""
      reviseNotice=""
      revising={false}
      streaming={false}
    />,
  )
}

// jsdom n'implémente pas le défilement : le volet suit le bas à chaque rendu.
Element.prototype.scrollIntoView = vi.fn()

afterEach(cleanup)

describe('CoachSheet', () => {
  it('nomme le jour de la conversation', () => {
    renderSheet(yesterday, true)

    expect(screen.getByText(/Votre coach nutrition — /)).toBeTruthy()
  })

  it('rend les commandes de la conversation du jour', () => {
    renderSheet(todayKey(), false)

    expect(screen.getByText('Appliquer au menu')).toBeTruthy()
    expect(screen.getByLabelText('Effacer la conversation')).toBeTruthy()
  })

  it('retire les commandes sans effet sur un jour passé', () => {
    renderSheet(yesterday, true)

    expect(screen.queryByText('Appliquer au menu')).toBeNull()
    expect(screen.queryByLabelText('Effacer la conversation')).toBeNull()
  })

  it('dit pourquoi la saisie est morte sur un jour passé', () => {
    renderSheet(yesterday, true)

    expect(screen.getByText(/Journée archivée — consultation seule\./)).toBeTruthy()
  })

  it("ne dit rien de tel sur la journée en cours", () => {
    renderSheet(todayKey(), false)

    expect(screen.queryByText(/Journée archivée/)).toBeNull()
  })
})
