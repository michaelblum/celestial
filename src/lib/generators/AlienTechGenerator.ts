import * as THREE from 'three'
import type { AlienTechComponent } from '@lib/ecs/types'

/** Generate alien technology structures */
export function generateAlienTech(config: AlienTechComponent): THREE.Group {
  const group = new THREE.Group()

  switch (config.variant) {
    case 'dyson-sphere':
      buildDysonSphere(config, group)
      break
    case 'halo-construct':
      buildHaloConstruct(config, group)
      break
  }

  return group
}

function buildDysonSphere(config: AlienTechComponent, group: THREE.Group): void {
  // Wireframe icosahedron shell — the Dyson sphere structure
  const shellGeo = new THREE.IcosahedronGeometry(config.radius, config.detail)
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: config.metalness,
    roughness: config.roughness,
    wireframe: true,
    emissive: new THREE.Color(config.emissiveColor),
    emissiveIntensity: config.emissiveIntensity * 0.3,
  })
  const shell = new THREE.Mesh(shellGeo, shellMat)
  shell.userData.entityId = ''
  group.add(shell)

  // Second shell — slightly smaller, rotated for lattice effect
  const innerShellGeo = new THREE.IcosahedronGeometry(config.radius * 0.95, config.detail + 1)
  const innerShellMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: config.metalness,
    roughness: config.roughness,
    wireframe: true,
    emissive: new THREE.Color(config.emissiveColor),
    emissiveIntensity: config.emissiveIntensity * 0.15,
    transparent: true,
    opacity: 0.5,
  })
  const innerShell = new THREE.Mesh(innerShellGeo, innerShellMat)
  innerShell.rotation.set(0.3, 0.5, 0.1)
  group.add(innerShell)

  // Interior glow — the captured star
  const glowGeo = new THREE.SphereGeometry(config.radius * 0.5, 32, 32)
  const glowMat = new THREE.MeshBasicMaterial({
    color: config.emissiveColor,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
  })
  group.add(new THREE.Mesh(glowGeo, glowMat))

  // Light from the captured star
  const light = new THREE.PointLight(config.emissiveColor, config.emissiveIntensity, config.radius * 5)
  group.add(light)

  group.userData.update = (_dt: number, elapsed: number) => {
    shell.rotation.y = elapsed * 0.02
    shell.rotation.x = elapsed * 0.01
    innerShell.rotation.y = -elapsed * 0.015
    innerShell.rotation.z = elapsed * 0.008
  }
}

function buildHaloConstruct(config: AlienTechComponent, group: THREE.Group): void {
  // Main ring — massive metallic torus
  const torusGeo = new THREE.TorusGeometry(config.radius, config.radius * 0.08, 32, 128)
  const torusMat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    metalness: config.metalness,
    roughness: config.roughness,
    emissive: new THREE.Color(config.emissiveColor),
    emissiveIntensity: config.emissiveIntensity * 0.2,
  })
  const ring = new THREE.Mesh(torusGeo, torusMat)
  ring.userData.entityId = ''
  ring.rotation.x = Math.PI / 2
  group.add(ring)

  // Surface detail — smaller rings inside
  for (let i = 0; i < 3; i++) {
    const detailGeo = new THREE.TorusGeometry(
      config.radius * (0.85 - i * 0.1),
      config.radius * 0.01,
      8,
      64
    )
    const detailMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      metalness: 0.9,
      roughness: 0.2,
      emissive: new THREE.Color(config.emissiveColor),
      emissiveIntensity: config.emissiveIntensity * 0.1,
    })
    const detail = new THREE.Mesh(detailGeo, detailMat)
    detail.rotation.x = Math.PI / 2
    group.add(detail)
  }

  // Energy field in the center
  const fieldGeo = new THREE.CircleGeometry(config.radius * 0.7, 64)
  const fieldMat = new THREE.MeshBasicMaterial({
    color: config.emissiveColor,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const field = new THREE.Mesh(fieldGeo, fieldMat)
  field.rotation.x = Math.PI / 2
  group.add(field)

  // Subtle rotation
  group.userData.update = (_dt: number, elapsed: number) => {
    ring.rotation.z = elapsed * 0.005
  }
}

/** Default alien tech config */
export function defaultAlienTechConfig(variant: AlienTechComponent['variant'] = 'dyson-sphere'): AlienTechComponent {
  return {
    type: 'alien-tech',
    variant,
    radius: 2.5,
    detail: 2,
    metalness: 0.8,
    roughness: 0.3,
    emissiveColor: variant === 'dyson-sphere' ? '#ffaa44' : '#44aaff',
    emissiveIntensity: 1.5,
  }
}
