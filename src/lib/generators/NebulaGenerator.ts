import * as THREE from 'three'
import type { NebulaComponent } from '@lib/ecs/types'
import nebulaVolumeVert from '@shaders/nebula-volume.vert'
import nebulaVolumeFrag from '@shaders/nebula-volume.frag'
import gpuParticleVert from '@shaders/gpu-particle.vert'
import gpuParticleFrag from '@shaders/gpu-particle.frag'

// ─── Style Presets ──────────────────────────────────────────────────────────

interface StylePreset {
  color1: string
  color2: string
  blending: THREE.Blending
  opacity: number
  speed: number
}

const STYLE_PRESETS: Record<string, StylePreset> = {
  nebula: { color1: '#00cc99', color2: '#6622cc', blending: THREE.AdditiveBlending, opacity: 0.4, speed: 0.15 },
  smoke:  { color1: '#999999', color2: '#222222', blending: THREE.NormalBlending, opacity: 0.8, speed: 0.05 },
  fire:   { color1: '#ffcc11', color2: '#ff2200', blending: THREE.AdditiveBlending, opacity: 0.6, speed: 0.3 },
  plasma: { color1: '#00ffcc', color2: '#8800ff', blending: THREE.AdditiveBlending, opacity: 0.5, speed: 0.5 },
}

// ─── Shared soft circle texture ─────────────────────────────────────────────

let sharedTexture: THREE.CanvasTexture | null = null

function getSoftCircleTexture(): THREE.CanvasTexture {
  if (sharedTexture) return sharedTexture

  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)')
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)

  sharedTexture = new THREE.CanvasTexture(canvas)
  return sharedTexture
}

// ─── Generator ──────────────────────────────────────────────────────────────

export function generateNebula(config: NebulaComponent): THREE.Group {
  const group = new THREE.Group()

  switch (config.method) {
    case 'volumetric':
      buildVolumetric(config, group)
      break
    case 'particles':
      buildParticles(config, group)
      break
    case 'sprites':
    default:
      buildSprites(config, group)
      break
  }

  return group
}

// ─── Method 1: Sprite Clusters ──────────────────────────────────────────────

function buildSprites(config: NebulaComponent, group: THREE.Group): void {
  const style = STYLE_PRESETS[config.style] ?? STYLE_PRESETS.nebula
  const spriteCount = Math.min(config.particleCount, 200)
  const texture = getSoftCircleTexture()

  for (let i = 0; i < spriteCount; i++) {
    const hue = Math.random() * 0.1 + 0.95
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: new THREE.Color().setHSL(hue % 1.0, 0.8, 0.5 + Math.random() * 0.2),
      transparent: true,
      opacity: 0.1 + Math.random() * 0.2,
      blending: style.blending,
      depthWrite: false,
    })

    const sprite = new THREE.Sprite(material)

    // Flattened sphere volume
    const r = config.scale * Math.cbrt(Math.random())
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    sprite.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.4,
      r * Math.cos(phi)
    )

    const scale = 1.5 + Math.random() * 2.0
    sprite.scale.set(scale, scale, 1)
    sprite.material.rotation = Math.random() * Math.PI * 2
    sprite.userData.rotSpeed = (Math.random() - 0.5) * 0.005

    group.add(sprite)
  }

  // Core light
  const light = new THREE.PointLight(config.lightColor, config.lightIntensity, config.scale * 5)
  group.add(light)

  group.userData.update = (_dt: number, _elapsed: number) => {
    group.children.forEach((child) => {
      if (child instanceof THREE.Sprite && child.userData.rotSpeed) {
        child.material.rotation += child.userData.rotSpeed
      }
    })
  }
}

// ─── Method 2: Volumetric Shells ────────────────────────────────────────────

function buildVolumetric(config: NebulaComponent, group: THREE.Group): void {
  const style = STYLE_PRESETS[config.style] ?? STYLE_PRESETS.nebula

  const material = new THREE.ShaderMaterial({
    vertexShader: nebulaVolumeVert,
    fragmentShader: nebulaVolumeFrag,
    uniforms: {
      time: { value: 0 },
      cameraPos: { value: new THREE.Vector3() },
      color1: { value: new THREE.Color(config.colorPrimary || style.color1) },
      color2: { value: new THREE.Color(config.colorSecondary || style.color2) },
      opacity: { value: style.opacity * config.density },
      speed: { value: style.speed },
      lightColor: { value: new THREE.Color(config.lightColor) },
      lightIntensity: { value: config.lightIntensity },
    },
    transparent: true,
    depthWrite: false,
    blending: style.blending,
    side: THREE.DoubleSide,
  })

  // Layered shells for volume
  const geometry = new THREE.SphereGeometry(1, 48, 48)
  const numLayers = 12
  for (let i = 0; i < numLayers; i++) {
    const mesh = new THREE.Mesh(geometry, material)
    const s = config.scale * (0.5 + i * 0.08)
    mesh.scale.set(s, s * 0.8, s) // Slightly flattened
    group.add(mesh)
  }

  // Core object (wireframe octahedron)
  const coreGeo = new THREE.OctahedronGeometry(config.scale * 0.3, 0)
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    wireframe: true,
    emissive: new THREE.Color(config.lightColor),
    emissiveIntensity: config.lightIntensity,
  })
  const core = new THREE.Mesh(coreGeo, coreMat)
  core.userData.entityId = ''
  group.add(core)

  // Light
  const light = new THREE.PointLight(config.lightColor, config.lightIntensity, config.scale * 5)
  group.add(light)

  group.userData.update = (_dt: number, elapsed: number, camera: THREE.Camera) => {
    material.uniforms.time.value = elapsed
    material.uniforms.cameraPos.value.copy(camera.position)
    core.rotation.x += 0.005
    core.rotation.y += 0.01
  }
}

