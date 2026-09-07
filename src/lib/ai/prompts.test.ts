import { describe, expect, it } from 'vitest'
import { buildCoachSystemPrompt } from './prompts'
import { DEFAULT_PROFILE } from '../profile'

describe('buildCoachSystemPrompt', () => {
  it('annonce le jour décrit', () => {
    const prompt = buildCoachSystemPrompt(DEFAULT_PROFILE, [], 'lundi 7 septembre (demain)')
    expect(prompt).toContain('LA JOURNÉE — lundi 7 septembre (demain)')
  })
})
