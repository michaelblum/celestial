import * as THREE from 'three'
import { SceneGraph } from '@lib/ecs/SceneGraph'
import type { Entity, EntityType, Component, StudioScale, StarComponent, PlanetComponent, NebulaComponent } from '@lib/ecs/types'
import { serializeScene, deserializeScene, downloadScene, loadSceneFile } from '@lib/ecs/Serializer'
import { getEngine } from './engineStore.svelte'
import { generateStar, defaultStarConfig } from '@lib/generators/StarGenerator'
import { generatePlanet, defaultPlanetConfig } from '@lib/generators/PlanetGenerator'
import { generateNebula, defaultNebulaConfig } from '@lib/generators/NebulaGenerator'
import { generateAlienTech, defaultAlienTechConfig } from '@lib/generators/AlienTechGenerator'
import { createOrbitPath, getOrbitalPosition, defaultOrbitalConfig } from '@lib/generators/OrbitalSystem'
import { LODManager } from '@lib/impostor/LODManager'
import type { AlienTechComponent, OrbitalComponent } from '@lib/ecs/types'

// ─── Reactive State ─────────────────────────────────────────────────────────

const graph = new SceneGraph()

let entities = $state<Entity[]>([])
let sceneName = $state('Untitled Scene')
let activeStudio = $state<StudioScale>('body')
let lodManager: LODManager | null = null

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

  // Build Three.js object via generator or placeholder
  const group = buildThreeObject(entity)
  group.name = entity.id

  // Apply transform if present
  const t = entity.components['transform']
  if (t && t.type === 'transform') {
    group.position.set(...t.position)
    group.rotation.set(...t.rotation)
    group.scale.set(...t.scale)
  }

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

  // Register with LOD manager for impostor transitions
  if (lodManager) {
    lodManager.register(entity.id, group, true)
  }

  sync()
  return entity
}

/** Remove an entity from the scene */
export function removeEntity(id: string): void {
  // Unregister from LOD manager
  if (lodManager) {
    lodManager.unregister(id)
  }

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

// ─── Three.js Object Builder ────────────────────────────────────────────────

function buildThreeObject(entity: Entity): THREE.Group {
  const type = entity.type

  // Star
  if (type === 'star') {
    const starComp = (entity.components['star'] as StarComponent) ?? defaultStarConfig()
    if (!entity.components['star']) entity.components['star'] = starComp
    const group = generateStar(starComp)
    // Tag meshes with entityId for raycasting
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.userData.entityId = entity.id
    })
    return group
  }

  // Planet
  if (type === 'planet' || type === 'moon') {
    const planetComp = (entity.components['planet'] as PlanetComponent) ?? defaultPlanetConfig()
    if (!entity.components['planet']) entity.components['planet'] = planetComp
    const group = generatePlanet(planetComp)
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.userData.entityId = entity.id
    })
    return group
  }

  // Nebula
  if (type === 'nebula') {
    const nebulaComp = (entity.components['nebula'] as NebulaComponent) ?? defaultNebulaConfig()
    if (!entity.components['nebula']) entity.components['nebula'] = nebulaComp
    const group = generateNebula(nebulaComp)
    group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) child.userData.entityId = entity.id
    })
    return group
  }

  // Alien Tech
  if (type === 'alien-tech') {
    const techComp = (entity.components['alien-tech'] as AlienTechComponent) ?? defaultAlienTechConfig()
    if (!entity.components['alien-tech']) entity.components['alien-tech'] = techComp
    const group = generateAlienTech(techComp)
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.userData.entityId = entity.id
    })
    return group
  }

  // Fallback: placeholder icosahedron
  const group = new THREE.Group()
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
  return group
}

/** Register animation tick — call once after engine is ready */
export function registerAnimationTick(): void {
  const engine = getEngine()
  if (!engine) return

  // Initialize LOD Manager
  lodManager = new LODManager(engine.renderer, engine.scene, engine.camera)

  engine.onTick((_dt, elapsed) => {
    // Update entity shader uniforms + animations
    for (const [id, obj] of threeObjects) {
      if (obj.userData.update) {
        obj.userData.update(_dt, elapsed, engine.camera)
      }

      // Orbital animation: entities with orbital component orbit their parent
      const entity = graph.get(id)
      if (entity?.components['orbital']) {
        const orbital = entity.components['orbital'] as OrbitalComponent
        const pos = getOrbitalPosition(orbital, elapsed)

        // Offset relative to parent position
        if (entity.parentId) {
          const parentObj = threeObjects.get(entity.parentId)
          if (parentObj) {
            obj.position.copy(parentObj.position).add(pos)
          } else {
            obj.position.copy(pos)
          }
        } else {
          obj.position.copy(pos)
        }
      }
    }

    // Update LOD transitions
    if (lodManager) {
      lodManager.update(_dt)
    }
  })
}

/** Get the LOD manager instance */
export function getLODManager(): LODManager | null {
  return lodManager
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
