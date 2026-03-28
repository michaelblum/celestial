import * as THREE from 'three'

/**
 * A volumetric particle cloud that spawns around an entity to mask
 * the transition between billboard (impostor) and live render.
 *
 * On approach: particles expand outward and dissolve, revealing the live object.
 * On retreat: particles contract inward and densify, hiding the live object.
 */
export class ShroudTransition {
  group: THREE.Group
  particles: THREE.Points
  material: THREE.PointsMaterial
  private positions: Float32Array
  private velocities: Float32Array
  private particleCount: number
  private radius: number
  private progress: number = 0 // 0 = fully shrouded, 1 = fully revealed
  private direction: 'reveal' | 'conceal' = 'reveal'
  private active: boolean = false
  private duration: number

  constructor(
    radius: number = 3,
    particleCount: number = 500,
    color: THREE.Color = new THREE.Color(0x8866aa),
    duration: number = 1.5
  ) {
    this.radius = radius
    this.particleCount = particleCount
    this.duration = duration
    this.group = new THREE.Group()
    this.group.name = 'shroud-transition'

    // Create particles distributed in a shell
    this.positions = new Float32Array(particleCount * 3)
    this.velocities = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      const r = radius * (0.8 + Math.random() * 0.4)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      this.positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      this.positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      this.positions[i * 3 + 2] = r * Math.cos(phi)

      // Outward velocity for reveal
      const speed = 0.5 + Math.random() * 1.0
      this.velocities[i * 3] = (this.positions[i * 3] / r) * speed
      this.velocities[i * 3 + 1] = (this.positions[i * 3 + 1] / r) * speed
      this.velocities[i * 3 + 2] = (this.positions[i * 3 + 2] / r) * speed
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))

    // Soft cloud texture
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 32, 32)

    this.material = new THREE.PointsMaterial({
      color,
      size: radius * 0.3,
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })

    this.particles = new THREE.Points(geometry, this.material)
    this.group.add(this.particles)
    this.group.visible = false
  }

  /** Start a reveal transition (billboard → live) */
  startReveal(): void {
    this.direction = 'reveal'
    this.progress = 0
    this.active = true
    this.group.visible = true
    this.resetPositions()
  }

  /** Start a conceal transition (live → billboard) */
  startConceal(): void {
    this.direction = 'conceal'
    this.progress = 0
    this.active = true
    this.group.visible = true
    this.resetPositions()
  }

  /** Is the transition currently playing? */
  isActive(): boolean {
    return this.active
  }

  /** Has the transition finished? */
  isComplete(): boolean {
    return !this.active && this.progress >= 1
  }

  /** Get the current blend factor (0 = shrouded, 1 = revealed) */
  getRevealFactor(): number {
    if (this.direction === 'reveal') return this.progress
    return 1 - this.progress
  }

  /** Update animation — call each frame */
  update(dt: number): void {
    if (!this.active) return

    this.progress += dt / this.duration
    if (this.progress >= 1) {
      this.progress = 1
      this.active = false
      this.group.visible = false
      return
    }

    const posAttr = this.particles.geometry.attributes.position as THREE.BufferAttribute
    const t = this.direction === 'reveal' ? this.progress : 1 - this.progress

    for (let i = 0; i < this.particleCount; i++) {
      const vx = this.velocities[i * 3]
      const vy = this.velocities[i * 3 + 1]
      const vz = this.velocities[i * 3 + 2]

      // Move particles outward during reveal, inward during conceal
      posAttr.setXYZ(
        i,
        this.positions[i * 3] + vx * t * this.radius * 2,
        this.positions[i * 3 + 1] + vy * t * this.radius * 2,
        this.positions[i * 3 + 2] + vz * t * this.radius * 2
      )
    }

    posAttr.needsUpdate = true

    // Fade opacity: dense at start, transparent at end
    this.material.opacity = 0.6 * (1 - t * t)
  }

  /** Reset particles to their initial shell positions */
  private resetPositions(): void {
    const posAttr = this.particles.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < this.particleCount; i++) {
      posAttr.setXYZ(
        i,
        this.positions[i * 3],
        this.positions[i * 3 + 1],
        this.positions[i * 3 + 2]
      )
    }
    posAttr.needsUpdate = true
    this.material.opacity = 0.6
  }

  /** Clean up */
  dispose(): void {
    this.particles.geometry.dispose()
    this.material.dispose()
    if (this.material.map) this.material.map.dispose()
    this.group.removeFromParent()
  }
}
