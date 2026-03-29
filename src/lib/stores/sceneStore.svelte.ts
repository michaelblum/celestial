import * as THREE from 'three'
import { SceneGraph } from '@lib/ecs/SceneGraph'
import type { Entity, EntityType, Component, StudioScale, StarComponent, PlanetComponent, NebulaComponent, GalaxyComponent } from '@lib/ecs/types'
import { serializeScene, deserializeScene, downloadScene, loadSceneFile } from '@lib/ecs/Serializer'
import { getEngine, getCameraController } from './engineStore.svelte'
import { generateStar, defaultStarConfig } from '@lib/generators/StarGenerator'
import { generatePlanet, defaultPlanetConfig, createColorRampTexture } from '@lib/generators/PlanetGenerator'
import { generateNebula, defaultNebulaConfig } from '@lib/generators/NebulaGenerator'
import { generateAlienTech, defaultAlienTechConfig } from '@lib/generators/AlienTechGenerator'
import { generateGalaxy, defaultGalaxyConfig } from '@lib/generators/GalaxyGenerator'
import { createOrbitPath, getOrbitalPosition, defaultOrbitalConfig } from '@lib/generators/OrbitalSystem'
import { LODManager } from '@lib/impostor/LODManager'
import { luminosity, isBlackHole, orbitalPeriod, escapeVelocity } from '@lib/physics/PhysicsProperties'
import { updateOrbitMarker } from './selectionStore.svelte'
import { advanceSimTime, getTimeScale } from './timeStore.svelte'
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

/** Update a top-level entity field (mass, size, velocity) with cascading physics effects */
export function updateEntityField(entityId: string, field: 'mass' | 'size' | 'velocity', value: number): void {
  const entity = graph.get(entityId)
  if (!entity) return

  entity[field] = value

  // Cascade 1: Star luminosity → corona uniforms
  if (entity.type === 'star' && (field === 'mass' || field === 'size')) {
    const starComp = entity.components['star'] as StarComponent | undefined
    if (starComp) {
      const lum = luminosity(entity.mass)
      // Scale corona intensity from luminosity (log scale for usable range)
      const logLum = lum > 0 ? Math.log10(lum) : 0
      const coronaIntensity = Math.max(0.1, Math.min(3.0, logLum * 0.15))
      const updated = { ...starComp, coronaIntensity }
      updateComponent(entityId, updated)
      syncComponentToThreeObject(entityId, 'star')
    }
  }

  // Cascade 2: Black hole auto-detection
  if (entity.type === 'star' && (field === 'mass' || field === 'size')) {
    const starComp = entity.components['star'] as StarComponent | undefined
    if (starComp) {
      const shouldBeBlackHole = isBlackHole(entity.mass, entity.size)
      const isCurrentlyBlackHole = starComp.variant === 'black-hole'
      if (shouldBeBlackHole !== isCurrentlyBlackHole) {
        const newVariant = shouldBeBlackHole ? 'black-hole' : 'main-sequence'
        const updated = { ...starComp, variant: newVariant }
        updateComponent(entityId, updated)
        regenerateEntity(entityId)
      }
    }
  }

  // Cascade 3: Parent mass/size change → recalculate child orbital periods
  if (field === 'mass') {
    for (const childId of entity.childIds) {
      const child = graph.get(childId)
      if (!child) continue
      const orbital = child.components['orbital'] as OrbitalComponent | undefined
      if (orbital) {
        const newPeriod = orbitalPeriod(entity.mass, orbital.orbitRadius)
        const updated = { ...orbital, period: newPeriod }
        graph.setComponent(childId, updated)
        syncComponentToThreeObject(childId, 'orbital')
      }
    }
  }

  sync()
}

