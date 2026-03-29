import * as THREE from 'three'
import type { StarComponent } from '@lib/ecs/types'
import starVert from '@shaders/star.vert'
import starFrag from '@shaders/star.frag'
import coronaVert from '@shaders/corona.vert'
import coronaFrag from '@shaders/corona.frag'
import { createOortCloud } from './OortCloudGenerator'

// ─── Spectral Class Data ────────────────────────────────────────────────────

interface SpectralData {
  temperature: number
  color: string
  radiusMultiplier: number
}

const SPECTRAL_CLASSES: Record<string, SpectralData> = {
  O: { temperature: 40000, color: '#9bb0ff', radiusMultiplier: 2.5 },
  B: { temperature: 20000, color: '#aabfff', radiusMultiplier: 2.0 },
  A: { temperature: 8500,  color: '#cad7ff', radiusMultiplier: 1.6 },
  F: { temperature: 6700,  color: '#f8f7ff', radiusMultiplier: 1.3 },
  G: { temperature: 5778,  color: '#fff4ea', radiusMultiplier: 1.0 },
  K: { temperature: 4400,  color: '#ffd2a1', radiusMultiplier: 0.85 },
  M: { temperature: 3200,  color: '#ffcc6f', radiusMultiplier: 0.6 },
}

// ─── Generator ──────────────────────────────────────────────────────────────

export function generateStar(config: StarComponent): THREE.Group {
  const group = new THREE.Group()
  const spectral = SPECTRAL_CLASSES[config.spectralClass] ?? SPECTRAL_CLASSES.G

  if (config.variant === 'black-hole') {
    return generateBlackHole(config, group)
  }

  const radius = config.radius * spectral.radiusMultiplier

  // ── Star Surface Mesh ──
  const geometry = new THREE.SphereGeometry(radius, 64, 64)
  const material = new THREE.ShaderMaterial({
    vertexShader: starVert,
    fragmentShader: starFrag,
    uniforms: {
      time: { value: 0 },
      temperature: { value: config.temperature || spectral.temperature },
      surfaceDetail: { value: config.surfaceDetail || 4.0 },
      noiseSpeed: { value: 0.15 },
    },
    side: THREE.FrontSide,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.userData.entityId = '' // Set by caller
  mesh.userData.shaderMaterial = material // For animation updates
  group.add(mesh)

  // ── Corona Glow (Billboard Sprite) ──
  const coronaSize = radius * (2.0 + config.coronaReach)
  const coronaGeo = new THREE.PlaneGeometry(coronaSize * 2, coronaSize * 2)
  const coronaMat = new THREE.ShaderMaterial({
    vertexShader: coronaVert,
    fragmentShader: coronaFrag,
    uniforms: {
      time: { value: 0 },
      coronaColor: { value: new THREE.Color(spectral.color) },
      intensity: { value: config.coronaIntensity },
      reach: { value: config.coronaReach },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })

  const corona = new THREE.Mesh(coronaGeo, coronaMat)
  corona.userData.shaderMaterial = coronaMat
  corona.userData.isBillboard = true // Flag for animation loop to face camera
  group.add(corona)

  // ── Point Light (the star emits light) ──
  const light = new THREE.PointLight(
    spectral.color,
    config.coronaIntensity * 50,
    0, // infinite range
    1.5 // physical falloff (slightly less than inverse-square for visual clarity)
  )
  group.add(light)

  // ── Distance Glow Sprite (visible at system-view distances) ──
  const glowCanvas = document.createElement('canvas')
  glowCanvas.width = 64
  glowCanvas.height = 64
  const gctx = glowCanvas.getContext('2d')!
  const gradient = gctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
  gradient.addColorStop(0.15, 'rgba(255, 255, 255, 0.8)')
  gradient.addColorStop(0.4, `rgba(255, 255, 255, 0.3)`)
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  gctx.fillStyle = gradient
  gctx.fillRect(0, 0, 64, 64)
  const glowTexture = new THREE.CanvasTexture(glowCanvas)
  const glowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color(spectral.color),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  )
  glowSprite.scale.setScalar(radius * 6)
  glowSprite.userData.isGlow = true
  group.add(glowSprite)

  // ── Store update function ──
  group.userData.update = (dt: number, elapsed: number, camera: THREE.Camera) => {
    material.uniforms.time.value = elapsed
    coronaMat.uniforms.time.value = elapsed

    // Billboard: corona always faces camera
    corona.quaternion.copy(camera.quaternion)
  }

  return group
}

// ─── Black Hole Variant ─────────────────────────────────────────────────────

function generateBlackHole(config: StarComponent, group: THREE.Group): THREE.Group {
  const radius = config.radius

  // Event horizon — black sphere
  const horizonGeo = new THREE.SphereGeometry(radius, 32, 32)
  const horizonMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
  const horizon = new THREE.Mesh(horizonGeo, horizonMat)
  horizon.userData.entityId = ''
  group.add(horizon)

  // Halo glow
  const haloGeo = new THREE.SphereGeometry(radius * 1.05, 32, 32)
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x4444ff,
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide,
  })
  group.add(new THREE.Mesh(haloGeo, haloMat))

  // Accretion disk
  const diskCanvas = document.createElement('canvas')
  diskCanvas.width = 512
  diskCanvas.height = 512
  const ctx = diskCanvas.getContext('2d')!
  const center = 256
  const gradient = ctx.createRadialGradient(center, center, 50, center, center, 250)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
  gradient.addColorStop(0.1, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.3, 'rgba(255, 150, 0, 0.9)')
  gradient.addColorStop(0.7, 'rgba(100, 20, 0, 0.5)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 512, 512)

  const diskTexture = new THREE.CanvasTexture(diskCanvas)
  const diskGeo = new THREE.PlaneGeometry(radius * 8, radius * 8)
  const diskMat = new THREE.MeshBasicMaterial({
    map: diskTexture,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const disk = new THREE.Mesh(diskGeo, diskMat)
  disk.rotation.x = Math.PI / 2.2
  group.add(disk)

  // Jet beams (bipolar)
  const jetGeo = new THREE.CylinderGeometry(0.1, radius * 0.5, radius * 12, 8)
  const jetMat = new THREE.MeshBasicMaterial({
    color: 0x6666ff,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
  })
  const jetUp = new THREE.Mesh(jetGeo, jetMat)
  jetUp.position.y = radius * 6
  group.add(jetUp)
  const jetDown = new THREE.Mesh(jetGeo, jetMat)
  jetDown.position.y = -radius * 6
  group.add(jetDown)

  group.userData.update = (_dt: number, elapsed: number) => {
    disk.rotation.z = elapsed * 0.5
  }

  return group
}

/** Get default star config for a spectral class */
export function defaultStarConfig(spectralClass: string = 'G'): StarComponent {
  const spectral = SPECTRAL_CLASSES[spectralClass] ?? SPECTRAL_CLASSES.G
  return {
    type: 'star',
    spectralClass: spectralClass as StarComponent['spectralClass'],
    variant: 'main-sequence',
    radius: 1.0,
    temperature: spectral.temperature,
    coronaIntensity: 0.8,
    coronaReach: 1.0,
    surfaceDetail: 4.0,
  }
}