// ─── Method 3: GPU Particle System ──────────────────────────────────────────

function buildParticles(config: NebulaComponent, group: THREE.Group): void {
  const style = STYLE_PRESETS[config.style] ?? STYLE_PRESETS.nebula
  const particleCount = Math.min(config.particleCount, 40000)

  const positions = new Float32Array(particleCount * 3)
  const colors = new Float32Array(particleCount * 3)
  const sizes = new Float32Array(particleCount)

  const colorCore = new THREE.Color(0xffffff)
  const colorArm1 = new THREE.Color(config.colorPrimary || style.color1)
  const colorArm2 = new THREE.Color(config.colorSecondary || style.color2)

  for (let i = 0; i < particleCount; i++) {
    // Galaxy spiral math (from matter-light-exp.html)
    const radius = 0.5 + Math.random() * config.scale
    const baseAngle = Math.random() * Math.PI * 2
    const arm = Math.floor(Math.random() * 2)
    const armOffset = arm * Math.PI
    const finalAngle = baseAngle * 0.2 + armOffset + radius * 0.4
    const yScatter = (Math.random() - 0.5) * (config.scale * 0.3 / (radius * 0.5 + 1))

    positions[i * 3] = Math.cos(finalAngle) * radius + (Math.random() - 0.5) * 0.5
    positions[i * 3 + 1] = yScatter
    positions[i * 3 + 2] = Math.sin(finalAngle) * radius + (Math.random() - 0.5) * 0.5

    const mixColor = arm === 0 ? colorArm1 : colorArm2
    const finalC = colorCore.clone().lerp(mixColor, radius / config.scale)

    colors[i * 3] = finalC.r
    colors[i * 3 + 1] = finalC.g
    colors[i * 3 + 2] = finalC.b
    sizes[i] = Math.random() * 3.0 + 0.5
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

  const material = new THREE.ShaderMaterial({
    vertexShader: gpuParticleVert,
    fragmentShader: gpuParticleFrag,
    uniforms: {
      time: { value: 0 },
      pointTexture: { value: getSoftCircleTexture() },
      lightPos: { value: new THREE.Vector3(0, 0, 0) },
      lightColor: { value: new THREE.Color(config.lightColor) },
      lightIntensity: { value: config.lightIntensity },
    },
    transparent: true,
    depthWrite: false,
    blending: style.blending,
  })

  const particles = new THREE.Points(geometry, material)
  group.add(particles)

  // Central object
  const bhGeo = new THREE.SphereGeometry(0.3, 32, 32)
  const bhMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
  const blackHole = new THREE.Mesh(bhGeo, bhMat)
  blackHole.userData.entityId = ''
  group.add(blackHole)

  // Light ring
  const ringGeo = new THREE.TorusGeometry(0.5, 0.05, 16, 64)
  const ringMat = new THREE.MeshBasicMaterial({
    color: config.lightColor,
    transparent: true,
    opacity: config.lightIntensity * 0.3,
    blending: THREE.AdditiveBlending,
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.rotation.x = Math.PI / 2
  group.add(ring)

  group.userData.update = (_dt: number, elapsed: number) => {
    material.uniforms.time.value = elapsed
  }
}

/** Get default nebula config */
export function defaultNebulaConfig(style: NebulaComponent['style'] = 'nebula'): NebulaComponent {
  return {
    type: 'nebula',
    method: 'volumetric',
    style,
    density: 1.0,
    scale: 3.0,
    colorPrimary: STYLE_PRESETS[style]?.color1 ?? '#00cc99',
    colorSecondary: STYLE_PRESETS[style]?.color2 ?? '#6622cc',
    lightColor: '#ff3355',
    lightIntensity: 2.0,
    particleCount: 20000,
  }
}
