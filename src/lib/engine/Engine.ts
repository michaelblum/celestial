import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { generateStar, defaultStarConfig } from '@lib/generators/StarGenerator'

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
      100000
    )
    this.camera.position.set(0, 5, 25)

    // OrbitControls with damping
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.autoRotate = false
    this.controls.maxDistance = Infinity
    this.controls.minDistance = 0.5

    // Clock for delta time
    this.clock = new THREE.Clock()

    // Background sky — always visible static star canvas
    this.createBackgroundSky()
    // Neighbor star — a real 3D object you can fly to
    this.createNeighborStar()

    // Add minimal lighting
    const ambient = new THREE.AmbientLight(0x222233, 0.5)
    this.scene.add(ambient)
  }

  /** Static background sky — always-visible distant stars, follows camera like a skybox */
  private createBackgroundSky(): void {
    const count = 5000
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const r = 900
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // Power-law brightness + size — most dim and tiny, few bright and large
      const mag = Math.pow(Math.random(), 3)
      const brightness = 0.12 + mag * 0.88
      sizes[i] = 0.5 + mag * 2.5 // 0.5px to 3.0px — bright stars are bigger

      const warmth = Math.random()
      if (warmth > 0.95) {
        colors[i * 3] = brightness
        colors[i * 3 + 1] = brightness * 0.9
        colors[i * 3 + 2] = brightness * 0.7
      } else if (warmth > 0.9) {
        colors[i * 3] = brightness * 0.75
        colors[i * 3 + 1] = brightness * 0.85
        colors[i * 3 + 2] = brightness
      } else {
        colors[i * 3] = brightness
        colors[i * 3 + 1] = brightness
        colors[i * 3 + 2] = brightness
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    // Custom shader to support per-vertex size WITHOUT sizeAttenuation
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float aSize;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          // Soft circle falloff
          float d = length(gl_PointCoord - vec2(0.5));
          float alpha = 1.0 - smoothstep(0.3, 0.5, d);
          gl_FragColor = vec4(vColor, alpha * 0.9);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    })

    const sky = new THREE.Points(geometry, material)
    sky.name = 'background-sky'
    sky.frustumCulled = false
    sky.renderOrder = -1
    this.scene.add(sky)
  }

  /** Create a real neighbor star just off the zoom vector — fly right past it */
  private createNeighborStar(): void {
    // Pick a random spectral class for variety
    const classes = ['F', 'G', 'K', 'M']
    const spectral = classes[Math.floor(Math.random() * classes.length)]
    const config = defaultStarConfig(spectral)

    const starGroup = generateStar(config)
    starGroup.name = 'neighbor-star'

    // Small lateral offset from zoom vector — stays in FOV for ~15 scroll events
    // Camera zooms along (0, 0.196, 0.981), so place it slightly to the right
    starGroup.position.set(300, 2500, 15000)

    // Tag all meshes for raycasting
    starGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.userData.entityId = '__neighbor_star__'
      }
    })

    this.scene.add(starGroup)

    // Register its animation in the tick loop
    this.onTick((_dt, elapsed) => {
      if (starGroup.userData.update) {
        starGroup.userData.update(_dt, elapsed, this.camera)
      }
    })
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

      // Background sky follows camera — always at infinity
      const bgSky = this.scene.getObjectByName('background-sky')
      if (bgSky) bgSky.position.copy(this.camera.position)

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
