import type { Entity, EntityType, Component, TransformComponent } from './types'

let idCounter = 0

/** Generate a unique entity ID */
function generateId(): string {
  return `entity-${Date.now().toString(36)}-${(idCounter++).toString(36)}`
}

/** Default transform component */
function defaultTransform(): TransformComponent {
  return {
    type: 'transform',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  }
}

/** Default names by entity type */
const defaultNames: Record<EntityType, string> = {
  star: 'Star',
  planet: 'Planet',
  moon: 'Moon',
  nebula: 'Nebula',
  galaxy: 'Galaxy',
  'oort-cloud': 'Oort Cloud',
  'alien-tech': 'Structure',
  placeholder: 'Object',
}

export class SceneGraph {
  entities: Map<string, Entity> = new Map()

  /** Create a new entity and add it to the graph */
  createEntity(
    type: EntityType,
    name?: string,
    parentId?: string | null,
    components?: Record<string, Component>
  ): Entity {
    const id = generateId()
    const entity: Entity = {
      id,
      name: name ?? `${defaultNames[type]} ${this.entities.size + 1}`,
      type,
      parentId: parentId ?? null,
      childIds: [],
      mass: 1.0,
      size: 1.0,
      components: {
        transform: defaultTransform(),
        ...components,
      },
    }

    this.entities.set(id, entity)

    // Register as child of parent
    if (parentId) {
      const parent = this.entities.get(parentId)
      if (parent && !parent.childIds.includes(id)) {
        parent.childIds.push(id)
      }
    }

    return entity
  }

  /** Remove an entity and all its children recursively */
  removeEntity(id: string): void {
    const entity = this.entities.get(id)
    if (!entity) return

    // Recursively remove children first
    for (const childId of [...entity.childIds]) {
      this.removeEntity(childId)
    }

    // Remove from parent's childIds
    if (entity.parentId) {
      const parent = this.entities.get(entity.parentId)
      if (parent) {
        parent.childIds = parent.childIds.filter((cid) => cid !== id)
      }
    }

    this.entities.delete(id)
  }

  /** Reparent an entity under a new parent (or to root if null) */
  reparent(entityId: string, newParentId: string | null): void {
    const entity = this.entities.get(entityId)
    if (!entity) return

    // Prevent circular reparenting
    if (newParentId && this.isDescendantOf(newParentId, entityId)) return

    // Remove from old parent
    if (entity.parentId) {
      const oldParent = this.entities.get(entity.parentId)
      if (oldParent) {
        oldParent.childIds = oldParent.childIds.filter((cid) => cid !== entityId)
      }
    }

    // Set new parent
    entity.parentId = newParentId
    if (newParentId) {
      const newParent = this.entities.get(newParentId)
      if (newParent && !newParent.childIds.includes(entityId)) {
        newParent.childIds.push(entityId)
      }
    }
  }

  /** Check if `candidateId` is a descendant of `ancestorId` */
  isDescendantOf(candidateId: string, ancestorId: string): boolean {
    let current = this.entities.get(candidateId)
    while (current) {
      if (current.id === ancestorId) return true
      current = current.parentId ? this.entities.get(current.parentId) : undefined
    }
    return false
  }

  /** Get all root entities (no parent) */
  getRoots(): Entity[] {
    return [...this.entities.values()].filter((e) => e.parentId === null)
  }

  /** Get children of an entity */
  getChildren(parentId: string): Entity[] {
    const parent = this.entities.get(parentId)
    if (!parent) return []
    return parent.childIds
      .map((id) => this.entities.get(id))
      .filter((e): e is Entity => e !== undefined)
  }

  /** Get an entity by ID */
  get(id: string): Entity | undefined {
    return this.entities.get(id)
  }

  /** Get a component from an entity */
  getComponent<T extends Component>(entityId: string, componentType: T['type']): T | undefined {
    const entity = this.entities.get(entityId)
    if (!entity) return undefined
    return entity.components[componentType] as T | undefined
  }

  /** Set/update a component on an entity */
  setComponent(entityId: string, component: Component): void {
    const entity = this.entities.get(entityId)
    if (!entity) return
    entity.components[component.type] = component
  }

  /** Duplicate an entity (and optionally its children) */
  duplicate(entityId: string, deep: boolean = true): Entity | undefined {
    const source = this.entities.get(entityId)
    if (!source) return undefined

    const clone = this.createEntity(
      source.type,
      `${source.name} Copy`,
      source.parentId,
      JSON.parse(JSON.stringify(source.components))
    )

    if (deep) {
      for (const childId of source.childIds) {
        const childClone = this.duplicate(childId, true)
        if (childClone) {
          this.reparent(childClone.id, clone.id)
        }
      }
    }

    return clone
  }

  /** Clear the entire scene graph */
  clear(): void {
    this.entities.clear()
  }

  /** Get total entity count */
  get size(): number {
    return this.entities.size
  }
}
