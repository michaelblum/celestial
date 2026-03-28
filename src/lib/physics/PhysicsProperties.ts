// ─── Constants (tuning knobs) ──────────────────────────────────────────────

export const BLACK_HOLE_THRESHOLD = 50000    // mass/size ratio
export const NEUTRON_STAR_THRESHOLD = 5000   // mass/size ratio
export const ORBITAL_SCALE_FACTOR = 10       // tuning factor for orbital period feel
export const LUMINOSITY_EXPONENT = 3.5       // mass-luminosity relation

// ─── Derived Property Functions ────────────────────────────────────────────

/** Density = mass / size^3. Determines object character. */
export function density(mass: number, size: number): number {
  if (size === 0) return Infinity
  return mass / (size ** 3)
}

/** Surface gravity = mass / size^2. Drives orbital speed of children. */
export function gravity(mass: number, size: number): number {
  if (size === 0) return Infinity
  return mass / (size ** 2)
}

/** Escape velocity = sqrt(mass / size) * scaleFactor. */
export function escapeVelocity(mass: number, size: number): number {
  if (size === 0) return Infinity
  return Math.sqrt(mass / size) * ORBITAL_SCALE_FACTOR
}

/** Star luminosity = mass^3.5 (mass-luminosity relation). */
export function luminosity(mass: number): number {
  if (mass === 0) return 0
  return Math.pow(mass, LUMINOSITY_EXPONENT)
}

/** Black hole threshold: mass/size ratio exceeds threshold. */
export function isBlackHole(mass: number, size: number): boolean {
  if (size === 0) return true
  return (mass / size) > BLACK_HOLE_THRESHOLD
}

/** Orbital period from Kepler's third law: sqrt(radius^3 / parentMass) * scaleFactor. */
export function orbitalPeriod(parentMass: number, orbitRadius: number): number {
  if (parentMass <= 0) return Infinity
  return Math.sqrt((orbitRadius ** 3) / parentMass) * ORBITAL_SCALE_FACTOR
}

// ─── Display Formatting ────────────────────────────────────────────────────

/** Format a number for display — uses scientific notation for large values. */
export function formatDerived(value: number, precision: number = 1): string {
  if (!isFinite(value)) return '\u221E'
  if (value === 0) return '0'
  if (Math.abs(value) >= 1e6) {
    const exp = Math.floor(Math.log10(Math.abs(value)))
    const mantissa = value / Math.pow(10, exp)
    return `${mantissa.toFixed(precision)} \u00D7 10${toSuperscript(exp)}`
  }
  if (Math.abs(value) < 0.01) {
    const exp = Math.floor(Math.log10(Math.abs(value)))
    const mantissa = value / Math.pow(10, exp)
    return `${mantissa.toFixed(precision)} \u00D7 10${toSuperscript(exp)}`
  }
  return value.toFixed(precision)
}

const superscriptDigits: Record<string, string> = {
  '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3', '4': '\u2074',
  '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079',
  '-': '\u207B',
}

function toSuperscript(n: number): string {
  return String(n).split('').map(c => superscriptDigits[c] ?? c).join('')
}
