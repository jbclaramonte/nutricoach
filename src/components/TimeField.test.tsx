import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TimeField } from './TimeField'

afterEach(cleanup)

describe('TimeField', () => {
  it('remonte la nouvelle heure', () => {
    const onChange = vi.fn()
    render(<TimeField label="Déjeuner" onChange={onChange} time="12:30" />)

    fireEvent.change(screen.getByLabelText('Heure de Déjeuner'), { target: { value: '14:00' } })

    expect(onChange).toHaveBeenCalledWith('14:00')
  })

  it("n'écrit rien tant que la saisie est vide", () => {
    const onChange = vi.fn()
    render(<TimeField label="Déjeuner" onChange={onChange} time="12:30" />)

    fireEvent.change(screen.getByLabelText('Heure de Déjeuner'), { target: { value: '' } })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('affiche une heure figée sans champ quand elle ne se modifie pas', () => {
    render(<TimeField label="Déjeuner" time="12:30" />)

    expect(screen.queryByLabelText('Heure de Déjeuner')).toBeNull()
    expect(screen.getByText('12:30')).toBeTruthy()
  })
})
