import * as THREE from 'three'
import { getThreeObject, getEntityVisualRadius } from './sceneStore.svelte'
import { getEngine, getCameraController } from './engineStore.svelte'
import { setActivePanel } from './uiStore.svelte'

// ─── Reactive State ─────────────────────────────────────────────────────────

let selectedId = $state<string | null>(null)
let hoveredId = $state<string | null>(null)

// Track highlight state to restore materials
let highlightedMesh: THREE.Mesh | null = null
let originalEmissiveIntensity: number = 0

// ─── Public API ─────────────────────────────────────────────────────────────

export function getSelectedId(): string | null {
  return selectedId
}

export function getHoveredId(): string | null {
  return hoveredId
}

export function select(entityId: string | null): void {
  // Remove highlight from previous selection
  clearHighlight()

  selectedId = entityId

  // Apply highlight to new selection and show properties
  if (entityId) {
    applyHighlight(entityId)
    setActivePanel('properties')

    // Focus camera on selected entity
    const camController = getCameraController()
    const obj = getThreeObject(entityId)
    if (camController && obj) {
      const worldPos = new THREE.Vector3()
      obj.getWorldPosition(worldPos)
      const radius = getEntityVisualRadius(entityId)
      camController.focusOn(entityId, worldPos, radius)
    }
  }
}

export function hover(entityId: string | null): void {
  hoveredId = entityId
}

export function clearSelection(): void {
  select(null)
}

// ─── Raycasting ─────────────────────────────────────────────────────────────

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

/** Handle click on the viewport canvas to select entities */
export function handleViewportClick(event: MouseEvent): void {
  const engine = getEngine()
  if (!engine) return

  const canvas = engine.renderer.domElement
  const rect = canvas.getBoundingClientRect()

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(pointer, engine.camera)

  // Get all meshes with entityId in userData
  const meshes: THREE.Object3D[] = []
  engine.scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.userData.entityId) {
      meshes.push(obj)
    }
  })

  const intersects = raycaster.intersectObjects(meshes, false)

  if (intersects.length > 0) {
    const hit = intersects[0].object
    const entityId = hit.userData.entityId as string
    select(entityId)
  } else {
    clearSelection()
  }
}

// ─── Highlight Helpers ──────────────────────────────────────────────────────

function applyHighlight(entityId: string): void {
  const obj = getThreeObject(entityId)
  if (!obj) return

  obj.traverse((child) => {
    if (child instanceof THREE.Mesh && !child.userData.isBoundingSphere) {
      if (child.material instanceof THREE.MeshStandardMaterial) {
        highlightedMesh = child
        originalEmissiveIntensity = child.material.emissiveIntensity
        child.material.emissiveIntensity = Math.max(child.material.emissiveIntensity + 0.4, 0.6)
      } else if (child.material instanceof THREE.ShaderMaterial && child.material.uniforms) {
        highlightedMesh = child
        // Store original values for restore
        originalEmissiveIntensity = 0
        // No direct emissive on ShaderMaterial — skip visual highlight for now
        // The bounding sphere selection itself is the feedback
      }
    }
  })
}

function clearHighlight(): void {
  if (highlightedMesh) {
    if (highlightedMesh.material instanceof THREE.MeshStandardMaterial) {
      highlightedMesh.material.emissiveIntensity = originalEmissiveIntensity
    }
  }
  highlightedMesh = null
}

// ─── Orbit Path Hover ──────────────────────────────────────────────────────

/** Handle mouse move on viewport — highlight orbit paths on hover */
export function handleViewportHover(event: MouseEvent): void {
  const engine = getEngine()
  if (!engine) return

  const canvas = engine.renderer.domElement
  const rect = canvas.getBoundingClientRect()

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(pointer, engine.camera)
  raycaster.params.Line = { threshold: 0.5 } // Generous threshold for orbit paths

  // Find orbit path lines
  const lines: THREE.Object3D[] = []
  engine.scene.traverse((obj) => {
    if (obj instanceof THREE.Line && obj.name === 'orbit-path') {
      lines.push(obj)
    }
  })

  const intersects = raycaster.intersectObjects(lines, false)

  // Reset all orbit paths to default appearance
  engine.scene.traverse((obj) => {
    if (obj instanceof THREE.Line && obj.name === 'orbit-path') {
      const mat = obj.material as THREE.LineBasicMaterial
      mat.opacity = 0.25
      mat.color.setHex(0x334466)
    }
  })

  if (intersects.length > 0) {
    const hitLine = intersects[0].object as THREE.Line
    const mat = hitLine.material as THREE.LineBasicMaterial
    mat.opacity = 0.8
    mat.color.setHex(0x8844ff)

    // Find the entity this orbit belongs to
    const entityId = hitLine.userData.orbitFor
    if (entityId) {
      hover(entityId)
    }
  } else {
    hover(null)
  }
}
