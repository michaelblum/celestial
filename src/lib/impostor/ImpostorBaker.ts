import * as THREE from 'three'

/**
 * Renders a Three.js object group to an off-screen render target,
 * producing a texture that can be used as a billboard impostor.
 */
export class ImpostorBaker {
  private renderer: THREE.WebGLRenderer
  private bakerScene: THREE.Scene
  private bakerCamera: THREE.PerspectiveCamera

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer

    // Isolated scene for baking — no starfield, no other entities
    this.bakerScene = new THREE.Scene()

    // Camera framing the object
    this.bakerCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)

    // Minimal lighting for bake
    this.bakerScene.add(new THREE.AmbientLight(0x333344, 0.5))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
    dirLight.position.set(3, 5, 4)
    this.bakerScene.add(dirLight)
  }

  /**
   * Bake an entity's Three.js group to a texture.
   * Returns a WebGLRenderTarget with the baked texture.
   */
  bake(
    sourceGroup: THREE.Object3D,
    size: number = 512
  ): THREE.WebGLRenderTarget {
    const renderTarget = new THREE.WebGLRenderTarget(size, size, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    })

    // Clone the source into the baker scene
    const clone = sourceGroup.clone(true)
    this.bakerScene.add(clone)

    // Frame the object: compute bounding sphere and position camera
    const box = new THREE.Box3().setFromObject(clone)
    const sphere = new THREE.Sphere()
    box.getBoundingSphere(sphere)

    const fov = this.bakerCamera.fov * (Math.PI / 180)
    const dist = sphere.radius / Math.sin(fov / 2) * 1.2 // 20% padding
    this.bakerCamera.position.set(
      sphere.center.x,
      sphere.center.y,
      sphere.center.z + dist
    )
    this.bakerCamera.lookAt(sphere.center)
    this.bakerCamera.updateProjectionMatrix()

    // Render to the off-screen target
    const prevTarget = this.renderer.getRenderTarget()
    const prevClearAlpha = this.renderer.getClearAlpha()

    this.renderer.setClearAlpha(0) // Transparent background
    this.renderer.setRenderTarget(renderTarget)
    this.renderer.clear()
    this.renderer.render(this.bakerScene, this.bakerCamera)

    // Restore
    this.renderer.setRenderTarget(prevTarget)
    this.renderer.setClearAlpha(prevClearAlpha)

    // Clean up clone
    this.bakerScene.remove(clone)
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose())
        } else {
          child.material.dispose()
        }
      }
    })

    return renderTarget
  }

  /** Get the apparent radius of an object for billboard sizing */
  static getApparentRadius(object: THREE.Object3D): number {
    const box = new THREE.Box3().setFromObject(object)
    const sphere = new THREE.Sphere()
    box.getBoundingSphere(sphere)
    return sphere.radius
  }
}
