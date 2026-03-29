import { describe, it, expect } from 'vitest'
import {
  computeFramingDistance,
  lerpVector3,
  shouldSwitchToSystem,
  SYSTEM_THRESHOLD_RATIO,
} from './CameraController'

describe('computeFramingDistance', () => {
  it('returns distance that frames object at target viewport fraction', () => {
    // For a sphere of radius 1.0, FOV 60deg, filling 60% of viewport height:
    // halfHeight at distance d = d * tan(FOV/2) = d * tan(30deg) = d * 0.577
    // We want objectRadius / halfHeight = 0.6 (fill 60%)
    // So: 1.0 / (d * 0.577) = 0.6 -> d = 1.0 / (0.6 * 0.577) ~ 2.89
    const dist = computeFramingDistance(1.0, 60, 0.6)
    expect(dist).toBeCloseTo(2.89, 1)
  })

  it('returns larger distance for larger objects', () => {
    const small = computeFramingDistance(1.0, 60, 0.6)
    const large = computeFramingDistance(5.0, 60, 0.6)
    expect(large).toBeGreaterThan(small)
  })

  it('returns larger distance for smaller viewport fraction', () => {
    const tight = computeFramingDistance(1.0, 60, 0.8)
    const loose = computeFramingDistance(1.0, 60, 0.3)
    expect(loose).toBeGreaterThan(tight)
  })
})

describe('lerpVector3', () => {
  it('returns start at t=0', () => {
    const result = lerpVector3([0, 0, 0], [10, 10, 10], 0)
    expect(result).toEqual([0, 0, 0])
  })

  it('returns end at t=1', () => {
    const result = lerpVector3([0, 0, 0], [10, 10, 10], 1)
    expect(result).toEqual([10, 10, 10])
  })

  it('returns midpoint at t=0.5', () => {
    const result = lerpVector3([0, 0, 0], [10, 20, 30], 0.5)
    expect(result).toEqual([5, 10, 15])
  })
})

describe('shouldSwitchToSystem', () => {
  it('returns true when object occupies less than threshold of viewport', () => {
    // Object radius 1.0, camera distance 100, FOV 60
    // Object angular size = atan(1.0 / 100) ~ 0.57deg
    // Viewport half-angle = 30deg
    // Fraction = 0.57 / 30 ~ 0.019 -> below 0.05 threshold
    expect(shouldSwitchToSystem(1.0, 100, 60)).toBe(true)
  })

  it('returns false when object fills significant viewport', () => {
    // Object radius 1.0, camera distance 3, FOV 60
    // Object angular size = atan(1.0 / 3) ~ 18.4deg
    // Fraction = 18.4 / 30 ~ 0.61 -> above threshold
    expect(shouldSwitchToSystem(1.0, 3, 60)).toBe(false)
  })
})
