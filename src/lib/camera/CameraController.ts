import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// ─── Constants ─────────────────────────────────────────────────────────────

/** Object occupying less than this fraction of viewport triggers System switch */
export const SYSTEM_THRESHOLD_RATIO = 0.05

/** Target fraction of viewport the focused body should fill in Body studio */
const BODY_FRAMING_FILL = 0.6

/** Camera transition duration in seconds */
const TRANSITION_DURATION = 1.0

// ─── Pure Math Functions (exported for testing) ────────────────────────────

/** Compute camera distance to frame an object at a target viewport fraction */
export function computeFramingDistance(
  objectRadius: number,
  fovDegrees: number,
  viewportFraction: number
): number {
  const halfFovRad = (fovDegrees / 2) * (Math.PI / 180)
  const halfHeight = Math.tan(halfFovRad)
  return objectRadius / (viewportFraction * halfHeight)
}

/** Linear interpolation between two [x,y,z] tuples */
export function lerpVector3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

/** Check if focused object is small enough to trigger System studio */
export function shouldSwitchToSystem(
  objectRadius: number,
  cameraDistance: number,
  fovDegrees: number
): boolean {
  const halfFovRad = (fovDegrees / 2) * (Math.PI / 180)
  const viewportHalfAngle = halfFovRad
  const objectAngle = Math.atan(objectRadius / cameraDistance)
  const fraction = objectAngle / viewportHalfAngle
  return fraction < SYSTEM_THRESHOLD_RATIO
}

// ─── CameraController Class ────────────────────────────────────────────────

interface FocusTarget {
  entityId: string
  position: THREE.Vector3
  radius: number
}

export class CameraController {
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private currentFocus: FocusTarget | null = null

  // Transition state
  private transitioning = false
  private transitionElapsed = 0
  private transitionDuration = TRANSITION_DURATION
  private startPosition = new THREE.Vector3()
  private startTarget = new THREE.Vector3()
  private endPosition = new THREE.Vector3()
  private endTarget = new THREE.Vector3()

  // Follow mode: continuously track a moving entity after transition completes
  private followObject: THREE.Object3D | null = null
  private followOffset = new THREE.Vector3()

  constructor(camera: THREE.PerspectiveCamera, controls: OrbitControls) {
    this.camera = camera
    this.controls = controls
  }

  /** Get the currently focused entity ID */
  getFocusedEntityId(): string | null {
    return this.currentFocus?.entityId ?? null
  }

  /** Animate camera to focus on a target entity and follow it */
  focusOn(entityId: string, worldPosition: THREE.Vector3, objectRadius: number, object?: THREE.Object3D): void {
    this.currentFocus = { entityId, position: worldPosition.clone(), radius: objectRadius }

    const distance = computeFramingDistance(objectRadius, this.camera.fov, BODY_FRAMING_FILL)

    // Camera end position: offset from target along current view direction
    const direction = new THREE.Vector3()
    direction.subVectors(this.camera.position, this.controls.target).normalize()
    if (direction.length() < 0.01) direction.set(0, 0.3, 1).normalize()

    this.startPosition.copy(this.camera.position)
    this.startTarget.copy(this.controls.target)
    this.endTarget.copy(worldPosition)
    this.endPosition.copy(worldPosition).addScaledVector(direction, distance)

    // Set up follow mode — camera will track this object after transition
    this.followObject = object ?? null
    this.followOffset.copy(direction).multiplyScalar(distance)

    this.transitioning = true
    this.transitionElapsed = 0
  }

  /** Animate camera to show a system (pull out to see all children orbits) */
  showSystem(centerPosition: THREE.Vector3, maxOrbitRadius: number, follow?: THREE.Object3D): void {
    const systemRadius = maxOrbitRadius * 1.3 // Margin to show full orbits

    const direction = new THREE.Vector3()
    direction.subVectors(this.camera.position, this.controls.target).normalize()
    if (direction.length() < 0.01) direction.set(0, 0.5, 1).normalize()

    // Elevate slightly for an angled top-down view
    direction.y = Math.max(direction.y, 0.4)
    direction.normalize()

    // Compute distance accounting for the elevation angle —
    // the orbit lies in the XZ plane, so what matters is the projected horizontal distance
    const horizontalComponent = Math.sqrt(1 - direction.y * direction.y)
    const distance = computeFramingDistance(systemRadius, this.camera.fov, 0.85) * horizontalComponent

    this.currentFocus = { entityId: follow ? '__follow_system__' : '__system__', position: centerPosition.clone(), radius: systemRadius }
    this.followObject = follow ?? null
    this.followOffset.copy(direction).multiplyScalar(distance)

    this.startPosition.copy(this.camera.position)
    this.startTarget.copy(this.controls.target)
    this.endTarget.copy(centerPosition)
    this.endPosition.copy(centerPosition).addScaledVector(direction, distance)

    this.transitioning = true
    this.transitionElapsed = 0
  }

  /** Check if current zoom level should trigger a studio change */
  checkStudioThreshold(): 'system' | 'body' | null {
    if (!this.currentFocus) return null
    const distance = this.camera.position.distanceTo(this.currentFocus.position)
    if (shouldSwitchToSystem(this.currentFocus.radius, distance, this.camera.fov)) {
      return 'system'
    }
    return null
  }

  /** Call every frame from the animation loop */
  update(dt: number): void {
    // Follow mode is handled in postUpdate (after OrbitControls)
    if (!this.transitioning && this.followObject) {
      this.controls.enableDamping = false
      return
    }

    // Re-enable damping when not following
    if (!this.controls.enableDamping) {
      this.controls.enableDamping = true
    }

    if (!this.transitioning) return

    this.transitionElapsed += dt
    const rawT = Math.min(this.transitionElapsed / this.transitionDuration, 1)

    // Smooth ease-in-out (cubic)
    const t = rawT < 0.5
      ? 4 * rawT * rawT * rawT
      : 1 - Math.pow(-2 * rawT + 2, 3) / 2

    // During transition, if following a moving object, update end targets
    if (this.followObject) {
      const worldPos = new THREE.Vector3()
      this.followObject.getWorldPosition(worldPos)
      this.endTarget.copy(worldPos)
      this.endPosition.copy(worldPos).add(this.followOffset)
    }

    this.camera.position.lerpVectors(this.startPosition, this.endPosition, t)
    this.controls.target.lerpVectors(this.startTarget, this.endTarget, t)

    if (rawT >= 1) {
      this.transitioning = false
      // Update orbit controls limits based on focused object
      if (this.currentFocus) {
        this.controls.minDistance = this.currentFocus.radius * 1.5
        this.controls.maxDistance = this.currentFocus.radius * 200
      }
      // Sync follow position so delta tracking starts from the correct spot
      if (this.followObject && this.currentFocus) {
        this.followObject.getWorldPosition(this.currentFocus.position)
      }
    }
  }

  /** Call AFTER controls.update() — applies follow offset without jitter */
  postUpdate(): void {
    if (this.transitioning || !this.followObject || !this.currentFocus) return

    const worldPos = new THREE.Vector3()
    this.followObject.getWorldPosition(worldPos)

    const delta = new THREE.Vector3().subVectors(worldPos, this.currentFocus.position)
    this.currentFocus.position.copy(worldPos)

    // Shift both together AFTER OrbitControls has finished its update
    this.controls.target.add(delta)
    this.camera.position.add(delta)
  }

  /** Whether a camera transition is currently in progress */
  isTransitioning(): boolean {
    return this.transitioning
  }
}