/** Sync an ECS component change to the live Three.js object */
export function syncComponentToThreeObject(entityId: string, componentType: string): void {
  const entity = graph.get(entityId)
  if (!entity) return
  const obj = threeObjects.get(entityId)
  if (!obj) return

  const findShaderMaterials = (): THREE.ShaderMaterial[] => {
    const mats: THREE.ShaderMaterial[] = []
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.ShaderMaterial) {
        mats.push(child.material)
      }
    })
    return mats
  }

  const findStandardMaterials = (): THREE.MeshStandardMaterial[] => {
    const mats: THREE.MeshStandardMaterial[] = []
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        mats.push(child.material)
      }
    })
    return mats
  }

  // Star live updates
  if (componentType === 'star') {
    const comp = entity.components['star'] as StarComponent | undefined
    if (!comp) return
    const shaderMats = findShaderMaterials()
    for (const mat of shaderMats) {
      if (mat.uniforms['temperature']) mat.uniforms['temperature'].value = comp.temperature
      if (mat.uniforms['surfaceDetail']) mat.uniforms['surfaceDetail'].value = comp.surfaceDetail
      if (mat.uniforms['intensity']) mat.uniforms['intensity'].value = comp.coronaIntensity
      if (mat.uniforms['reach']) mat.uniforms['reach'].value = comp.coronaReach
    }
    return
  }

  // Planet live updates
  if (componentType === 'planet') {
    const comp = entity.components['planet'] as PlanetComponent | undefined
    if (!comp) return
    const shaderMats = findShaderMaterials()
    for (const mat of shaderMats) {
      if (mat.uniforms['noiseScale']) mat.uniforms['noiseScale'].value = comp.noiseScale
      if (mat.uniforms['noiseOctaves']) mat.uniforms['noiseOctaves'].value = comp.noiseOctaves
      if (mat.uniforms['roughness']) mat.uniforms['roughness'].value = comp.roughness
      if (mat.uniforms['colorRamp']) {
        const oldTexture = mat.uniforms['colorRamp'].value as THREE.DataTexture
        oldTexture?.dispose()
        mat.uniforms['colorRamp'].value = createColorRampTexture(comp.colorRamp)
      }
      if (mat.uniforms['atmosphereColor']) {
        mat.uniforms['atmosphereColor'].value = new THREE.Color(comp.atmosphereColor)
      }
      if (mat.uniforms['density']) mat.uniforms['density'].value = comp.atmosphereDensity
    }
    return
  }

  // Nebula live updates
  if (componentType === 'nebula') {
    const comp = entity.components['nebula'] as NebulaComponent | undefined
    if (!comp) return
    const shaderMats = findShaderMaterials()
    for (const mat of shaderMats) {
      if (mat.uniforms['color1']) mat.uniforms['color1'].value = new THREE.Color(comp.colorPrimary)
      if (mat.uniforms['color2']) mat.uniforms['color2'].value = new THREE.Color(comp.colorSecondary)
      if (mat.uniforms['opacity']) mat.uniforms['opacity'].value = comp.density
      if (mat.uniforms['lightColor']) mat.uniforms['lightColor'].value = new THREE.Color(comp.lightColor)
      if (mat.uniforms['lightIntensity']) mat.uniforms['lightIntensity'].value = comp.lightIntensity
    }
    return
  }

  // Alien Tech live updates
  if (componentType === 'alien-tech') {
    const comp = entity.components['alien-tech'] as AlienTechComponent | undefined
    if (!comp) return
    const stdMats = findStandardMaterials()
    for (const mat of stdMats) {
      mat.metalness = comp.metalness
      mat.roughness = comp.roughness
      mat.emissive = new THREE.Color(comp.emissiveColor)
      mat.emissiveIntensity = comp.emissiveIntensity
    }
    return
  }

  // Orbital live updates
  if (componentType === 'orbital') {
    const comp = entity.components['orbital'] as OrbitalComponent | undefined
    if (!comp) return

    // Recalculate period from parent mass + orbit radius
    if (entity.parentId) {
      const parentEntity = graph.get(entity.parentId)
      if (parentEntity) {
        const newPeriod = orbitalPeriod(parentEntity.mass, comp.orbitRadius)
        if (Math.abs(comp.period - newPeriod) > 0.01) {
          comp.period = newPeriod
          graph.setComponent(entityId, comp)
        }
      }
    }

    // Determine orbit path color: red if velocity > escape velocity
    let pathColor = 0x334466
    if (entity.parentId) {
      const parentEntity = graph.get(entity.parentId)
      if (parentEntity && entity.velocity > 0) {
        const ev = escapeVelocity(parentEntity.mass, parentEntity.size)
        if (entity.velocity > ev) {
          pathColor = 0xff4444
        }
      }
    }

    const engine = getEngine()
    if (!engine) return
    const parent = entity.parentId ? threeObjects.get(entity.parentId) : engine.scene
    if (!parent) return
    const toRemove: THREE.Object3D[] = []
    parent.traverse((child) => {
      if (child instanceof THREE.Line && child.userData.orbitFor === entityId) {
        toRemove.push(child)
      }
    })
    toRemove.forEach((child) => {
      child.removeFromParent()
      if (child instanceof THREE.Line) {
        child.geometry.dispose()
        ;(child.material as THREE.Material).dispose()
      }
    })
    const path = createOrbitPath(comp, pathColor)
    path.userData.orbitFor = entityId
    if (entity.parentId) {
      const parentObj = threeObjects.get(entity.parentId)
      if (parentObj) parentObj.add(path)
      else engine.scene.add(path)
    } else {
      engine.scene.add(path)
    }
    return
  }

  // Galaxy — full regeneration
  if (componentType === 'galaxy') {
    regenerateEntity(entityId)
    return
  }
}

