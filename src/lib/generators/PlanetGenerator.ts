import * as THREE from 'three'
import type { PlanetComponent, GradientStop } from '@lib/ecs/types'
import planetVert from '@shaders/planet.vert'
import planetFrag from '@shaders/planet.frag'
import atmosphereVert from '@shaders/atmosphere.vert'
import atmosphereFrag from '@shaders/atmosphere.frag'

// ─── Color Ramp → 1D DataTexture ────────────────────────────────────────────

function createColorRampTexture(stops: GradientStop[]): THREE.DataTexture {
  const width = 256
  const data = new Uint8Array(width * 4)
  const sorted = [...stops].sort((a, b) => a.position - b.position)

  for (let i = 0; i < width; i++) {
    const t = i / (width - 1)

    // Find the two stops we're between
    let lower = sorted[0]
    let upper = sorted[sorted.length - 1]
    for (let s = 0; s < sorted.length - 1; s++) {
      if (t >= sorted[s].position && t <= sorted[s + 1].position) {
        lower = sorted[s]
        upper = sorted[s + 1]
        break
      }
    }

    // Interpolate
    const range = upper.position - lower.position
    const mix = range > 0 ? (t - lower.position) / range : 0
    const c1 = new THREE.Color(lower.color)
    const c2 = new THREE.Color(upper.color)
    c1.lerp(c2, mix)

    data[i * 4] = Math.floor(c1.r * 255)
    data[i * 4 + 1] = Math.floor(c1.g * 255)
    data[i * 4 + 2] = Math.floor(c1.b * 255)
    data[i * 4 + 3] = 255
  }

  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat)
  texture.needsUpdate = true
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  return texture
}

// ─── Planet Type → Int ──────────────────────────────────────────────────────

const PLANET_TYPE_MAP: Record<string, number> = {
  rocky: 0,
  'gas-giant': 1,
  ice: 2,
  volcanic: 3,
}

// ─── Generator ──────────────────────────────────────────────────────────────

export function generatePlanet(config: PlanetComponent): THREE.Group {
  const group = new THREE.Group()

  // ── Planet Surface Mesh ──
  const geometry = new THREE.SphereGeometry(config.radius, 64, 64)
  const colorRampTexture = createColorRampTexture(config.colorRamp)

  const material = new THREE.ShaderMaterial({
    vertexShader: planetVert,
    fragmentShader: planetFrag,
    uniforms: {
      time: { value: 0 },
      noiseScale: { value: config.noiseScale },
      noiseOctaves: { value: config.noiseOctaves },
      roughness: { value: config.roughness },
      colorRamp: { value: colorRampTexture },
      planetType: { value: PLANET_TYPE_MAP[config.variant] ?? 0 },
    },
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.userData.entityId = ''
  mesh.userData.shaderMaterial = material
  group.add(mesh)

  // ── Atmosphere Shell ──
  if (config.atmosphereEnabled) {
    const atmosGeo = new THREE.SphereGeometry(config.radius * 1.08, 48, 48)
    const atmosMat = new THREE.ShaderMaterial({
      vertexShader: atmosphereVert,
      fragmentShader: atmosphereFrag,
      uniforms: {
        atmosphereColor: { value: new THREE.Color(config.atmosphereColor) },
        density: { value: config.atmosphereDensity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide, // Render inside face so it shows behind the planet edge
    })

    const atmosphere = new THREE.Mesh(atmosGeo, atmosMat)
    atmosphere.userData.shaderMaterial = atmosMat
    group.add(atmosphere)
  }

  // ── Rings ──
  if (config.ringEnabled) {
    const ringGeo = new THREE.RingGeometry(
      config.ringInnerRadius,
      config.ringOuterRadius,
      64
    )

    // Procedural ring texture with gaps
    const ringCanvas = document.createElement('canvas')
    ringCanvas.width = 512
    ringCanvas.height = 64
    const ctx = ringCanvas.getContext('2d')!

    for (let x = 0; x < 512; x++) {
      const t = x / 512
      // Multiple ring bands with gaps
      const band1 = Math.sin(t * Math.PI * config.ringSegments) * 0.5 + 0.5
      const band2 = Math.sin(t * Math.PI * config.ringSegments * 2.7 + 1.0) * 0.5 + 0.5
      const combined = band1 * 0.6 + band2 * 0.4

      // Cassini-style gap
      const gap = t > 0.45 && t < 0.55 ? 0.2 : 1.0

      const alpha = combined * gap
      const c = config.colorRamp[0]?.color ?? '#aa8866'
      const color = new THREE.Color(c)

      ctx.fillStyle = `rgba(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)}, ${alpha})`
      ctx.fillRect(x, 0, 1, 64)
    }

    const ringTexture = new THREE.CanvasTexture(ringCanvas)
    ringTexture.rotation = Math.PI / 2

    const ringMat = new THREE.MeshBasicMaterial({
      map: ringTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      opacity: 0.8,
    })

    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2 * 0.95 // Slight tilt
    group.add(ring)
  }

  // ── Update Function ──
  group.userData.update = (dt: number, elapsed: number, camera: THREE.Camera) => {
    material.uniforms.time.value = elapsed

    // Slow self-rotation
    mesh.rotation.y += dt * 0.1
  }

  return group
}

/** Get default planet config */
export function defaultPlanetConfig(variant: PlanetComponent['variant'] = 'rocky'): PlanetComponent {
  const ramps: Record<string, GradientStop[]> = {
    rocky: [
      { position: 0, color: '#2b5329' },
      { position: 0.3, color: '#8B7355' },
      { position: 0.6, color: '#6B8E23' },
      { position: 0.85, color: '#A0A0A0' },
      { position: 1, color: '#FFFFFF' },
    ],
    'gas-giant': [
      { position: 0, color: '#8B6914' },
      { position: 0.3, color: '#DAA520' },
      { position: 0.5, color: '#CD853F' },
      { position: 0.7, color: '#DEB887' },
      { position: 1, color: '#FFDEAD' },
    ],
    ice: [
      { position: 0, color: '#1a1a3e' },
      { position: 0.3, color: '#4169E1' },
      { position: 0.6, color: '#87CEEB' },
      { position: 1, color: '#F0F8FF' },
    ],
    volcanic: [
      { position: 0, color: '#1a0a00' },
      { position: 0.3, color: '#3d1c02' },
      { position: 0.6, color: '#555555' },
      { position: 0.9, color: '#ff4400' },
      { position: 1, color: '#ffcc00' },
    ],
  }

  return {
    type: 'planet',
    variant,
    radius: 1.0,
    colorRamp: ramps[variant] ?? ramps.rocky,
    roughness: 0.3,
    noiseScale: 3.0,
    noiseOctaves: 4,
    atmosphereEnabled: variant === 'rocky' || variant === 'gas-giant',
    atmosphereColor: variant === 'gas-giant' ? '#ffddaa' : '#4488ff',
    atmosphereDensity: 0.6,
    ringEnabled: variant === 'gas-giant',
    ringInnerRadius: 1.5,
    ringOuterRadius: 2.5,
    ringSegments: 4,
    moonCount: 0,
  }
}
