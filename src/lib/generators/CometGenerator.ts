import * as THREE from 'three'
import type { CometComponent } from '@lib/ecs/types'

/**
 * CometGenerator — creates a nucleus (small rocky sphere) and a particle tail.
 * Tail always points away from the origin (sun) — anti-sunward direction.
 */

export function generateComet(comp: CometComponent): THREE.Group {
  const group = new THREE.Group()
  group.name = 'comet'

  // ── Nucleus ──
  const nucleusGeo = new THREE.DodecahedronGeometry(comp.nucleusRadius, 1)
  const nucleusMat = new THREE.MeshStandardMaterial({
    color: comp.coreColor,
    roughness: 0.8,
    metalness: 0,
    emissive: comp.coreColor,
    emissiveIntensity: 0.2,
  })
  const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat)
  nucleus.name = 'comet-nucleus'
  group.add(nucleus)

  // ── Tail (Points system) ──
  const count = comp.tailParticleCount
  const positions = new Float32Array(count * 3)
  const alphas = new Float32Array(count)
  const lifetimes = new Float32Array(count)
  const velocities = new Float32Array(count * 3)

  // Initialize particles behind the comet
  for (let i = 0; i < count; i++) {
    const t = Math.random()  // lifetime 0-1
    lifetimes[i] = t
    alphas[i] = 1.0 - t
    // Scatter particles behind the nucleus
    positions[i * 3] = (Math.random() - 0.5) * 0.02
    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.02
    positions[i * 3 + 2] = t * comp.tailLength
    // Initial velocity (will be overridden by anti-sunward direction)
    velocities[i * 3] = 0
    velocities[i * 3 + 1] = 0
    velocities[i * 3 + 2] = 0.5 + Math.random() * 0.5
  }

  const tailGeo = new THREE.BufferGeometry()
  tailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  tailGeo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))

  const tailMat = new THREE.PointsMaterial({
    color: comp.tailColor,
    size: 0.02,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })

  const tail = new THREE.Points(tailGeo, tailMat)
  tail.name = 'comet-tail'
  tail.frustumCulled = false
  group.add(tail)

  // ── Animation ──
  const sunPos = new THREE.Vector3(0, 0, 0)
  const antiSun = new THREE.Vector3()

  group.userData.update = (dt: number) => {
    // Anti-sunward direction (tail points away from origin)
    const worldPos = new THREE.Vector3()
    group.getWorldPosition(worldPos)
    antiSun.copy(worldPos).sub(sunPos).normalize()

    // Distance to sun affects tail intensity
    const distToSun = worldPos.length()
    const tailIntensity = Math.min(1.0, 3.0 / (distToSun + 0.5))
    tailMat.opacity = 0.6 * tailIntensity

    // Emissive intensity based on proximity to sun
    nucleusMat.emissiveIntensity = 0.2 + tailIntensity * 0.5

    // Update particle positions
    const posAttr = tailGeo.attributes.position as THREE.BufferAttribute
    const posArr = posAttr.array as Float32Array

    for (let i = 0; i < count; i++) {
      lifetimes[i] += dt * (0.3 + Math.random() * 0.1)

      if (lifetimes[i] > 1.0) {
        // Reset particle at nucleus
        lifetimes[i] = 0
        posArr[i * 3] = (Math.random() - 0.5) * 0.02
        posArr[i * 3 + 1] = (Math.random() - 0.5) * 0.02
        posArr[i * 3 + 2] = 0
      } else {
        // Drift in anti-sunward direction (in local space, align tail)
        const speed = (0.5 + Math.random() * 0.3) * dt * comp.tailLength
        posArr[i * 3] += (Math.random() - 0.5) * dt * 0.05  // lateral scatter
        posArr[i * 3 + 1] += (Math.random() - 0.5) * dt * 0.05
        posArr[i * 3 + 2] += speed
      }
    }

    posAttr.needsUpdate = true

    // Orient the tail group so +Z points anti-sunward
    if (antiSun.lengthSq() > 0.001) {
      const targetDir = group.worldToLocal(sunPos.clone().add(antiSun.clone().multiplyScalar(10)))
      tail.lookAt(targetDir)
    }
  }

  return group
}
