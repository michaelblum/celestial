import * as THREE from 'three'
import { getThreeObject, getEntityVisualRadius } from './sceneStore.svelte'
import { getEngine, getCameraController } from './engineStore.svelte'
import { setActivePanel, setSidebarOpen } from './uiStore.svelte'

// ─── Reactive State ─────────────────────────────────────────────────────────

let selectedId = $state<string | null>(null)
let hoveredId = $state<string | null>(null)

// Track highlight state to restore materials
let highlightedMesh: THREE.Mesh | null = null
let originalEmissiveIntensity: number = 0

// ─── Orbit Hover Marker (downward tetrahedron) ─────────────────────────────

let orbitMarker: THREE.Mesh | null = null
let orbitMarkerEntityId: string | null = null

function getOrCreateMarker(scene: THREE.Scene): THREE.Mesh {
  if (orbitMarker) return orbitMarker

  // Downward-pointing tetrahedron (3-sided pyramid)
  const geo = new THREE.ConeGeometry(0.3, 0.6, 3)
  geo.rotateX(Math.PI)
  geo.translate(0, 0.35, 0)

  // 3D lit material — receives light from the star, with emissive glow to stay visible
  const mat = new THREE.MeshStandardMaterial({
    color: 0xaa66ff,
    metalness: 0.7,
    roughness: 0.2,
    emissive: 0x8844ff,
    emissiveIntensity: 0.6,
  })

  orbitMarker = new THREE.Mesh(geo, mat)
  orbitMarker.name = 'orbit-hover-marker'
  orbitMarker.userData.isMarker = true
  orbitMarker.visible = false
  scene.add(orbitMarker)
  return orbitMarker
}

/** Get the entity ID the marker is tracking */
export function getMarkerEntityId(): string | null {
  return orbitMarkerEntityId
}

/** Update the orbit hover marker position each frame (call from tick loop) */
export function updateOrbitMarker(dt: number): void {
  if (!orbitMarker || !orbitMarkerEntityId) return

  // Hide if the tracked entity is selected (camera focuses on it)
  if (orbitMarkerEntityId === selectedId) {
    orbitMarker.visible = false
    orbitMarkerEntityId = null
    return
  }

  const obj = getThreeObject(orbitMarkerEntityId)
  if (!obj) {
    orbitMarker.visible = false
    return
  }

  const worldPos = new THREE.Vector3()
  obj.getWorldPosition(worldPos)

  const engine = getEngine()
  if (!engine) return

  // Scale based on camera distance for consistent screen size
  const camDist = engine.camera.position.distanceTo(worldPos)
  const scale = camDist * 0.04
  orbitMarker.scale.setScalar(scale)

  // Position just a hair above the orbit path line
  orbitMarker.position.copy(worldPos)
  orbitMarker.position.y += scale * 0.15

  // Slow rotation on vertical axis
  orbitMarker.rotation.y += dt * 1.5
}

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

    // Focus camera on selected entity and follow it
    const camController = getCameraController()
    const obj = getThreeObject(entityId)
    if (camController && obj) {
      const worldPos = new THREE.Vector3()
      obj.getWorldPosition(worldPos)
      const radius = getEntityVisualRadius(entityId)
      camController.focusOn(entityId, worldPos, radius, obj)
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

  // Get all meshes with entityId or marker flag
  const meshes: THREE.Object3D[] = []
  engine.scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh && (obj.userData.entityId || obj.userData.isMarker)) {
      meshes.push(obj)
    }
  })

  const intersects = raycaster.intersectObjects(meshes, false)

  if (intersects.length > 0) {
    const hit = intersects[0].object
    // If the marker was clicked, select the entity it's tracking
    if (hit.userData.isMarker && orbitMarkerEntityId) {
      select(orbitMarkerEntityId)
    } else {
      const entityId = hit.userData.entityId as string
      select(entityId)
    }
  } else {
    clearSelection()
    setSidebarOpen(false)
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

  // Find orbit path lines and the marker mesh
  const lines: THREE.Object3D[] = []
  const markers: THREE.Object3D[] = []
  engine.scene.traverse((obj) => {
    if (obj instanceof THREE.Line && obj.name === 'orbit-path') {
      lines.push(obj)
    }
    if (obj instanceof THREE.Mesh && obj.userData.isMarker) {
      markers.push(obj)
    }
  })

  const lineIntersects = raycaster.intersectObjects(lines, false)
  const markerIntersects = raycaster.intersectObjects(markers, false)

  // Hovering the orbit line OR the marker keeps everything active
  const hoveringOrbit = lineIntersects.length > 0
  const hoveringMarker = markerIntersects.length > 0 && orbitMarkerEntityId !== null

  // Reset all orbit paths to default appearance
  engine.scene.traverse((obj) => {
    if (obj instanceof THREE.Line && obj.name === 'orbit-path') {
      const mat = obj.material as THREE.LineBasicMaterial
      mat.opacity = 0.5
      mat.color.setHex(0x4466aa)
    }
  })

  if (hoveringOrbit || hoveringMarker) {
    // Highlight the orbit path
    if (hoveringOrbit) {
      const hitLine = lineIntersects[0].object as THREE.Line
      const mat = hitLine.material as THREE.LineBasicMaterial
      mat.opacity = 0.8
      mat.color.setHex(0x8844ff)

      // Track which entity this orbit belongs to
      const entityId = hitLine.userData.orbitFor
      if (entityId) {
        hover(entityId)
        const marker = getOrCreateMarker(engine.scene)
        orbitMarkerEntityId = entityId
        marker.visible = true
        updateOrbitMarker(0)
      }
    } else if (hoveringMarker && orbitMarkerEntityId) {
      // Mouse moved onto marker — keep orbit highlighted
      hover(orbitMarkerEntityId)
      // Find and highlight the associated orbit path
      engine.scene.traverse((obj) => {
        if (obj instanceof THREE.Line && obj.name === 'orbit-path' && obj.userData.orbitFor === orbitMarkerEntityId) {
          const mat = obj.material as THREE.LineBasicMaterial
          mat.opacity = 0.8
          mat.color.setHex(0x8844ff)
        }
      })
    }
  } else {
    hover(null)

    // Hide marker
    if (orbitMarker) {
      orbitMarker.visible = false
      orbitMarkerEntityId = null
    }
  }
}
