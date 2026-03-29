import * as THREE from 'three'
import pointCloudVert from './pointCloud.vert'
import pointCloudFrag from './pointCloud.frag'

// ─── Types ──────────────────────────────────────────────────────────────────

export type BodyLODLevel = 0 | 1 | 2 | 3

interface BodyLODEntry {
  entityId: string
  color: THREE.Color
  sizeHint: number       // base point size for LOD3
  currentLevel: BodyLODLevel
  heroGroup: THREE.Group | null    // LOD 0: full procedural shader mesh
  // LOD 1, 2 meshes created on demand
}

// ─── Distance Thresholds ────────────────────────────────────────────────────

const LOD_THRESHOLDS = {
  /** Below this distance: LOD 0 (hero shader) */
  heroDistance: 2.0,
  /** Below this distance: LOD 1 (low-poly 3D) */
  lowPolyDistance: 15.0,
  /** Below this distance: LOD 2 (billboard sprite) */
  spriteDistance: 60.0,
  /** Above spriteDistance: LOD 3 (points cloud) */
}

// ─── BodyLODManager ─────────────────────────────────────────────────────────

export class BodyLODManager {
  private entries = new Map<string, BodyLODEntry>()
  private scene: THREE.Scene

  // Points cloud (LOD 3) — single shared object for all distant bodies
  private pointsGeometry: THREE.BufferGeometry
  private pointsMaterial: THREE.ShaderMaterial
  private pointsObject: THREE.Points
  private maxPoints: number

  // Buffer arrays (pre-allocated, updated per frame)
  private positionArray: Float32Array
  private colorArray: Float32Array
  private sizeArray: Float32Array
  private activePointCount = 0

  constructor(scene: THREE.Scene, maxBodies: number = 256) {
    this.scene = scene
    this.maxPoints = maxBodies

    // Pre-allocate typed arrays
    this.positionArray = new Float32Array(maxBodies * 3)
    this.colorArray = new Float32Array(maxBodies * 3)
    this.sizeArray = new Float32Array(maxBodies)

    // Create buffer geometry with attributes
    this.pointsGeometry = new THREE.BufferGeometry()
    this.pointsGeometry.setAttribute('position', new THREE.BufferAttribute(this.positionArray, 3))
    this.pointsGeometry.setAttribute('color', new THREE.BufferAttribute(this.colorArray, 3))
    this.pointsGeometry.setAttribute('size', new THREE.BufferAttribute(this.sizeArray, 1))

    // ShaderMaterial for colored, distance-attenuated point sprites
    this.pointsMaterial = new THREE.ShaderMaterial({
      vertexShader: pointCloudVert,
      fragmentShader: pointCloudFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this.pointsObject = new THREE.Points(this.pointsGeometry, this.pointsMaterial)
    this.pointsObject.frustumCulled = false
    this.pointsObject.name = 'body-points-cloud'
    this.scene.add(this.pointsObject)
  }

  /** Register a body for LOD management */
  register(entityId: string, heroGroup: THREE.Group | null, color: string, sizeHint: number): void {
    this.entries.set(entityId, {
      entityId,
      color: new THREE.Color(color),
      sizeHint,
      currentLevel: 3,  // start in points cloud
      heroGroup,
    })

    // Hide hero group initially (LOD 3 = points cloud)
    if (heroGroup) heroGroup.visible = false
  }

  /** Unregister a body */
  unregister(entityId: string): void {
    this.entries.delete(entityId)
  }

  /**
   * Update all body LOD levels based on camera position.
   * Called once per frame from the animation loop.
   * Returns a map of entityId → current LOD level for the caller to use.
   */
  update(camera: THREE.Camera, getWorldPosition: (id: string) => THREE.Vector3 | null): Map<string, BodyLODLevel> {
    const camPos = camera.position
    const levels = new Map<string, BodyLODLevel>()
    let pointIdx = 0

    for (const [id, entry] of this.entries) {
      const worldPos = getWorldPosition(id)
      if (!worldPos) continue

      const dist = camPos.distanceTo(worldPos)
      let level: BodyLODLevel

      if (dist < LOD_THRESHOLDS.heroDistance) {
        level = 0
      } else if (dist < LOD_THRESHOLDS.lowPolyDistance) {
        level = 1
      } else if (dist < LOD_THRESHOLDS.spriteDistance) {
        level = 2
      } else {
        level = 3
      }

      // Transition visibility
      if (level !== entry.currentLevel) {
        this.transitionLevel(entry, level)
        entry.currentLevel = level
      }

      // If LOD 3, write to points cloud buffer
      if (level === 3 && pointIdx < this.maxPoints) {
        const base3 = pointIdx * 3
        this.positionArray[base3] = worldPos.x
        this.positionArray[base3 + 1] = worldPos.y
        this.positionArray[base3 + 2] = worldPos.z
        this.colorArray[base3] = entry.color.r
        this.colorArray[base3 + 1] = entry.color.g
        this.colorArray[base3 + 2] = entry.color.b
        this.sizeArray[pointIdx] = entry.sizeHint
        pointIdx++
      }

      levels.set(id, level)
    }

    // Update draw range and flag buffers dirty
    this.pointsGeometry.setDrawRange(0, pointIdx)
    this.pointsGeometry.attributes.position.needsUpdate = true
    if (pointIdx !== this.activePointCount) {
      this.pointsGeometry.attributes.color.needsUpdate = true
      this.pointsGeometry.attributes.size.needsUpdate = true
    }
    this.activePointCount = pointIdx

    return levels
  }

  private transitionLevel(entry: BodyLODEntry, newLevel: BodyLODLevel): void {
    // For Phase 1: only LOD 0 (hero) and LOD 3 (points) are implemented.
    // LOD 1 and 2 fall through to LOD 0 if hero exists, else LOD 3.
    if (entry.heroGroup) {
      entry.heroGroup.visible = newLevel <= 2
    }
  }

  dispose(): void {
    this.scene.remove(this.pointsObject)
    this.pointsGeometry.dispose()
    this.pointsMaterial.dispose()
  }
}
