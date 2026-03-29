import { PLANETS, MOONS, DEBRIS_VOLUMES, COMETS, SUN_CONFIG } from './SolarSystemData'
import { toSceneRadius, toSceneOrbit, toSceneMoonOrbit, toScenePeriodYears, toScenePeriod } from './ScalePolicy'
import { addEntity, enterSystemStudio, getBodyLODManager } from '@lib/stores/sceneStore.svelte'
import { defaultStarConfig } from '@lib/generators/StarGenerator'
import type {
  PlanetComponent, OrbitalComponent, PhysicalDataComponent,
  DebrisVolumeComponent, CometComponent,
} from '@lib/ecs/types'

/**
 * SolarSystemLoader — creates the full Solar System as the default scene.
 * Call once after engine init when the scene is empty.
 */
export function loadSolarSystem(): void {
  // ── 1. Sun ──
  const starConfig = {
    ...defaultStarConfig(SUN_CONFIG.spectralClass),
    radius: SUN_CONFIG.radius,
    temperature: SUN_CONFIG.temperature,
    coronaIntensity: SUN_CONFIG.coronaIntensity,
    coronaReach: SUN_CONFIG.coronaReach,
    surfaceDetail: SUN_CONFIG.surfaceDetail,
  }

  const sun = addEntity('star', SUN_CONFIG.name, null, {
    star: starConfig,
  })
  sun.mass = SUN_CONFIG.mass
  sun.size = SUN_CONFIG.size

  const lodMgr = getBodyLODManager()

  // ── 2. Planets + Dwarf Planets ──
  const planetEntityMap = new Map<string, string>()  // planet name → entityId

  for (const p of PLANETS) {
    const sceneRadius = toSceneRadius(p.radiusKm)
    const orbitRadius = toSceneOrbit(p.orbitAu)
    const period = toScenePeriodYears(p.periodYears)

    const planetComp: PlanetComponent = {
      type: 'planet',
      variant: p.variant,
      radius: sceneRadius,
      colorRamp: p.colorRamp,
      roughness: p.roughness,
      noiseScale: p.noiseScale,
      noiseOctaves: 4,
      atmosphereEnabled: p.atmosphereEnabled,
      atmosphereColor: p.atmosphereColor,
      atmosphereDensity: p.atmosphereDensity,
      ringEnabled: false,
      ringInnerRadius: 0,
      ringOuterRadius: 0,
      ringSegments: 0,
      moonCount: 0,
      axisTilt: p.axisTiltDeg,
      rotationSpeed: 0.1,
    }

    const orbitalComp: OrbitalComponent = {
      type: 'orbital',
      orbitRadius,
      period,
      inclination: p.inclinationDeg,
      eccentricity: p.eccentricity,
      phase: Math.random() * Math.PI * 2,
    }

    const physicalComp: PhysicalDataComponent = {
      type: 'physical',
      radiusKm: p.radiusKm,
      semiMajorAxisAu: p.orbitAu,
      orbitalPeriodDays: p.periodYears * 365.25,
      eccentricity: p.eccentricity,
      inclinationDeg: p.inclinationDeg,
      axisTiltDeg: p.axisTiltDeg,
    }

    const entity = addEntity(p.entityType, p.name, sun.id, {
      planet: planetComp,
      orbital: orbitalComp,
      physical: physicalComp,
    })

    planetEntityMap.set(p.name, entity.id)

    // Register with LOD manager
    lodMgr?.register(entity.id, null, p.pointColor, sceneRadius * 100)
  }

  // ── 3. Moons ──
  for (const m of MOONS) {
    const parentId = planetEntityMap.get(m.parent)
    if (!parentId) continue

    const parentData = PLANETS.find(p => p.name === m.parent)
    if (!parentData) continue

    const sceneRadius = toSceneRadius(m.radiusKm)
    const orbitRadius = toSceneMoonOrbit(m.orbitRadiusKm, parentData.radiusKm)
    const period = toScenePeriod(m.periodDays)

    const planetComp: PlanetComponent = {
      type: 'planet',
      variant: m.variant,
      radius: sceneRadius,
      colorRamp: [
        { position: 0, color: '#555555' },
        { position: 0.5, color: m.pointColor },
        { position: 1, color: '#aaaaaa' },
      ],
      roughness: 0.5,
      noiseScale: 4,
      noiseOctaves: 3,
      atmosphereEnabled: false,
      atmosphereColor: '#888888',
      atmosphereDensity: 0,
      ringEnabled: false,
      ringInnerRadius: 0,
      ringOuterRadius: 0,
      ringSegments: 0,
      moonCount: 0,
      axisTilt: 0,
      rotationSpeed: 0.05,
    }

    const orbitalComp: OrbitalComponent = {
      type: 'orbital',
      orbitRadius,
      period,
      inclination: m.inclinationDeg,
      eccentricity: m.eccentricity,
      phase: Math.random() * Math.PI * 2,
    }

    const physicalComp: PhysicalDataComponent = {
      type: 'physical',
      radiusKm: m.radiusKm,
      semiMajorAxisAu: m.orbitRadiusKm / 149597870.7,
      orbitalPeriodDays: m.periodDays,
      eccentricity: m.eccentricity,
      inclinationDeg: m.inclinationDeg,
      axisTiltDeg: 0,
    }

    const entity = addEntity('moon', m.name, parentId, {
      planet: planetComp,
      orbital: orbitalComp,
      physical: physicalComp,
    })

    // Store moon tier on entity for filter lookups
    ;(entity as any).userData = { moonTier: m.tier }

    // Register with LOD manager
    lodMgr?.register(entity.id, null, m.pointColor, sceneRadius * 100)
  }

  // ── 4. Debris Volumes ──
  for (const dv of DEBRIS_VOLUMES) {
    const parentId = dv.parent === 'Sun' ? sun.id : planetEntityMap.get(dv.parent)
    if (!parentId) continue

    const debrisComp: DebrisVolumeComponent = {
      type: 'debris-volume',
      variant: dv.variant,
      profile: dv.profile,
    }

    addEntity('debris-volume', dv.name, parentId, {
      'debris-volume': debrisComp,
    })
  }

  // ── 5. Comets ──
  for (const c of COMETS) {
    const semiMajorAu = Math.pow(c.periodYears, 2 / 3)
    const orbitRadius = toSceneOrbit(semiMajorAu)
    const period = toScenePeriodYears(c.periodYears)

    const cometComp: CometComponent = {
      type: 'comet',
      nucleusRadius: c.nucleusRadius,
      tailLength: c.tailLength,
      tailParticleCount: c.tailParticleCount,
      tailColor: c.tailColor,
      coreColor: c.coreColor,
    }

    const orbitalComp: OrbitalComponent = {
      type: 'orbital',
      orbitRadius,
      period,
      inclination: c.inclinationDeg,
      eccentricity: c.eccentricity,
      phase: Math.random() * Math.PI * 2,
    }

    const entity = addEntity('comet', c.name, sun.id, {
      comet: cometComp,
      orbital: orbitalComp,
    })

    lodMgr?.register(entity.id, null, c.pointColor, 3.0)
  }

  // ── 6. Camera ──
  enterSystemStudio(sun.id)
}
