import type * as THREE from 'three'

// ─── Gradient ───────────────────────────────────────────────────────────────

export interface GradientStop {
  position: number   // 0–1
  color: string      // hex like '#ff00aa'
}

// ─── Component Types ────────────────────────────────────────────────────────

export interface TransformComponent {
  type: 'transform'
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export interface StarComponent {
  type: 'star'
  spectralClass: 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M'
  variant: 'main-sequence' | 'red-giant' | 'neutron' | 'white-dwarf' | 'black-hole'
  radius: number
  temperature: number
  coronaIntensity: number
  coronaReach: number
  surfaceDetail: number
}

export interface PlanetComponent {
  type: 'planet'
  variant: 'rocky' | 'gas-giant' | 'ice' | 'volcanic'
  radius: number
  colorRamp: GradientStop[]
  roughness: number
  noiseScale: number
  noiseOctaves: number
  atmosphereEnabled: boolean
  atmosphereColor: string
  atmosphereDensity: number
  ringEnabled: boolean
  ringInnerRadius: number
  ringOuterRadius: number
  ringSegments: number
  moonCount: number
}

export interface NebulaComponent {
  type: 'nebula'
  method: 'sprites' | 'volumetric' | 'particles'
  style: 'nebula' | 'smoke' | 'fire' | 'plasma'
  density: number
  scale: number
  colorPrimary: string
  colorSecondary: string
  lightColor: string
  lightIntensity: number
  particleCount: number
}

export interface OrbitalComponent {
  type: 'orbital'
  orbitRadius: number
  period: number
  inclination: number
  eccentricity: number
  phase: number
}

export interface ImpostorComponent {
  type: 'impostor'
  textureSize: number
  baked: boolean
  // Runtime only — not serialized
  texture?: THREE.Texture
}

export interface AlienTechComponent {
  type: 'alien-tech'
  variant: 'dyson-sphere' | 'halo-construct'
  radius: number
  detail: number
  metalness: number
  roughness: number
  emissiveColor: string
  emissiveIntensity: number
}

export interface OortCloudComponent {
  type: 'oort-cloud'
  innerRadius: number
  outerRadius: number
  particleCount: number
  color: string
  opacity: number
}

// ─── Component Union ────────────────────────────────────────────────────────

export type Component =
  | TransformComponent
  | StarComponent
  | PlanetComponent
  | NebulaComponent
  | OrbitalComponent
  | ImpostorComponent
  | AlienTechComponent
  | OortCloudComponent

export type ComponentType = Component['type']

// ─── Entity Types ───────────────────────────────────────────────────────────

export type EntityType =
  | 'star'
  | 'planet'
  | 'moon'
  | 'nebula'
  | 'galaxy'
  | 'oort-cloud'
  | 'alien-tech'
  | 'placeholder'

// ─── Entity ─────────────────────────────────────────────────────────────────

export interface Entity {
  id: string
  name: string
  type: EntityType
  parentId: string | null
  childIds: string[]
  components: Record<string, Component>
}

// ─── Studio / Scale ─────────────────────────────────────────────────────────

export type StudioScale =
  | 'body'
  | 'star-system'
  | 'galaxy'
  | 'cluster'
  | 'universe'

// ─── Scene Schema ───────────────────────────────────────────────────────────

export interface SceneData {
  version: string
  name: string
  studio: StudioScale
  entities: Record<string, Entity>
  metadata: {
    createdAt: string
    updatedAt: string
    camera?: {
      position: [number, number, number]
      target: [number, number, number]
    }
  }
}
