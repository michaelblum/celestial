import * as THREE from 'three'
import { ImpostorBaker } from './ImpostorBaker'
import { BillboardRenderer } from './BillboardRenderer'
import { ShroudTransition } from './ShroudTransition'

export interface LODEntity {
  entityId: string
  /** The live-rendered Three.js group (full shader detail) */
  liveGroup: THREE.Object3D
  /** The billboard sprite (cheap impostor) */
  billboard: THREE.Sprite | null
  /** The shroud transition effect */
  shroud: ShroudTransition
  /** The apparent radius for distance calculations */
  radius: number
  /** Current LOD state */
  state: 'live' | 'billboard' | 'transitioning-in' | 'transitioning-out'
}

/**
 * Manages Level of Detail for all entities in the scene.
 *
 * Rules:
 * - Only ONE entity can be live-rendered at a time (performance budget)
 * - All other entities show their baked billboard impostor
 * - Approaching an entity triggers a shroud transition (billboard → live)
 * - Retreating triggers the reverse (live → billboard)
 */
export class LODManager {
  private entities: Map<string, LODEntity> = new Map()
  private baker: ImpostorBaker
  private scene: THREE.Scene
  private camera: THREE.Camera

  /** Distance threshold for triggering live render */
  approachDistance: number = 15
  /** Distance threshold for switching back to billboard */
  retreatDistance: number = 25

  /** Currently live-rendered entity ID (null = none) */
  private liveEntityId: string | null = null

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.baker = new ImpostorBaker(renderer)
    this.scene = scene
    this.camera = camera
  }

  /**
   * Register an entity for LOD management.
   * Initially renders as billboard (baked from current state).
   */
  register(entityId: string, liveGroup: THREE.Object3D, startLive: boolean = false): void {
    const radius = ImpostorBaker.getApparentRadius(liveGroup)

    const shroud = new ShroudTransition(radius * 1.5, 400)
    this.scene.add(shroud.group)

    const lodEntity: LODEntity = {
      entityId,
      liveGroup,
      billboard: null,
      shroud,
      radius,
      state: startLive ? 'live' : 'live', // Start live, will bake on first update
    }

    this.entities.set(entityId, lodEntity)

    if (startLive) {
      this.liveEntityId = entityId
    }
  }

  /**
   * Bake an entity to billboard and hide its live render.
   */
  bakeAndSwitch(entityId: string): void {
    const entity = this.entities.get(entityId)
    if (!entity) return

    // Bake current visual to texture
    const renderTarget = this.baker.bake(entity.liveGroup, 512)

    // Create billboard
    if (entity.billboard) BillboardRenderer.dispose(entity.billboard)
    entity.billboard = BillboardRenderer.create(renderTarget, entity.radius, entityId)

    // Position billboard at same location as live group
    entity.billboard.position.copy(entity.liveGroup.position)
    this.scene.add(entity.billboard)

    // Hide live render
    entity.liveGroup.visible = false
    entity.state = 'billboard'

    if (this.liveEntityId === entityId) {
      this.liveEntityId = null
    }
  }

  /**
   * Per-frame update — check distances and manage transitions.
   */
  update(dt: number): void {
    const cameraPos = this.camera.position

    for (const [entityId, entity] of this.entities) {
      // Update shroud animation
      entity.shroud.update(dt)

      // Position shroud at entity location
      entity.shroud.group.position.copy(entity.liveGroup.position)

      // Handle transition completion
      if (entity.state === 'transitioning-in' && !entity.shroud.isActive()) {
        // Reveal complete — live object is now visible
        entity.state = 'live'
        this.liveEntityId = entityId
        if (entity.billboard) {
          entity.billboard.visible = false
        }
      }

      if (entity.state === 'transitioning-out' && !entity.shroud.isActive()) {
        // Conceal complete — switch to billboard
        entity.liveGroup.visible = false
        entity.state = 'billboard'
        if (entity.billboard) {
          entity.billboard.visible = true
        }
        if (this.liveEntityId === entityId) {
          this.liveEntityId = null
        }
      }

      // Distance-based LOD switching
      if (entity.state === 'billboard' || entity.state === 'live') {
        const entityPos = entity.liveGroup.position
        const dist = cameraPos.distanceTo(entityPos)

        if (entity.state === 'billboard' && dist < this.approachDistance) {
          // Camera approaching — transition to live render
          // But only if no other entity is live
          if (this.liveEntityId === null || this.liveEntityId === entityId) {
            this.transitionToLive(entityId)
          }
        } else if (entity.state === 'live' && dist > this.retreatDistance && this.entities.size > 1) {
          // Camera retreating — transition to billboard
          this.transitionToBillboard(entityId)
        }
      }
    }
  }

  /** Trigger transition from billboard to live render */
  private transitionToLive(entityId: string): void {
    const entity = this.entities.get(entityId)
    if (!entity) return

    // If another entity is live, bake it first
    if (this.liveEntityId && this.liveEntityId !== entityId) {
      this.bakeAndSwitch(this.liveEntityId)
    }

    entity.state = 'transitioning-in'
    entity.liveGroup.visible = true
    entity.shroud.startReveal()
  }

  /** Trigger transition from live render to billboard */
  private transitionToBillboard(entityId: string): void {
    const entity = this.entities.get(entityId)
    if (!entity) return

    // Re-bake before switching (capture current visual state)
    const renderTarget = this.baker.bake(entity.liveGroup, 512)
    if (entity.billboard) BillboardRenderer.dispose(entity.billboard)
    entity.billboard = BillboardRenderer.create(renderTarget, entity.radius, entityId)
    entity.billboard.position.copy(entity.liveGroup.position)
    entity.billboard.visible = false // Will show when conceal completes
    this.scene.add(entity.billboard)

    entity.state = 'transitioning-out'
    entity.shroud.startConceal()
  }

  /** Unregister an entity from LOD management */
  unregister(entityId: string): void {
    const entity = this.entities.get(entityId)
    if (!entity) return

    if (entity.billboard) BillboardRenderer.dispose(entity.billboard)
    entity.shroud.dispose()
    this.entities.delete(entityId)

    if (this.liveEntityId === entityId) {
      this.liveEntityId = null
    }
  }

  /** Get the currently live entity ID */
  getLiveEntityId(): string | null {
    return this.liveEntityId
  }

  /** Clean up everything */
  dispose(): void {
    for (const [id] of this.entities) {
      this.unregister(id)
    }
  }
}
