import * as THREE from 'three'
import { SceneGraph } from '@lib/ecs/SceneGraph'
import type { Entity, EntityType, Component, StudioScale } from '@lib/ecs/types'
import { serializeScene, deserializeScene, downloadScene, loadSceneFile } from '@lib/ecs/Serializer'
import { getEngine } from './engineStore.svelte'

// ─── Reactive State ─────────────────────────────────────────────────────────

const graph = new SceneGraph()

let entities = $state<Entity[]>([])
let sceneName = $state('Untitled Scene')
let activeStudio = $state<StudioScale>('body')

/** Map of entityId → THREE.Object3D for the live scene */
const threeObjects = new Map<string, THREE.Object3D>()

// ─── Sync Helper ────────────────────────────────────────────────────────────

/** Refresh the reactive entity list from the graph */
function sync() {
  entities = [...graph.entities.values()]
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function getEntities(): Entity[] {
  return entities
}

export function getSceneName(): string {
  return sceneName
}

export function setSceneName(name: string) {
  sceneName = name
}

export function getActiveStudio(): StudioScale {
  return activeStudio
}

export function setActiveStudio(studio: StudioScale) {
  activeStudio = studio
}

export function getGraph(): SceneGraph {
  return graph
}

/** Add an entity to the scene */
export function addEntity(
  type: EntityType,
  name?: string,
  parentId?: string | null,
  components?: Record<string, Component>
): Entity {
  const entity = graph.createEntity(type, name, parentId, components)

  // Create a placeholder Three.js object
  const group = new THREE.Group()
  group.name = entity.id

  // Apply transform if present
  const t = entity.components['transform']
  if (t && t.type === 'transform') {
    group.position.set(...t.position)
    group.rotation.set(...t.rotation)
    group.scale.set(...t.scale)
  }

  // Add a visible placeholder mesh (small icosahedron)
  const geo = new THREE.IcosahedronGeometry(0.8, 1)
  const mat = new THREE.MeshStandardMaterial({
    color: getEntityColor(type),
    roughness: 0.4,
    metalness: 0.3,
    emissive: getEntityColor(type),
    emissiveIntensity: 0.15,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.userData.entityId = entity.id
  group.add(mesh)

  // Add to parent or scene root
  const engine = getEngine()
  if (parentId) {
    const parentObj = threeObjects.get(parentId)
    if (parentObj) {
      parentObj.add(group)
    } else {
      engine?.scene.add(group)
    }
  } else {
    engine?.scene.add(group)
  }

  threeObjects.set(entity.id, group)
  sync()
  return entity
}

/** Remove an entity from the scene */
export function removeEntity(id: string): void {
  // Remove Three.js objects for this entity and descendants
  const removeThreeObj = (entityId: string) => {
    const entity = graph.get(entityId)
    if (entity) {
      for (const childId of entity.childIds) {
        removeThreeObj(childId)
      }
    }
    const obj = threeObjects.get(entityId)
    if (obj) {
      obj.removeFromParent()
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose())
          } else {
            child.material.dispose()
          }
        }
      })
      threeObjects.delete(entityId)
    }
  }

  removeThreeObj(id)
  graph.removeEntity(id)
  sync()
}

/** Duplicate an entity */
export function duplicateEntity(id: string): Entity | undefined {
  const clone = graph.duplicate(id)
  if (!clone) return undefined

  // TODO: Build Three.js objects for clone (will use generators in Phase 2)
  // For now, create a placeholder
  const source = threeObjects.get(id)
  if (source) {
    const group = source.clone()
    group.name = clone.id
    group.position.x += 2 // Offset so it's visible
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.userData.entityId = clone.id
      }
    })
    const engine = getEngine()
    engine?.scene.add(group)
    threeObjects.set(clone.id, group)
  }

  sync()
  return clone
}

/** Update a component on an entity and sync to Three.js */
export function updateComponent(entityId: string, component: Component): void {
  graph.setComponent(entityId, component)

  // Sync transform to Three.js
  if (component.type === 'transform') {
    const obj = threeObjects.get(entityId)
    if (obj) {
      obj.position.set(...component.position)
      obj.rotation.set(...component.rotation)
      obj.scale.set(...component.scale)
    }
  }

  sync()
}

/** Get the Three.js object for an entity */
export function getThreeObject(entityId: string): THREE.Object3D | undefined {
  return threeObjects.get(entityId)
}

/** Save the current scene to a JSON file */
export function saveScene(): void {
  const engine = getEngine()
  const camera = engine
    ? {
        position: engine.camera.position.toArray() as [number, number, number],
        target: engine.controls.target.toArray() as [number, number, number],
      }
    : undefined

  const data = serializeScene(graph, sceneName, activeStudio, camera)
  downloadScene(data)
}

/** Load a scene from a file */
export async function loadScene(file: File): Promise<void> {
  const data = await loadSceneFile(file)
  const { graph: newGraph, name, studio, camera } = deserializeScene(data)

  // Clear current scene
  clearScene()

  // Restore state
  sceneName = name
  activeStudio = studio

  // Copy entities from deserialized graph
  for (const [id, entity] of newGraph.entities) {
    graph.entities.set(id, entity)

    // Create placeholder Three.js objects
    // (Phase 2 will use generators to build proper meshes)
    const group = new THREE.Group()
    group.name = entity.id

    const t = entity.components['transform']
    if (t && t.type === 'transform') {
      group.position.set(...t.position)
      group.rotation.set(...t.rotation)
      group.scale.set(...t.scale)
    }

    const geo = new THREE.IcosahedronGeometry(0.8, 1)
    const mat = new THREE.MeshStandardMaterial({
      color: getEntityColor(entity.type),
      roughness: 0.4,
      metalness: 0.3,
      emissive: getEntityColor(entity.type),
      emissiveIntensity: 0.15,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.userData.entityId = entity.id
    group.add(mesh)

    const engine = getEngine()
    if (entity.parentId) {
      const parentObj = threeObjects.get(entity.parentId)
      if (parentObj) parentObj.add(group)
      else engine?.scene.add(group)
    } else {
      engine?.scene.add(group)
    }

    threeObjects.set(entity.id, group)
  }

  // Restore camera
  if (camera) {
    const engine = getEngine()
    if (engine) {
      engine.camera.position.set(...camera.position)
      engine.controls.target.set(...camera.target)
    }
  }

  sync()
}

/** Clear the entire scene */
export function clearScene(): void {
  for (const [id] of threeObjects) {
    const obj = threeObjects.get(id)
    if (obj) {
      obj.removeFromParent()
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose())
          } else {
            child.material.dispose()
          }
        }
      })
    }
  }
  threeObjects.clear()
  graph.clear()
  sync()
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getEntityColor(type: EntityType): number {
  switch (type) {
    case 'star': return 0xffcc44
    case 'planet': return 0x4488ff
    case 'moon': return 0x888888
    case 'nebula': return 0xff44aa
    case 'oort-cloud': return 0x446688
    case 'alien-tech': return 0x44ffaa
    case 'placeholder': return 0x666666
  }
}
