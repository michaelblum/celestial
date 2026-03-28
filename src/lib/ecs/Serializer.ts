import type { SceneData, Entity, StudioScale } from './types'
import { SceneGraph } from './SceneGraph'

const CURRENT_VERSION = '2.0.0'

/** Serialize a SceneGraph to a JSON-ready SceneData object */
export function serializeScene(
  graph: SceneGraph,
  name: string,
  studio: StudioScale,
  camera?: { position: [number, number, number]; target: [number, number, number] }
): SceneData {
  const entities: Record<string, Entity> = {}

  for (const [id, entity] of graph.entities) {
    // Deep clone to avoid serializing runtime references
    entities[id] = {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      parentId: entity.parentId,
      childIds: [...entity.childIds],
      components: JSON.parse(JSON.stringify(entity.components)),
    }

    // Strip runtime-only fields from impostor component
    if (entities[id].components['impostor']) {
      delete (entities[id].components['impostor'] as any).texture
    }
  }

  return {
    version: CURRENT_VERSION,
    name,
    studio,
    entities,
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      camera,
    },
  }
}

/** Deserialize a SceneData object into a SceneGraph */
export function deserializeScene(data: SceneData): {
  graph: SceneGraph
  name: string
  studio: StudioScale
  camera?: { position: [number, number, number]; target: [number, number, number] }
} {
  if (!data.version || !data.version.startsWith('2.')) {
    throw new Error(`Unsupported scene version: ${data.version}. Expected 2.x.x`)
  }

  const graph = new SceneGraph()

  // First pass: create all entities without parent links
  for (const [id, entity] of Object.entries(data.entities)) {
    const e: Entity = {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      parentId: entity.parentId,
      childIds: [...entity.childIds],
      components: JSON.parse(JSON.stringify(entity.components)),
    }
    graph.entities.set(id, e)
  }

  return {
    graph,
    name: data.name,
    studio: data.studio,
    camera: data.metadata?.camera,
  }
}

/** Download scene as a JSON file */
export function downloadScene(data: SceneData): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${data.name.replace(/\s+/g, '-').toLowerCase()}.celestial.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Load scene from a File input */
export async function loadSceneFile(file: File): Promise<SceneData> {
  const text = await file.text()
  const data = JSON.parse(text) as SceneData
  if (!data.version || !data.entities) {
    throw new Error('Invalid Celestial scene file')
  }
  return data
}
