// ─── Simulation Time Control ────────────────────────────────────────────────

let timeScale = $state(1.0)
let paused = $state(false)
let simElapsed = 0

/** Get current time scale multiplier */
export function getTimeScale(): number {
  return paused ? 0 : timeScale
}

/** Set time scale (0.1 = slow, 1 = normal, 5 = fast) */
export function setTimeScale(scale: number): void {
  timeScale = Math.max(0.01, Math.min(10, scale))
}

/** Get raw time scale value (even when paused, for UI display) */
export function getRawTimeScale(): number {
  return timeScale
}

/** Toggle pause */
export function togglePause(): void {
  paused = !paused
}

/** Whether simulation is paused */
export function isPaused(): boolean {
  return paused
}

/** Advance simulation time by dt and return the new sim elapsed time */
export function advanceSimTime(dt: number): number {
  const scale = paused ? 0 : timeScale
  simElapsed += dt * scale
  return simElapsed
}

/** Get current simulation elapsed time */
export function getSimElapsed(): number {
  return simElapsed
}