/** Regenerate the Three.js object for an entity (full rebuild) */
export function regenerateEntity(entityId: string): void {
  const entity = graph.get(entityId)
  if (!entity) return
  const obj = threeObjects.get(entityId)
  if (!obj) return

  if (lodManager) lodManager.unregister(entityId)

  obj.removeFromParent()
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
      child.geometry.dispose()
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose())
      } else {
        child.material.dispose()
      }
    }
  })

  const newObj = buildThreeObject(entity)
  newObj.name = entityId

  const t = entity.components['transform']
  if (t && t.type === 'transform') {
    newObj.position.set(...t.position)
    newObj.rotation.set(...t.rotation)
    newObj.scale.set(...t.scale)
  }

  const engine = getEngine()
  if (entity.parentId) {
    const parentObj = threeObjects.get(entity.parentId)
    if (parentObj) parentObj.add(newObj)
    else engine?.scene.add(newObj)
  } else {
    engine?.scene.add(newObj)
  }

  threeObjects.set(entityId, newObj)

  if (lodManager) lodManager.register(entityId, newObj, true)
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
  let group: THREE.Group

  // Star
  if (type === 'star') {
    const starComp = (entity.components['star'] as StarComponent) ?? defaultStarConfig()
    if (!entity.components['star']) entity.components['star'] = starComp
    group = generateStar(starComp)
    // Tag meshes with entityId for raycasting
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.userData.entityId = entity.id
    })

  // Planet
  } else if (type === 'planet' || type === 'moon') {
    const planetComp = (entity.components['planet'] as PlanetComponent) ?? defaultPlanetConfig()
    if (!entity.components['planet']) entity.components['planet'] = planetComp
    group = generatePlanet(planetComp)
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.userData.entityId = entity.id
    })

  // Nebula
  } else if (type === 'nebula') {
    const nebulaComp = (entity.components['nebula'] as NebulaComponent) ?? defaultNebulaConfig()
    if (!entity.components['nebula']) entity.components['nebula'] = nebulaComp
    group = generateNebula(nebulaComp)
    group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) child.userData.entityId = entity.id
    })

  // Galaxy
  } else if (type === 'galaxy') {
    const galaxyComp = (entity.components['galaxy'] as GalaxyComponent) ?? {
      type: 'galaxy' as const,
      ...defaultGalaxyConfig(),
    }
    if (!entity.components['galaxy']) entity.components['galaxy'] = galaxyComp
    group = generateGalaxy(galaxyComp)
    group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) child.userData.entityId = entity.id
    })

  // Alien Tech
  } else if (type === 'alien-tech') {
    const techComp = (entity.components['alien-tech'] as AlienTechComponent) ?? defaultAlienTechConfig()
    if (!entity.components['alien-tech']) entity.components['alien-tech'] = techComp
    group = generateAlienTech(techComp)
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.userData.entityId = entity.id
    })

  // Fallback: placeholder icosahedron
  } else {
    group = new THREE.Group()
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
  }

  // Add invisible bounding sphere to ALL entities (transparent so raycasting still works)
  const boundRadius = entity.size ?? 1.0
  const boundGeo = new THREE.SphereGeometry(boundRadius, 8, 6)
  const boundMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const boundMesh = new THREE.Mesh(boundGeo, boundMat)
  boundMesh.name = 'bounding-sphere'
  boundMesh.userData.entityId = entity.id
  boundMesh.userData.isBoundingSphere = true
  group.add(boundMesh)

  return group
}

