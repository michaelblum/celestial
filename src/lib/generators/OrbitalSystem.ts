import * as THREE from 'three'
import type { OrbitalComponent } from '@lib/ecs/types'

/**
 * Manages orbital animation for entities with OrbitalComponent.
 * Updates entity positions in a circular/elliptical orbit around their parent.
 */

/** Create a visible orbit path (faint ellipse) */
export function createOrbitPath(config: OrbitalComponent, color: number = 0x334466): THREE.Line {
  const segments = 128
  const points: THREE.Vector3[] = []

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    const r = config.orbitRadius
    const a = r // semi-major axis
    const b = r * (1 - config.eccentricity * 0.5) // semi-minor axis (simplified)

    const x = a * Math.cos(angle)
    const z = b * Math.sin(angle)

    // Apply inclination
    const incRad = config.inclination * (Math.PI / 180)
    const y = z * Math.sin(incRad)
    const zFinal = z * Math.cos(incRad)

    points.push(new THREE.Vector3(x, y, zFinal))
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  })

  const line = new THREE.Line(geometry, material)
  line.name = 'orbit-path'
  return line
}

/** Calculate orbital position at a given time */
export function getOrbitalPosition(config: OrbitalComponent, time: number): THREE.Vector3 {
  const angle = (time / config.period) * Math.PI * 2 + config.phase
  const r = config.orbitRadius
  const a = r
  const b = r * (1 - config.eccentricity * 0.5)

  const x = a * Math.cos(angle)
  const z = b * Math.sin(angle)

  // Apply inclination
  const incRad = config.inclination * (Math.PI / 180)
  const y = z * Math.sin(incRad)
  const zFinal = z * Math.cos(incRad)

  return new THREE.Vector3(x, y, zFinal)
}

/** Default orbital config */
export function defaultOrbitalConfig(radius: number = 5): OrbitalComponent {
  return {
    type: 'orbital',
    orbitRadius: radius,
    period: 10 + radius * 2, // Farther = slower (Kepler-ish)
    inclination: 0,
    eccentricity: 0,
    phase: Math.random() * Math.PI * 2,
  }
}
