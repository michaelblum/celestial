import type { PlanetComponent, OrbitalComponent, GradientStop } from '@lib/ecs/types'
import { defaultOrbitalConfig } from './OrbitalSystem'

// ─── Slot-Based Planet Type Selection ──────────────────────────────────────

const INNER_TYPES: PlanetComponent['variant'][] = ['rocky', 'volcanic', 'rocky', 'rocky']
const MIDDLE_TYPES: PlanetComponent['variant'][] = ['gas-giant', 'gas-giant', 'rocky', 'ice']
const OUTER_TYPES: PlanetComponent['variant'][] = ['ice', 'ice', 'gas-giant', 'ice']

/** Pick a planet type based on orbital slot (1-based, inner to outer) */
export function pickPlanetType(slot: number): PlanetComponent['variant'] {
  const pool = slot <= 2 ? INNER_TYPES : slot <= 4 ? MIDDLE_TYPES : OUTER_TYPES
  return pool[Math.floor(Math.random() * pool.length)]
}

// ─── Orbit Radius ──────────────────────────────────────────────────────────

/** Compute orbit radius for a given slot, ensuring it's outside the star */
export function computeOrbitRadius(slot: number, starSize: number): number {
  const baseGap = starSize + 2.0
  const spacing = 3.0 + slot * 1.5
  return baseGap + slot * spacing + (Math.random() - 0.5) * spacing * 0.3
}

// ─── Color Ramp Generators ─────────────────────────────────────────────────

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const VARIANT_RAMPS: Record<string, () => GradientStop[]> = {
  rocky: () => {
    const base = 60 + Math.random() * 120 // green-brown range
    return [
      { position: 0, color: hslToHex(base + 40, 30, 20) },
      { position: 0.3, color: hslToHex(base, 40, 35) },
      { position: 0.6, color: hslToHex(base - 20, 35, 45) },
      { position: 0.85, color: hslToHex(0, 0, 65) },
      { position: 1, color: hslToHex(0, 0, 90) },
    ]
  },
  'gas-giant': () => {
    const base = Math.random() * 60 // warm tones
    return [
      { position: 0, color: hslToHex(base + 20, 50, 25) },
      { position: 0.3, color: hslToHex(base, 60, 50) },
      { position: 0.5, color: hslToHex(base + 10, 45, 55) },
      { position: 0.7, color: hslToHex(base - 10, 40, 60) },
      { position: 1, color: hslToHex(base + 5, 35, 70) },
    ]
  },
  ice: () => [
    { position: 0, color: hslToHex(230, 40, 15) },
    { position: 0.3, color: hslToHex(220, 55, 45) },
    { position: 0.6, color: hslToHex(200, 50, 65) },
    { position: 1, color: hslToHex(195, 20, 92) },
  ],
  volcanic: () => [
    { position: 0, color: hslToHex(0, 20, 8) },
    { position: 0.3, color: hslToHex(15, 40, 18) },
    { position: 0.6, color: hslToHex(0, 0, 35) },
    { position: 0.9, color: hslToHex(15, 100, 45) },
    { position: 1, color: hslToHex(45, 100, 55) },
  ],
}

// ─── Radius by Type ────────────────────────────────────────────────────────

const VARIANT_RADIUS: Record<string, () => number> = {
  rocky: () => 0.15 + Math.random() * 0.2,
  'gas-giant': () => 0.5 + Math.random() * 0.5,
  ice: () => 0.12 + Math.random() * 0.15,
  volcanic: () => 0.1 + Math.random() * 0.15,
}

// ─── Main Generator ────────────────────────────────────────────────────────

interface RandomPlanetResult {
  planet: PlanetComponent
  orbital: OrbitalComponent
}

/** Generate a random planet appropriate for its orbital slot */
export function generateRandomPlanet(slot: number, starSize: number): RandomPlanetResult {
  const variant = pickPlanetType(slot)
  const orbitRadius = computeOrbitRadius(slot, starSize)
  const radius = (VARIANT_RADIUS[variant] ?? (() => 0.2))()
  const colorRamp = (VARIANT_RAMPS[variant] ?? VARIANT_RAMPS.rocky)()

  const isGasGiant = variant === 'gas-giant'

  const planet: PlanetComponent = {
    type: 'planet',
    variant,
    radius,
    colorRamp,
    roughness: isGasGiant ? 0.1 : 0.2 + Math.random() * 0.4,
    noiseScale: isGasGiant ? 2 + Math.random() * 2 : 2 + Math.random() * 4,
    noiseOctaves: 4,
    atmosphereEnabled: isGasGiant || Math.random() > 0.4,
    atmosphereColor: isGasGiant ? hslToHex(30 + Math.random() * 30, 40, 70) : hslToHex(200 + Math.random() * 40, 50, 60),
    atmosphereDensity: isGasGiant ? 0.7 + Math.random() * 0.3 : 0.3 + Math.random() * 0.4,
    ringEnabled: isGasGiant && Math.random() > 0.5,
    ringInnerRadius: radius * 2.0,
    ringOuterRadius: radius * 3.5,
    ringSegments: 3 + Math.floor(Math.random() * 4),
    moonCount: 0,
  }

  const orbital = defaultOrbitalConfig(orbitRadius)

  return { planet, orbital }
}
