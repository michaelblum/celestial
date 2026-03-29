import * as THREE from 'three'
import type { OrbitalComponent } from '@lib/ecs/types'

/**
 * Manages orbital animation for entities with OrbitalComponent.
 * Updates entity positions in a circular/elliptical orbit around their parent.
 */

/** Create a visible orbit path using Three.js EllipseCurve for mathematically precise shape */
export function createOrbitPath(config: OrbitalComponent, color: number = 0x4466aa): THREE.Line {
  const r = config.orbitRadius
  const a = r // semi-major axis
  const b = r * (1 - config.eccentricity * 0.5) // semi-minor axis

  // EllipseCurve produces a true parametric ellipse — sampled at 512 points for GPU rendering
  const curve = new THREE.EllipseCurve(0, 0, a, b, 0, Math.PI * 2, false, 0)
  const curvePoints = curve.getPoints(512)

  // Map 2D curve points to 3D with inclination
  const incRad = config.inclination * (Math.PI / 180)
  const points3D = curvePoints.map(p => {
    const z = p.y
    return new THREE.Vector3(p.x, z * Math.sin(incRad), z * Math.cos(incRad))
  })

  const geometry = new THREE.BufferGeometry().setFromPoints(points3D)
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
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
    period: 30 + radius * 5, // Farther = slower (Kepler-ish)
    inclination: 0,
    eccentricity: 0,
    phase: Math.random() * Math.PI * 2,
  }
}
