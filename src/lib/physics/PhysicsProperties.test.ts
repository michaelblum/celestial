import { describe, it, expect } from 'vitest'
import {
  density,
  gravity,
  escapeVelocity,
  luminosity,
  isBlackHole,
  orbitalPeriod,
  BLACK_HOLE_THRESHOLD,
  ORBITAL_SCALE_FACTOR,
} from './PhysicsProperties'

describe('density', () => {
  it('computes mass / size^3', () => {
    expect(density(1, 1)).toBe(1)
    expect(density(8, 2)).toBe(1) // 8 / 2^3 = 1
    expect(density(27, 3)).toBe(1) // 27 / 3^3 = 1
  })

  it('returns Infinity for zero size', () => {
    expect(density(1, 0)).toBe(Infinity)
  })

  it('classifies gas giant range', () => {
    // density 0.5-2.0 = gas giant
    const d = density(4, 2) // 4/8 = 0.5
    expect(d).toBeGreaterThanOrEqual(0.5)
    expect(d).toBeLessThanOrEqual(2.0)
  })
})

describe('gravity', () => {
  it('computes mass / size^2', () => {
    expect(gravity(1, 1)).toBe(1)
    expect(gravity(4, 2)).toBe(1) // 4 / 2^2 = 1
    expect(gravity(9, 3)).toBe(1) // 9 / 3^2 = 1
  })

  it('returns Infinity for zero size', () => {
    expect(gravity(1, 0)).toBe(Infinity)
  })
})

describe('escapeVelocity', () => {
  it('computes sqrt(mass / size) * scaleFactor', () => {
    const ev = escapeVelocity(4, 1)
    expect(ev).toBe(Math.sqrt(4) * ORBITAL_SCALE_FACTOR)
  })

  it('increases with mass', () => {
    expect(escapeVelocity(100, 1)).toBeGreaterThan(escapeVelocity(10, 1))
  })

  it('decreases with size', () => {
    expect(escapeVelocity(100, 10)).toBeLessThan(escapeVelocity(100, 1))
  })
})

describe('luminosity', () => {
  it('computes mass^3.5', () => {
    expect(luminosity(1)).toBe(1) // 1^3.5 = 1
    expect(luminosity(2)).toBeCloseTo(Math.pow(2, 3.5))
  })

  it('returns 0 for zero mass', () => {
    expect(luminosity(0)).toBe(0)
  })

  it('scales steeply with mass', () => {
    // 10x mass = ~3162x luminosity
    const ratio = luminosity(10) / luminosity(1)
    expect(ratio).toBeCloseTo(Math.pow(10, 3.5), 0)
  })
})

describe('isBlackHole', () => {
  it('returns false for normal mass/size ratios', () => {
    expect(isBlackHole(1, 1)).toBe(false)
    expect(isBlackHole(100, 1)).toBe(false)
  })

  it('returns true when mass/size exceeds threshold', () => {
    // threshold is 50000
    expect(isBlackHole(BLACK_HOLE_THRESHOLD + 1, 1)).toBe(true)
    expect(isBlackHole(BLACK_HOLE_THRESHOLD * 2 + 1, 2)).toBe(true)
  })

  it('returns false just below threshold', () => {
    expect(isBlackHole(BLACK_HOLE_THRESHOLD - 1, 1)).toBe(false)
  })
})

describe('orbitalPeriod', () => {
  it('computes sqrt(radius^3 / parentMass) * scaleFactor', () => {
    const period = orbitalPeriod(1, 1)
    expect(period).toBe(ORBITAL_SCALE_FACTOR) // sqrt(1/1) * scale
  })

  it('increases with orbit radius', () => {
    expect(orbitalPeriod(1, 10)).toBeGreaterThan(orbitalPeriod(1, 5))
  })

  it('decreases with parent mass', () => {
    expect(orbitalPeriod(100, 5)).toBeLessThan(orbitalPeriod(1, 5))
  })

  it('follows Kepler: period^2 proportional to radius^3', () => {
    const p1 = orbitalPeriod(1, 1)
    const p2 = orbitalPeriod(1, 4)
    // p2/p1 should be sqrt(4^3 / 1^3) = sqrt(64) = 8
    expect(p2 / p1).toBeCloseTo(8, 5)
  })
})
