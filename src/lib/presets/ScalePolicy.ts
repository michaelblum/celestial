/**
 * ScalePolicy — converts real physical units to scene rendering units.
 *
 * Three separate scales because real ratios span many orders of magnitude:
 * - Planet orbits: 1 AU = 3 scene units
 * - Moon orbits: compressed, anchored to parent's visual radius
 * - Body radii: linear proportional with min clamp
 * - Periods: 1 Earth year = 60 seconds sim time
 */

// ─── Constants ──────────────────────────────────────────────────────────────

const AU_TO_SCENE = 3
const KM_TO_SCENE_RADIUS = 0.0000063
const MIN_SCENE_RADIUS = 0.001
const MOON_ORBIT_FACTOR = 0.012
const PERIOD_SCALE = 60 / 365.25  // days → sim seconds (Earth year = 60s)

// ─── Public API ─────────────────────────────────────────────────────────────

/** Convert real radius in km to scene-unit radius (with min clamp) */
export function toSceneRadius(km: number): number {
  return Math.max(km * KM_TO_SCENE_RADIUS, MIN_SCENE_RADIUS)
}

/** Convert orbital semi-major axis in AU to scene-unit orbit radius */
export function toSceneOrbit(au: number): number {
  return au * AU_TO_SCENE
}

/**
 * Convert moon orbital radius (km from parent center) to scene-unit orbit radius.
 * Uses compressed scaling anchored to the parent's visual radius so moons
 * don't render inside their parent planets.
 */
export function toSceneMoonOrbit(moonOrbitKm: number, parentRadiusKm: number): number {
  const parentVisRadius = toSceneRadius(parentRadiusKm)
  return parentVisRadius * 1.2 + Math.pow(moonOrbitKm, 0.3) * MOON_ORBIT_FACTOR
}

/** Convert real orbital period in Earth days to sim-time period in seconds */
export function toScenePeriod(days: number): number {
  return days * PERIOD_SCALE
}

/** Convert real orbital period in Earth years to sim-time period in seconds */
export function toScenePeriodYears(years: number): number {
  return years * 60  // 1 year = 60 seconds
}
