import * as THREE from 'three'

/**
 * Creates a camera-facing billboard sprite from a baked texture.
 * Used to represent distant entities cheaply.
 */
export class BillboardRenderer {
  /**
   * Create a billboard sprite from a render target texture.
   */
  static create(
    renderTarget: THREE.WebGLRenderTarget,
    apparentRadius: number,
    entityId: string
  ): THREE.Sprite {
    const material = new THREE.SpriteMaterial({
      map: renderTarget.texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    })

    const sprite = new THREE.Sprite(material)
    const displaySize = apparentRadius * 2.5
    sprite.scale.set(displaySize, displaySize, 1)

    sprite.userData.entityId = entityId
    sprite.userData.isBillboard = true
    sprite.userData.renderTarget = renderTarget

    return sprite
  }

  /**
   * Dispose of a billboard and its render target.
   */
  static dispose(sprite: THREE.Sprite): void {
    if (sprite.material instanceof THREE.SpriteMaterial) {
      sprite.material.dispose()
    }
    if (sprite.userData.renderTarget) {
      (sprite.userData.renderTarget as THREE.WebGLRenderTarget).dispose()
    }
    sprite.removeFromParent()
  }
}
