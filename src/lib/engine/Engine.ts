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

    // Scene with subtle fog for depth
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x000005, 0.0015)

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      2000
    )
    this.camera.position.set(0, 5, 25)

    // OrbitControls with damping (matches experiment settings)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.autoRotate = true
    this.controls.autoRotateSpeed = 0.3
    this.controls.maxDistance = 500
    this.controls.minDistance = 1

    // Clock for delta time
    this.clock = new THREE.Clock()

    // Create starfield
    this.createStarfield()

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
      const r = 200 + Math.random() * 800
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

      sizes[i] = 0.5 + Math.random() * 1.5
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const material = new THREE.PointsMaterial({
      size: 0.8,
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

  /** Register a callback to run every frame */
  onTick(callback: (dt: number, elapsed: number) => void): () => void {
    this.callbacks.push(callback)
    return () => {
      const idx = this.callbacks.indexOf(callback)
      if (idx !== -1) this.callbacks.splice(idx, 1)
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
