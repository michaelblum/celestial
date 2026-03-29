import { describe, it, expect } from 'vitest'
import { pickPlanetType, computeOrbitRadius, generateRandomPlanet } from './PlanetFactory'

describe('pickPlanetType', () => {
  it('picks rocky or volcanic for inner slots (1-2)', () => {
    const types = new Set<string>()
    for (let i = 0; i < 50; i++) {
      types.add(pickPlanetType(1))
    }
    // Inner slots should only produce rocky or volcanic
    for (const t of types) {
      expect(['rocky', 'volcanic']).toContain(t)
    }
  })

  it('picks gas-giant for middle slots (3-4)', () => {
    const types = new Set<string>()
    for (let i = 0; i < 50; i++) {
      types.add(pickPlanetType(3))
    }
    expect(types.has('gas-giant')).toBe(true)
  })

  it('picks ice for outer slots (5+)', () => {
    const types = new Set<string>()
    for (let i = 0; i < 50; i++) {
      types.add(pickPlanetType(6))
    }
    expect(types.has('ice')).toBe(true)
  })
})

describe('computeOrbitRadius', () => {
  it('increases with slot number', () => {
    const r1 = computeOrbitRadius(1, 2.0)
    const r2 = computeOrbitRadius(2, 2.0)
    const r3 = computeOrbitRadius(3, 2.0)
    expect(r2).toBeGreaterThan(r1)
    expect(r3).toBeGreaterThan(r2)
  })

  it('starts outside the star size', () => {
    const r = computeOrbitRadius(1, 5.0)
    expect(r).toBeGreaterThan(5.0)
  })
})

describe('generateRandomPlanet', () => {
  it('returns a valid PlanetComponent with orbital config', () => {
    const result = generateRandomPlanet(1, 2.0)
    expect(result.planet.type).toBe('planet')
    expect(result.planet.variant).toBeDefined()
    expect(result.planet.radius).toBeGreaterThan(0)
    expect(result.planet.colorRamp.length).toBeGreaterThanOrEqual(2)
    expect(result.orbital.type).toBe('orbital')
    expect(result.orbital.orbitRadius).toBeGreaterThan(0)
  })
})
