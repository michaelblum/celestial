import type { Entity, MoonTier } from '@lib/ecs/types'

/**
 * Filter store — controls visibility of orbit path overlays.
 * Does NOT control body rendering (that's BodyLODManager's job).
 */

// ─── Reactive State ─────────────────────────────────────────────────────────

let planetOrbits = $state(true)
let dwarfPlanetOrbits = $state(true)
let majorMoonOrbits = $state(true)
let notableMoonOrbits = $state(false)
let minorMoonOrbits = $state(false)
let cometOrbits = $state(true)

// ─── Public Getters / Setters ───────────────────────────────────────────────

export function getFilters() {
  return {
    planetOrbits,
    dwarfPlanetOrbits,
    majorMoonOrbits,
    notableMoonOrbits,
    minorMoonOrbits,
    cometOrbits,
  }
}

export function setFilter(key: keyof ReturnType<typeof getFilters>, value: boolean): void {
  switch (key) {
    case 'planetOrbits': planetOrbits = value; break
    case 'dwarfPlanetOrbits': dwarfPlanetOrbits = value; break
    case 'majorMoonOrbits': majorMoonOrbits = value; break
    case 'notableMoonOrbits': notableMoonOrbits = value; break
    case 'minorMoonOrbits': minorMoonOrbits = value; break
    case 'cometOrbits': cometOrbits = value; break
  }
}

// ─── Visibility Check ───────────────────────────────────────────────────────

/**
 * Determine if an entity's orbit path overlay should be visible.
 * This only controls orbit LINE visibility, not the body itself.
 */
export function isOverlayVisible(entity: Entity): boolean {
  switch (entity.type) {
    case 'planet':
      return planetOrbits
    case 'dwarf-planet':
      return dwarfPlanetOrbits
    case 'moon': {
      const tier = (entity as any).userData?.moonTier as MoonTier | undefined
      if (tier === 'major') return majorMoonOrbits
      if (tier === 'notable') return notableMoonOrbits
      if (tier === 'minor') return minorMoonOrbits
      return majorMoonOrbits // default
    }
    case 'comet':
      return cometOrbits
    default:
      return true
  }
}
