import * as THREE from 'three'

// ─── Coronal Ejection System ─────────────────────────────────────────────────
// Two effects on the star surface:
//
// 1. Coronal ejections — chaotic particle arcs that barely poke out, paired
//    with a bundle of parallel thin line hoops at varying radii.
//    Color is a random mix of warm white and the star's temperature color.
//
// 2. Surface spicules — 2-4 tiny particles that pop straight up from the
//    surface and fall back down. Visible on the face, not just the limb.

const PARTICLES_PER_LOOP = 60
const STRAY_PARTICLES = 8
const TOTAL_PARTICLES = PARTICLES_PER_LOOP + STRAY_PARTICLES
const HOOP_VERTS = 80
const NUM_HOOPS = 7

// Spicule constants
const SPICULE_PARTICLES = 4
const MAX_SPICULES = 6

interface ParticleProps {
  angleOffset: number
  speedMult: number
  radialJitter: number
  lateralJitter: number
  sizeScale: number
  isStray: boolean
  strayDrift: number
  strayAngle: number
  strayStartAngle: number
}

interface HoopLine {
  line: THREE.LineLoop
  radius: number
  posAttr: THREE.BufferAttribute
  alphaAttr: THREE.BufferAttribute
}

interface Ejection {
  direction: THREE.Vector3
  tangent: THREE.Vector3
  bitangent: THREE.Vector3
  loopRadius: number

  phase: 'emerging' | 'active' | 'retreating'
  phaseTime: number
  emergeDuration: number
  activeDuration: number
  retreatDuration: number
  maxEmergence: number

  emergence: number
  flowAngle: number
  opacity: number

  particles: ParticleProps[]
  points: THREE.Points
  posAttr: THREE.BufferAttribute
  alphaAttr: THREE.BufferAttribute
  sizeAttr: THREE.BufferAttribute

  hoops: HoopLine[]
}

interface SpiculeParticle {
  lateralOffset: THREE.Vector3
  speed: number
  sizeScale: number
}

interface Spicule {
  direction: THREE.Vector3
  age: number
  duration: number
  height: number
  particles: SpiculeParticle[]
}

export interface CoronalEjectionConfig {
  starRadius: number
  starColor: THREE.Color
  temperature?: number
  maxActive?: number
  spawnInterval?: [number, number]
}

// ── Temperature to RGB (matches star.frag Planckian locus) ───────────────────

function temperatureToColor(temp: number): THREE.Color {
  const t = Math.max(10, Math.min(400, temp / 100))
  let r: number, g: number, b: number

  if (t <= 66) { r = 1 }
  else { r = Math.max(0, Math.min(1, 1.29293 * Math.pow(t - 60, -0.1332))) }

  if (t <= 66) { g = Math.max(0, Math.min(1, 0.39008 * Math.log(t) - 0.63184)) }
  else { g = Math.max(0, Math.min(1, 1.12989 * Math.pow(t - 60, -0.0755))) }

  if (t >= 66) { b = 1 }
  else if (t <= 19) { b = 0 }
  else { b = Math.max(0, Math.min(1, 0.54320 * Math.log(t - 10) - 1.19625)) }

  return new THREE.Color(r, g, b)
}