/** Register animation tick — call once after engine is ready */
export function registerAnimationTick(): void {
  const engine = getEngine()
  if (!engine) return

  // Initialize LOD Manager
  lodManager = new LODManager(engine.renderer, engine.scene, engine.camera)

  // Register camera follow postUpdate (runs after controls.update, before render)
  engine.onPostUpdate(() => {
    const camController = getCameraController()
    if (camController) camController.postUpdate()
  })

  engine.onTick((_dt, _rawElapsed) => {
    // Advance simulation time (respects pause and time scale)
    const simDt = _dt * getTimeScale()
    const simElapsed = advanceSimTime(_dt)

    // Update entity shader uniforms + animations
    for (const [id, obj] of threeObjects) {
      if (obj.userData.update) {
        obj.userData.update(simDt, simElapsed, engine.camera)
      }

      // Orbital animation: entities with orbital component orbit their parent
      const entity = graph.get(id)
      if (entity?.components['orbital']) {
        const orbital = entity.components['orbital'] as OrbitalComponent
        const pos = getOrbitalPosition(orbital, simElapsed)

        // Planet is a Three.js child of its parent, so position is in local coords
        obj.position.copy(pos)
      }

      // Update planet/moon light position from nearest star ancestor (world-space)
      if (entity?.parentId && (entity.type === 'planet' || entity.type === 'moon')) {
        // Walk up the hierarchy to find the star
        let starEntity = entity
        let starObj: THREE.Object3D | undefined
        while (starEntity.parentId) {
          const parent = graph.get(starEntity.parentId)
          if (!parent) break
          starEntity = parent
          if (parent.type === 'star') {
            starObj = threeObjects.get(parent.id)
            break
          }
        }
        // Fallback: use direct parent if no star found
        if (!starObj) starObj = threeObjects.get(entity.parentId)
        if (starObj) {
          const starWorldPos = new THREE.Vector3()
          starObj.getWorldPosition(starWorldPos)
          obj.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.ShaderMaterial) {
              if (child.material.uniforms['lightPosition']) {
                child.material.uniforms['lightPosition'].value.copy(starWorldPos)
              }
            }
          })
        }
      }
    }

    // Update orbit hover marker (follows orbiting planet)
    updateOrbitMarker(_dt)

    // Update LOD transitions
    if (lodManager) {
      lodManager.update(_dt)
    }

    // Check if zoom level should trigger studio switch (skip during transitions)
    const camController = getCameraController()
    if (camController && activeStudio === 'body' && !camController.isTransitioning()) {
      const studioSwitch = camController.checkStudioThreshold()
      if (studioSwitch === 'system') {
        // Find the focused entity's parent to show system view
        const focusedId = camController.getFocusedEntityId()
        if (focusedId) {
          const focused = graph.get(focusedId)
          const parentId = focused?.parentId ?? focusedId
          enterSystemStudio(parentId)
        }
      }
    }
  })
}

/** Get the LOD manager instance */
export function getLODManager(): LODManager | null {
  return lodManager
}

/** Get the visual bounding radius of an entity's Three.js object */
export function getEntityVisualRadius(entityId: string): number {
  const obj = threeObjects.get(entityId)
  if (!obj) return 1.0
  const box = new THREE.Box3().setFromObject(obj)
  const size = new THREE.Vector3()
  box.getSize(size)
  return Math.max(size.x, size.y, size.z) / 2
}

/** Switch to System studio — pull camera out to show all children orbits */
export function enterSystemStudio(parentEntityId: string): void {
  const entity = graph.get(parentEntityId)
  if (!entity) return

  const parentObj = threeObjects.get(parentEntityId)
  if (!parentObj) return

  const camController = getCameraController()
  if (!camController) return

  // Find the max orbit radius among children
  let maxOrbitRadius = 5
  for (const childId of entity.childIds) {
    const child = graph.get(childId)
    if (child?.components['orbital']) {
      const orbital = child.components['orbital'] as OrbitalComponent
      if (orbital.orbitRadius > maxOrbitRadius) {
        maxOrbitRadius = orbital.orbitRadius
      }
    }
  }

  const worldPos = new THREE.Vector3()
  parentObj.getWorldPosition(worldPos)
  camController.showSystem(worldPos, maxOrbitRadius)
  activeStudio = 'star-system'
  sync()
}

/** Switch to Body studio — focus on a specific entity */
export function enterBodyStudio(entityId: string): void {
  const obj = threeObjects.get(entityId)
  if (!obj) return

  const camController = getCameraController()
  if (!camController) return

  const worldPos = new THREE.Vector3()
  obj.getWorldPosition(worldPos)
  const radius = getEntityVisualRadius(entityId)
  camController.focusOn(entityId, worldPos, radius)
  activeStudio = 'body'
  sync()
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getEntityColor(type: EntityType): number {
  switch (type) {
    case 'star': return 0xffcc44
    case 'planet': return 0x4488ff
    case 'moon': return 0x888888
    case 'nebula': return 0xff44aa
    case 'galaxy': return 0xaabb44
    case 'oort-cloud': return 0x446688
    case 'alien-tech': return 0x44ffaa
    case 'placeholder': return 0x666666
  }
}
