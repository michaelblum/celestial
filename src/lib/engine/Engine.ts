import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export class Engine {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  clock: THREE.Clock

  private animationId: number = 0
  private callbacks: Array<(dt: number, elapsed: number) => void> = []
  private postUpdateCallbacks: Array<() => void> = []

  constructor(canvas: HTMLCanvasElement) {
    // Renderer — antialias on, alpha for compositing, clamp pixel ratio for perf
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0

    // Scene — no fog, space is infinite
    this.scene = new THREE.Scene()

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      10000
    )
    this.camera.position.set(0, 5, 25)

    // OrbitControls with damping
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.autoRotate = false
    this.controls.maxDistance = 500
    this.controls.minDistance = 0.5

    // Clock for delta time
    this.clock = new THREE.Clock()

    // Create starfield (doubles as oort cloud debris) + interstellar scale
    this.createStarfield()
    this.createOortAura()
    this.createInterstellarField()

    // Add minimal lighting
    const ambient = new THREE.AmbientLight(0x222233, 0.5)
    this.scene.add(ambient)
  }

  private createStarfield(): void {
    const count = 5000
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Distribute in a large sphere
      const r = 300 + Math.random() * 700
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // Slight color variation: mostly white, occasional warm/cool tints
      const warmth = Math.random()
      if (warmth > 0.95) {
        // Warm star
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.85 + Math.random() * 0.15
        colors[i * 3 + 2] = 0.7 + Math.random() * 0.2
      } else if (warmth > 0.9) {
        // Cool star
        colors[i * 3] = 0.7 + Math.random() * 0.2
        colors[i * 3 + 1] = 0.8 + Math.random() * 0.2
        colors[i * 3 + 2] = 1.0
      } else {
        // White
        const brightness = 0.8 + Math.random() * 0.2
        colors[i * 3] = brightness
        colors[i * 3 + 1] = brightness
        colors[i * 3 + 2] = brightness
      }

      sizes[i] = 0.3 + Math.random() * 1.0
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const material = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    const stars = new THREE.Points(geometry, material)
    stars.name = 'starfield'
    this.scene.add(stars)
  }

  /** Create the oort cloud aura — a billboard sprite that represents the cloud from outside */
  private createOortAura(): void {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')!

    // Concentrated glow — bright point with faint haze
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
    gradient.addColorStop(0.015, 'rgba(255, 255, 255, 0.6)')
    gradient.addColorStop(0.04, 'rgba(220, 230, 255, 0.15)')
    gradient.addColorStop(0.15, 'rgba(150, 170, 220, 0.03)')
    gradient.addColorStop(0.4, 'rgba(100, 130, 180, 0.005)')
    gradient.addColorStop(1, 'rgba(80, 100, 160, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 128, 128)

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0, // Starts invisible — fades in at interstellar distance
    })
    const sprite = new THREE.Sprite(spriteMat)
    // Match the starfield outer radius — from outside, this IS the oort cloud
    sprite.scale.setScalar(1200)
    sprite.name = 'oort-aura'
    sprite.userData.material = spriteMat // For distance-based opacity in animate loop
    this.scene.add(sprite)
  }

  /** Create the interstellar starfield — the next scale out from the oort cloud */
  private createInterstellarField(): void {
    const count = 5000
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Same style as the inner starfield, but at larger radius
      const r = 2000 + Math.random() * 3000
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      const warmth = Math.random()
      if (warmth > 0.95) {
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.85 + Math.random() * 0.15
        colors[i * 3 + 2] = 0.7 + Math.random() * 0.2
      } else if (warmth > 0.9) {
        colors[i * 3] = 0.7 + Math.random() * 0.2
        colors[i * 3 + 1] = 0.8 + Math.random() * 0.2
        colors[i * 3 + 2] = 1.0
      } else {
        const brightness = 0.8 + Math.random() * 0.2
        colors[i * 3] = brightness
        colors[i * 3 + 1] = brightness
        colors[i * 3 + 2] = brightness
      }

      sizes[i] = 0.3 + Math.random() * 1.0
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const material = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true, // Same style as inner field
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    const stars = new THREE.Points(geometry, material)
    stars.name = 'interstellar-field'
    this.scene.add(stars)
  }

  /** Register a callback to run every frame */
  onTick(callback: (dt: number, elapsed: number) => void): () => void {
    this.callbacks.push(callback)
    return () => {
      const idx = this.callbacks.indexOf(callback)
      if (idx !== -1) this.callbacks.splice(idx, 1)
    }
  }

  /** Register a callback to run after controls.update() but before render */
  onPostUpdate(callback: () => void): () => void {
    this.postUpdateCallbacks.push(callback)
    return () => {
      const idx = this.postUpdateCallbacks.indexOf(callback)
      if (idx !== -1) this.postUpdateCallbacks.splice(idx, 1)
    }
  }

  /** Start the animation loop */
  start(): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate)
      const dt = this.clock.getDelta()
      const elapsed = this.clock.getElapsedTime()

      // Run all registered tick callbacks
      for (const cb of this.callbacks) {
        cb(dt, elapsed)
      }

      this.controls.update()
      for (const cb of this.postUpdateCallbacks) { cb() }

      // Oort aura: fade in based on camera distance from origin
      const oortAura = this.scene.getObjectByName('oort-aura')
      if (oortAura?.userData.material) {
        const dist = this.camera.position.length()
        // Invisible inside the starfield (<800), fades in from 800-2000
        const t = Math.max(0, Math.min(1, (dist - 800) / 1200))
        oortAura.userData.material.opacity = t * 0.8
      }

      this.renderer.render(this.scene, this.camera)
    }
    animate()
  }

  /** Stop the animation loop */
  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = 0
    }
  }

  /** Handle canvas resize */
  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  /** Clean up all resources */
  dispose(): void {
    this.stop()
    this.controls.dispose()
    this.renderer.dispose()
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    })
  }
}