export function createCoronalEjectionSystem(config: CoronalEjectionConfig) {
  const {
    starRadius,
    starColor,
    temperature = 5778,
    maxActive = 3,
    spawnInterval = [5, 10],
  } = config

  const group = new THREE.Group()
  const ejections: Ejection[] = []
  let timeSinceSpawn = 0
  let nextDelay = rand(spawnInterval[0], spawnInterval[1])

  // Pre-compute the two color options for ejections
  const warmWhite = starColor.clone().lerp(new THREE.Color(1, 0.85, 0.6), 0.5)
  const tempColor = temperatureToColor(temperature)
  const hoopColor = starColor.clone().lerp(new THREE.Color(1, 0.9, 0.7), 0.4)

  // ── Spicule system ─────────────────────────────────────────────────────────

  const spicules: Spicule[] = []
  let spiculeTimer = 0
  let nextSpiculeDelay = rand(0.2, 0.6)

  const maxSpiculeParticles = MAX_SPICULES * SPICULE_PARTICLES
  const spPositions = new Float32Array(maxSpiculeParticles * 3)
  const spAlphas = new Float32Array(maxSpiculeParticles)
  const spSizes = new Float32Array(maxSpiculeParticles)
  const spGeo = new THREE.BufferGeometry()
  const spPosAttr = new THREE.BufferAttribute(spPositions, 3)
  const spAlphaAttr = new THREE.BufferAttribute(spAlphas, 1)
  const spSizeAttr = new THREE.BufferAttribute(spSizes, 1)
  spGeo.setAttribute('position', spPosAttr)
  spGeo.setAttribute('alpha', spAlphaAttr)
  spGeo.setAttribute('size', spSizeAttr)

  const spBasePtSize = Math.max(1.2, starRadius * 0.04)
  const spMat = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: warmWhite.clone() },
      globalOpacity: { value: 1.0 },
      basePtSize: { value: spBasePtSize },
    },
    vertexShader: /* glsl */ `
      attribute float alpha;
      attribute float size;
      uniform float basePtSize;
      varying float vAlpha;
      void main() {
        vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(basePtSize * size * (400.0 / -mv.z), 1.0, 8.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float globalOpacity;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float glow = 1.0 - smoothstep(0.0, 0.5, d);
        glow *= glow;
        gl_FragColor = vec4(color, glow * vAlpha * globalOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const spPoints = new THREE.Points(spGeo, spMat)
  group.add(spPoints)

  function spawnSpicule(cameraDir: THREE.Vector3) {
    // Allow full camera-facing hemisphere including the face (not just edges)
    let dir: THREE.Vector3
    do {
      dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ).normalize()
    } while (dir.dot(cameraDir) < -0.1) // allow everything except far backside

    const count = 2 + Math.floor(Math.random() * 3) // 2-4
    const particles: SpiculeParticle[] = []
    for (let i = 0; i < count; i++) {
      const lateral = new THREE.Vector3(
        rand(-1, 1), rand(-1, 1), rand(-1, 1)
      ).projectOnPlane(dir).multiplyScalar(starRadius * 0.008)
      particles.push({
        lateralOffset: lateral,
        speed: rand(0.7, 1.3),
        sizeScale: rand(0.6, 1.4),
      })
    }

    spicules.push({
      direction: dir,
      age: 0,
      duration: rand(0.4, 1.2),
      height: starRadius * rand(0.03, 0.06), // taller: 3-6% of radius
      particles,
    })
  }

  function tickSpicules(dt: number, cameraDir: THREE.Vector3) {
    spiculeTimer += dt
    if (spiculeTimer >= nextSpiculeDelay && spicules.length < MAX_SPICULES) {
      spawnSpicule(cameraDir)
      spiculeTimer = 0
      nextSpiculeDelay = rand(0.2, 0.6)
    }

    spPositions.fill(0)
    spAlphas.fill(0)
    spSizes.fill(0)

    let idx = 0
    for (let s = spicules.length - 1; s >= 0; s--) {
      const sp = spicules[s]
      sp.age += dt
      if (sp.age >= sp.duration) {
        spicules.splice(s, 1)
        continue
      }

      const t = sp.age / sp.duration
      const heightT = 4 * t * (1 - t) // parabolic: peaks at t=0.5

      for (const p of sp.particles) {
        if (idx >= maxSpiculeParticles) break
        const h = sp.height * heightT * p.speed
        const px = sp.direction.x * (starRadius + h) + p.lateralOffset.x
        const py = sp.direction.y * (starRadius + h) + p.lateralOffset.y
        const pz = sp.direction.z * (starRadius + h) + p.lateralOffset.z

        spPositions[idx * 3] = px
        spPositions[idx * 3 + 1] = py
        spPositions[idx * 3 + 2] = pz

        const fadeIn = smoothstep(0, 0.1, t)
        const fadeOut = smoothstep(1, 0.75, t)
        spAlphas[idx] = fadeIn * fadeOut // full alpha, no 0.7 cap
        spSizes[idx] = p.sizeScale
        idx++
      }
    }

    spPosAttr.needsUpdate = true
    spAlphaAttr.needsUpdate = true
    spSizeAttr.needsUpdate = true
  }

  // ── Ejection spawn ────────────────────────────────────────────────────────

  function spawn(cameraDir: THREE.Vector3) {
    // Allow full hemisphere — edges AND face
    let dir: THREE.Vector3
    do {
      dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ).normalize()
    } while (dir.dot(cameraDir) < -0.1) // only exclude far backside

    const arbitrary = Math.abs(dir.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0)
    const tangent = new THREE.Vector3().crossVectors(dir, arbitrary).normalize()
    tangent.applyAxisAngle(dir, Math.random() * Math.PI * 2)
    const bitangent = new THREE.Vector3().crossVectors(dir, tangent).normalize()

    const loopRadius = starRadius * (0.06 + Math.random() * 0.06)

    // Per-particle chaos
    const particles: ParticleProps[] = []
    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      const isStray = i >= PARTICLES_PER_LOOP
      particles.push({
        angleOffset: (i / PARTICLES_PER_LOOP) * Math.PI * 2 + rand(-0.1, 0.1),
        speedMult: rand(0.6, 1.6),
        radialJitter: rand(-1, 1) * loopRadius * 0.14,
        lateralJitter: rand(-1, 1) * loopRadius * 0.12,
        sizeScale: rand(0.4, 1.3),
        isStray,
        strayDrift: isStray ? rand(0.2, 0.5) : 0,
        strayAngle: isStray ? rand(0, Math.PI * 2) : 0,
        strayStartAngle: isStray ? rand(0, Math.PI * 2) : 0,
      })
    }

    // Particle Points
    const positions = new Float32Array(TOTAL_PARTICLES * 3)
    const alphas = new Float32Array(TOTAL_PARTICLES)
    const sizes = new Float32Array(TOTAL_PARTICLES)
    const geo = new THREE.BufferGeometry()
    const posAttr = new THREE.BufferAttribute(positions, 3)
    const alphaAttr = new THREE.BufferAttribute(alphas, 1)
    const sizeAttr = new THREE.BufferAttribute(sizes, 1)
    geo.setAttribute('position', posAttr)
    geo.setAttribute('alpha', alphaAttr)
    geo.setAttribute('size', sizeAttr)

    // Randomize ejection color: mix between warm-white and temperature color
    const colorMix = Math.random() // 0 = warm white, 1 = full temp color
    const ejectionColor = warmWhite.clone().lerp(tempColor, colorMix)

    const basePtSize = Math.max(1.0, starRadius * 0.035)
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: ejectionColor },
        globalOpacity: { value: 1.0 },
        basePtSize: { value: basePtSize },
      },
      vertexShader: /* glsl */ `
        attribute float alpha;
        attribute float size;
        uniform float basePtSize;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(basePtSize * size * (400.0 / -mv.z), 0.5, 8.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 color;
        uniform float globalOpacity;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float glow = 1.0 - smoothstep(0.0, 0.5, d);
          glow *= glow;
          gl_FragColor = vec4(color, glow * vAlpha * globalOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    const points = new THREE.Points(geo, mat)
    group.add(points)

    // Bundle of parallel hoops at varying radii, tinted to match ejection
    const ejectionHoopColor = hoopColor.clone().lerp(tempColor, colorMix * 0.4)
    const hoops: HoopLine[] = []
    for (let h = 0; h < NUM_HOOPS; h++) {
      const radiusMult = 0.7 + (h / (NUM_HOOPS - 1)) * 0.6
      const hoopRadius = loopRadius * radiusMult

      const hPositions = new Float32Array(HOOP_VERTS * 3)
      const hAlphas = new Float32Array(HOOP_VERTS)
      const hGeo = new THREE.BufferGeometry()
      const hPosAttr = new THREE.BufferAttribute(hPositions, 3)
      const hAlphaAttr = new THREE.BufferAttribute(hAlphas, 1)
      hGeo.setAttribute('position', hPosAttr)
      hGeo.setAttribute('alpha', hAlphaAttr)

      const distFromCenter = Math.abs(radiusMult - 1.0)
      const hoopOpacity = 0.5 - distFromCenter * 0.6

      const hMat = new THREE.ShaderMaterial({
        uniforms: {
          color: { value: ejectionHoopColor.clone() },
          globalOpacity: { value: 1.0 },
          baseOpacity: { value: Math.max(0.15, hoopOpacity) },
        },
        vertexShader: /* glsl */ `
          attribute float alpha;
          varying float vAlpha;
          void main() {
            vAlpha = alpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 color;
          uniform float globalOpacity;
          uniform float baseOpacity;
          varying float vAlpha;
          void main() {
            gl_FragColor = vec4(color, vAlpha * globalOpacity * baseOpacity);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })

      const line = new THREE.LineLoop(hGeo, hMat)
      group.add(line)
      hoops.push({ line, radius: hoopRadius, posAttr: hPosAttr, alphaAttr: hAlphaAttr })
    }

    const maxEmergence = rand(-0.65, -0.5)

    ejections.push({
      direction: dir,
      tangent,
      bitangent,
      loopRadius,
      phase: 'emerging',
      phaseTime: 0,
      emergeDuration: 3 + Math.random() * 2,
      activeDuration: 2 + Math.random() * 2,
      retreatDuration: 2 + Math.random() * 1.5,
      maxEmergence,
      emergence: -1,
      flowAngle: Math.random() * Math.PI * 2,
      opacity: 1,
      particles,
      points,
      posAttr,
      alphaAttr,
      sizeAttr,
      hoops,
    })
  }

  // ── Per-frame ejection tick ────────────────────────────────────────────────

  function tick(ej: Ejection, dt: number, elapsed: number): boolean {
    ej.phaseTime += dt

    switch (ej.phase) {
      case 'emerging':
        ej.emergence = -1 + (1 + ej.maxEmergence) * (ej.phaseTime / ej.emergeDuration)
        ej.flowAngle += dt * 1.5
        if (ej.phaseTime >= ej.emergeDuration) {
          ej.phase = 'active'
          ej.phaseTime = 0
          ej.emergence = ej.maxEmergence
        }
        break

      case 'active':
        ej.flowAngle += dt * 1.5
        if (ej.phaseTime >= ej.activeDuration) {
          ej.phase = 'retreating'
          ej.phaseTime = 0
        }
        break

      case 'retreating': {
        const t = ej.phaseTime / ej.retreatDuration
        ej.emergence = ej.maxEmergence - (1 + ej.maxEmergence) * t
        ej.flowAngle += dt * 1.5 * (1 - t)
        ej.opacity = 1 - t
        if (t >= 1) return false
        break
      }
    }

    const centerDist = starRadius + ej.emergence * ej.loopRadius
    const pos = ej.posAttr.array as Float32Array
    const alp = ej.alphaAttr.array as Float32Array
    const siz = ej.sizeAttr.array as Float32Array

    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      const p = ej.particles[i]

      if (p.isStray) {
        const baseAngle = p.strayStartAngle + ej.flowAngle * p.speedMult
        const cosA = Math.cos(baseAngle)
        const sinA = Math.sin(baseAngle)
        const radial = centerDist + ej.loopRadius * cosA
        const lateral = ej.loopRadius * sinA

        const totalTime = ej.emergeDuration + ej.activeDuration + ej.retreatDuration
        const age = ej.phase === 'emerging' ? ej.phaseTime
          : ej.phase === 'active' ? ej.emergeDuration + ej.phaseTime
          : ej.emergeDuration + ej.activeDuration + ej.phaseTime
        const driftT = age / totalTime
        const drift = driftT * p.strayDrift * ej.loopRadius

        const driftDir = new THREE.Vector3()
          .addScaledVector(ej.direction, Math.cos(p.strayAngle) * 0.6)
          .addScaledVector(ej.tangent, Math.sin(p.strayAngle) * 0.5)
          .addScaledVector(ej.bitangent, Math.cos(p.strayAngle * 1.7) * 0.3)
          .normalize()

        const px = ej.direction.x * radial + ej.tangent.x * lateral + driftDir.x * drift
        const py = ej.direction.y * radial + ej.tangent.y * lateral + driftDir.y * drift
        const pz = ej.direction.z * radial + ej.tangent.z * lateral + driftDir.z * drift

        pos[i * 3] = px
        pos[i * 3 + 1] = py
        pos[i * 3 + 2] = pz

        const dist = Math.sqrt(px * px + py * py + pz * pz)
        alp[i] = smoothstep(starRadius * 0.97, starRadius * 1.03, dist) * (1 - driftT * driftT)
        siz[i] = p.sizeScale * (1 - driftT * 0.5)
      } else {
        const angle = p.angleOffset + ej.flowAngle * p.speedMult
        const cosA = Math.cos(angle)
        const sinA = Math.sin(angle)
        const radial = centerDist + ej.loopRadius * cosA + p.radialJitter
        const lateral = ej.loopRadius * sinA
        const wobble = Math.sin(elapsed * 0.7 + i * 1.3) * p.radialJitter * 0.3
        const biJitter = p.lateralJitter + Math.sin(elapsed * 0.5 + i * 2.1) * p.lateralJitter * 0.4

        const px = ej.direction.x * (radial + wobble) + ej.tangent.x * lateral + ej.bitangent.x * biJitter
        const py = ej.direction.y * (radial + wobble) + ej.tangent.y * lateral + ej.bitangent.y * biJitter
        const pz = ej.direction.z * (radial + wobble) + ej.tangent.z * lateral + ej.bitangent.z * biJitter

        pos[i * 3] = px
        pos[i * 3 + 1] = py
        pos[i * 3 + 2] = pz

        const dist = Math.sqrt(px * px + py * py + pz * pz)
        alp[i] = smoothstep(starRadius * 0.97, starRadius * 1.03, dist)
        siz[i] = p.sizeScale
      }
    }

    ej.posAttr.needsUpdate = true
    ej.alphaAttr.needsUpdate = true
    ej.sizeAttr.needsUpdate = true
    ;(ej.points.material as THREE.ShaderMaterial).uniforms.globalOpacity.value = ej.opacity

    // Update parallel hoops
    for (const hoop of ej.hoops) {
      const hPos = hoop.posAttr.array as Float32Array
      const hAlp = hoop.alphaAttr.array as Float32Array
      const hCenterDist = starRadius + ej.emergence * hoop.radius
      for (let v = 0; v < HOOP_VERTS; v++) {
        const angle = (v / HOOP_VERTS) * Math.PI * 2
        const cosA = Math.cos(angle)
        const sinA = Math.sin(angle)
        const radial = hCenterDist + hoop.radius * cosA
        const lateral = hoop.radius * sinA

        const px = ej.direction.x * radial + ej.tangent.x * lateral
        const py = ej.direction.y * radial + ej.tangent.y * lateral
        const pz = ej.direction.z * radial + ej.tangent.z * lateral

        hPos[v * 3] = px
        hPos[v * 3 + 1] = py
        hPos[v * 3 + 2] = pz

        const dist = Math.sqrt(px * px + py * py + pz * pz)
        hAlp[v] = smoothstep(starRadius * 0.97, starRadius * 1.03, dist)
      }
      hoop.posAttr.needsUpdate = true
      hoop.alphaAttr.needsUpdate = true
      ;(hoop.line.material as THREE.ShaderMaterial).uniforms.globalOpacity.value = ej.opacity
    }

    return true
  }

  // ── Public update ──────────────────────────────────────────────────────────

  function update(dt: number, elapsed: number, camera: THREE.Camera) {
    const camWorld = camera.position.clone()
    if (group.parent) group.parent.worldToLocal(camWorld)
    const camDir = camWorld.normalize()

    timeSinceSpawn += dt
    if (timeSinceSpawn >= nextDelay && ejections.length < maxActive) {
      spawn(camDir)
      timeSinceSpawn = 0
      nextDelay = rand(spawnInterval[0], spawnInterval[1])
    }

    for (let i = ejections.length - 1; i >= 0; i--) {
      if (!tick(ejections[i], dt, elapsed)) {
        const ej = ejections[i]
        group.remove(ej.points)
        ej.points.geometry.dispose()
        ;(ej.points.material as THREE.ShaderMaterial).dispose()
        for (const h of ej.hoops) {
          group.remove(h.line)
          h.line.geometry.dispose()
          ;(h.line.material as THREE.ShaderMaterial).dispose()
        }
        ejections.splice(i, 1)
      }
    }

    tickSpicules(dt, camDir)
  }

  function dispose() {
    for (const ej of ejections) {
      group.remove(ej.points)
      ej.points.geometry.dispose()
      ;(ej.points.material as THREE.ShaderMaterial).dispose()
      for (const h of ej.hoops) {
        group.remove(h.line)
        h.line.geometry.dispose()
        ;(h.line.material as THREE.ShaderMaterial).dispose()
      }
    }
    ejections.length = 0
    spicules.length = 0
    group.remove(spPoints)
    spGeo.dispose()
    spMat.dispose()
  }

  return { group, update, dispose }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function smoothstep(lo: number, hi: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}
