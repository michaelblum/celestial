import * as THREE from 'three'

export interface GalaxyConfig {
  armCount: number       // 2-6 spiral arms
  twist: number          // How tightly arms spiral (0.2-1.0)
  spread: number         // How scattered stars are off the arm center
  starCount: number      // Total particles (5000-50000)
  radius: number         // Galaxy radius
  bulgeSize: number      // Central bulge relative size (0-1)
  innerColor: string     // Core color (warm)
  outerColor: string     // Arm edge color (cool)
}

/** Generate a procedural spiral galaxy as a GPU particle system */
export function generateGalaxy(config: GalaxyConfig): THREE.Group {
  const group = new THREE.Group()

  const count = config.starCount
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)

  const innerColor = new THREE.Color(config.innerColor)
  const outerColor = new THREE.Color(config.outerColor)

  for (let i = 0; i < count; i++) {
    // Radius: concentrated toward center using power curve
    const radius = Math.pow(Math.random(), 1.5) * config.radius

    // Which arm this star belongs to
    const arm = Math.floor(Math.random() * config.armCount)
    const armAngle = (arm / config.armCount) * Math.PI * 2

    // Spiral twist: more twist at greater radius
    const spiralAngle = armAngle + radius * config.twist

    // Scatter: randomize position off the ideal arm line
    // Less scatter near center (tight bulge), more at edges
    const scatter = config.spread * (radius / config.radius)
    const scatterX = (Math.random() - 0.5) * scatter
    const scatterY = (Math.random() - 0.5) * scatter * 0.15 // Thin disk
    const scatterZ = (Math.random() - 0.5) * scatter

    positions[i * 3] = Math.cos(spiralAngle) * radius + scatterX
    positions[i * 3 + 1] = scatterY
    positions[i * 3 + 2] = Math.sin(spiralAngle) * radius + scatterZ

    // Color: warm at center, cool at edges
    const t = radius / config.radius
    const c = innerColor.clone().lerp(outerColor, t)

    // Slight random variation
    c.r += (Math.random() - 0.5) * 0.1
    c.g += (Math.random() - 0.5) * 0.1
    c.b += (Math.random() - 0.5) * 0.1

    colors[i * 3] = Math.max(0, c.r)
    colors[i * 3 + 1] = Math.max(0, c.g)
    colors[i * 3 + 2] = Math.max(0, c.b)

    // Size: larger near center (bright core stars)
    sizes[i] = (1 - t * 0.7) * (0.5 + Math.random() * 1.5)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

  // Soft circle texture for star points
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 32, 32)

  const material = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })

  const particles = new THREE.Points(geometry, material)
  group.add(particles)

  // Central bulge glow
  const bulgeGeo = new THREE.SphereGeometry(config.radius * config.bulgeSize, 32, 32)
  const bulgeMat = new THREE.MeshBasicMaterial({
    color: config.innerColor,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  group.add(new THREE.Mesh(bulgeGeo, bulgeMat))

  // Slow rotation
  group.userData.update = (_dt: number, elapsed: number) => {
    particles.rotation.y = elapsed * 0.02
  }

  // Tag for raycasting
  group.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
      child.userData.entityId = ''
    }
  })

  return group
}

/** Default galaxy config */
export function defaultGalaxyConfig(): GalaxyConfig {
  return {
    armCount: 2,
    twist: 0.4,
    spread: 3.0,
    starCount: 25000,
    radius: 10,
    bulgeSize: 0.15,
    innerColor: '#ffffcc',
    outerColor: '#4466ff',
  }
}
