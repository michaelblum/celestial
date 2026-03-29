import * as THREE from 'three'
import type { DebrisVolumeComponent } from '@lib/ecs/types'

/**
 * DebrisVolumeGenerator — unified generator for asteroid belts, Kuiper belt,
 * planetary rings, and Oort cloud. Uses spherical coordinates with maxInclination
 * to morph between flat disk (ring) and spherical shell (cloud).
 *
 * LOD approach:
 * - Far: static proxy mesh (TorusGeometry for belts, RingGeometry for planetary rings, Sprite for shells)
 * - Near: local-bubble InstancedMesh with treadmill recycling
 */

// ─── Far LOD: Proxy Mesh ────────────────────────────────────────────────────

/**
 * Creates a torus proxy with a radial density gradient shader.
 * The torus tube cross-section matches the volume's maxInclination,
 * and the shader fades edges to make it look like a soft cloud rather than solid rubber.
 */
function createTorusProxy(comp: DebrisVolumeComponent): THREE.Mesh {
  const { spatial, macroVisuals } = comp.profile
  const centerRadius = (spatial.minRadius + spatial.maxRadius) / 2
  const tubeRadius = (spatial.maxRadius - spatial.minRadius) / 2
  // Scale tube vertically by inclination — thin disk at 0, fat torus at π/2
  const verticalScale = Math.max(spatial.maxInclination / (Math.PI / 2), 0.05)

  const geo = new THREE.TorusGeometry(centerRadius, tubeRadius, 32, 128)
  const color = new THREE.Color(macroVisuals.color)

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: color },
      uOpacity: { value: macroVisuals.opacity },
      uCenterRadius: { value: centerRadius },
      uTubeRadius: { value: tubeRadius },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uCenterRadius;
      uniform float uTubeRadius;
      varying vec3 vWorldPos;
      void main() {
        // Distance from the torus ring center (in the XZ plane)
        float radialDist = length(vWorldPos.xz);
        // Distance from the torus tube center
        float toCenter = length(vec2(radialDist - uCenterRadius, vWorldPos.y));
        // Normalized 0..1 from tube center to edge
        float edgeFactor = clamp(toCenter / uTubeRadius, 0.0, 1.0);
        // Gaussian-ish density: dense at center, sparse at edges
        float density = exp(-edgeFactor * edgeFactor * 3.0);
        float alpha = uOpacity * density;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  })

  const mesh = new THREE.Mesh(geo, mat)
  // Squash the tube vertically to match inclination
  mesh.scale.y = verticalScale
  mesh.name = 'debris-far-proxy'
  mesh.frustumCulled = false
  return mesh
}

function createFarProxy(comp: DebrisVolumeComponent): THREE.Object3D {
  const { spatial, macroVisuals } = comp.profile

  // Belts with significant inclination get a torus proxy
  if (macroVisuals.proxyType === 'ring' && spatial.maxInclination > 0.01) {
    return createTorusProxy(comp)
  }

  // Flat planetary rings stay as RingGeometry
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
  // Uses a soft radial gradient canvas texture so it fades smoothly
  // when the camera flies through it (distance-fade hole-punch)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)')     // hollow center
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)') // shell density peak
  gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.4)') // gradual fade
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')     // soft outer edge
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    color: macroVisuals.color,
    transparent: true,
    opacity: macroVisuals.opacity * 5, // boost from 0.04 — sprite needs more to be visible
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(spriteMat)
  const avgRadius = (spatial.minRadius + spatial.maxRadius) / 2
  sprite.scale.setScalar(avgRadius * 2)
  sprite.name = 'debris-far-proxy'
  sprite.frustumCulled = false
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

    // Proxy fades out as camera enters the volume (distance-fade hole-punch)
    const fadeStart = volumeWidth * 2
    const fadeEnd = volumeWidth * 0.5
    if (distToVolume > fadeStart) {
      proxy.visible = true
      if ((proxy as any).material) (proxy as any).material.opacity = comp.profile.macroVisuals.opacity * (comp.profile.macroVisuals.proxyType === 'sprite' ? 5 : 1)
    } else if (distToVolume < fadeEnd) {
      proxy.visible = false
    } else {
      proxy.visible = true
      const fade = (distToVolume - fadeEnd) / (fadeStart - fadeEnd)
      const baseOpacity = comp.profile.macroVisuals.opacity * (comp.profile.macroVisuals.proxyType === 'sprite' ? 5 : 1)
      if ((proxy as any).material) (proxy as any).material.opacity = baseOpacity * fade
    }

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
