import * as THREE from 'three'
import type { DebrisVolumeComponent } from '@lib/ecs/types'

/**
 * DebrisVolumeGenerator — unified generator for asteroid belts, Kuiper belt,
 * planetary rings, and Oort cloud. Uses spherical coordinates with maxInclination
 * to morph between flat disk (ring) and spherical shell (cloud).
 *
 * LOD approach:
 * - Far: static proxy mesh (RingGeometry or Sprite)
 * - Near: local-bubble InstancedMesh with treadmill recycling
 */

// ─── Far LOD: Proxy Mesh ────────────────────────────────────────────────────

function createFarProxy(comp: DebrisVolumeComponent): THREE.Object3D {
  const { spatial, macroVisuals } = comp.profile

  if (macroVisuals.proxyType === 'ring') {
    const geo = new THREE.RingGeometry(spatial.minRadius, spatial.maxRadius, 128)
    const mat = new THREE.MeshBasicMaterial({
      color: macroVisuals.color,
      transparent: true,
      opacity: macroVisuals.opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2  // flat on ecliptic plane
    mesh.name = 'debris-far-proxy'
    return mesh
  }

  // Sprite proxy (for Oort cloud or spherical shells)
  const spriteMat = new THREE.SpriteMaterial({
    color: macroVisuals.color,
    transparent: true,
    opacity: macroVisuals.opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(spriteMat)
  const avgRadius = (spatial.minRadius + spatial.maxRadius) / 2
  sprite.scale.setScalar(avgRadius * 2)
  sprite.name = 'debris-far-proxy'
  return sprite
}

// ─── Near LOD: Local Bubble InstancedMesh ───────────────────────────────────

function createLocalBubble(comp: DebrisVolumeComponent): THREE.InstancedMesh {
  const { microVisuals } = comp.profile

  // Pick geometry type
  let geo: THREE.BufferGeometry
  switch (microVisuals.geometryType) {
    case 'icosahedron': geo = new THREE.IcosahedronGeometry(1, 0); break
    case 'tetrahedron': geo = new THREE.TetrahedronGeometry(1, 0); break
    default:            geo = new THREE.DodecahedronGeometry(1, 0); break
  }

  const mat = new THREE.MeshStandardMaterial({
    color: microVisuals.colorPalette[0] ?? '#888888',
    roughness: microVisuals.roughness,
    metalness: 0,
  })

  const mesh = new THREE.InstancedMesh(geo, mat, microVisuals.instanceCount)
  mesh.name = 'debris-local-bubble'
  mesh.visible = false  // hidden until camera enters volume
  mesh.frustumCulled = false
  return mesh
}

// ─── Spherical Coordinate Placement ─────────────────────────────────────────

interface RockInstance {
  radius: number
  theta: number       // longitude
  phi: number         // inclination
  scale: number
  spinX: number
  spinY: number
  orbitSpeed: number
}

function generateInstances(comp: DebrisVolumeComponent): RockInstance[] {
  const { spatial, microVisuals } = comp.profile
  const instances: RockInstance[] = []

  for (let i = 0; i < microVisuals.instanceCount; i++) {
    // Radial placement with density curve
    let radius: number
    if (spatial.densityCurve === 'gaussian') {
      const peak = spatial.densityPeak ?? (spatial.minRadius + spatial.maxRadius) / 2
      const sigma = (spatial.maxRadius - spatial.minRadius) / 4
      radius = peak + gaussianRandom() * sigma
      radius = Math.max(spatial.minRadius, Math.min(spatial.maxRadius, radius))
    } else {
      radius = spatial.minRadius + Math.random() * (spatial.maxRadius - spatial.minRadius)
    }

    const theta = Math.random() * Math.PI * 2
    const phi = (Math.random() * 2 - 1) * spatial.maxInclination

    const scale = microVisuals.minSize + Math.random() * (microVisuals.maxSize - microVisuals.minSize)
    const spinX = (Math.random() - 0.5) * microVisuals.tumbleSpeed
    const spinY = (Math.random() - 0.5) * microVisuals.tumbleSpeed * 0.7
    const orbitSpeed = spatial.orbitSpeed * (spatial.minRadius / radius)  // Kepler-ish

    instances.push({ radius, theta, phi, scale, spinX, spinY, orbitSpeed })
  }

  return instances
}

/** Box-Muller transform for approximate gaussian random */
function gaussianRandom(): number {
  const u = 1 - Math.random()
  const v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

// ─── Main Generator ─────────────────────────────────────────────────────────

export function generateDebrisVolume(comp: DebrisVolumeComponent): THREE.Group {
  const group = new THREE.Group()
  group.name = `debris-${comp.variant}`

  // Far proxy
  const proxy = createFarProxy(comp)
  group.add(proxy)

  // Local bubble (hidden initially)
  const bubble = createLocalBubble(comp)
  group.add(bubble)

  // Pre-generate instance data
  const instances = generateInstances(comp)
  const dummy = new THREE.Object3D()

  // Set initial instance transforms
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i]
    const x = Math.cos(inst.theta) * inst.radius * Math.cos(inst.phi)
    const y = Math.sin(inst.phi) * inst.radius
    const z = Math.sin(inst.theta) * inst.radius * Math.cos(inst.phi)

    dummy.position.set(x, y, z)
    dummy.scale.setScalar(inst.scale)
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
    dummy.updateMatrix()
    bubble.setMatrixAt(i, dummy.matrix)
  }
  bubble.instanceMatrix.needsUpdate = true

  // Animation: update function stored on userData
  group.userData.update = (dt: number, _elapsed: number, camera: THREE.Camera) => {
    const camPos = camera.position
    const avgRadius = (comp.profile.spatial.minRadius + comp.profile.spatial.maxRadius) / 2
    const volumeWidth = comp.profile.spatial.maxRadius - comp.profile.spatial.minRadius
    const distToVolume = Math.abs(camPos.length() - avgRadius)

    // Distance-aware update
    const isNear = distToVolume < volumeWidth * 1.5
    bubble.visible = isNear
    proxy.visible = !isNear || true  // proxy always visible as background

    if (isNear) {
      // Per-instance orbital update
      for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        inst.theta += inst.orbitSpeed * dt

        const x = Math.cos(inst.theta) * inst.radius * Math.cos(inst.phi)
        const y = Math.sin(inst.phi) * inst.radius
        const z = Math.sin(inst.theta) * inst.radius * Math.cos(inst.phi)

        dummy.position.set(x, y, z)
        dummy.scale.setScalar(inst.scale)
        dummy.rotation.x += inst.spinX * dt
        dummy.rotation.y += inst.spinY * dt
        dummy.updateMatrix()
        bubble.setMatrixAt(i, dummy.matrix)
      }
      bubble.instanceMatrix.needsUpdate = true
    }
  }

  return group
}
