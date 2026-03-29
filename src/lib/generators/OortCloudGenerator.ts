import * as THREE from 'three'

/**
 * Create a visual-only oort cloud shell for a star.
 * Size is derived from star mass. Not an entity — purely a visual child of the star group.
 * Visible only when zoomed far out (large camera distance).
 */
export function createOortCloud(starMass: number): THREE.Group {
  const group = new THREE.Group()
  group.name = 'oort-cloud-visual'

  // Oort cloud radius scales with star mass (cube root for volume relationship)
  const baseRadius = 30
  const massScale = Math.pow(starMass / 333000, 1 / 3) // Normalize to Sun mass
  const radius = baseRadius * Math.max(massScale, 0.5) // Min 50% of base

  // Outer translucent shell
  const shellGeo = new THREE.SphereGeometry(radius, 32, 24)
  const shellMat = new THREE.MeshBasicMaterial({
    color: 0x334466,
    transparent: true,
    opacity: 0.03,
    side: THREE.BackSide,
    depthWrite: false,
  })
  const shell = new THREE.Mesh(shellGeo, shellMat)
  shell.name = 'oort-shell'
  group.add(shell)

  // Inner haze (slightly smaller, visible when camera is inside)
  const hazeGeo = new THREE.SphereGeometry(radius * 0.95, 24, 16)
  const hazeMat = new THREE.MeshBasicMaterial({
    color: 0x223344,
    transparent: true,
    opacity: 0.015,
    side: THREE.FrontSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const haze = new THREE.Mesh(hazeGeo, hazeMat)
  haze.name = 'oort-haze'
  group.add(haze)

  // Sparse particle scatter
  const particleCount = 500
  const positions = new Float32Array(particleCount * 3)
  for (let i = 0; i < particleCount; i++) {
    const r = radius * (0.7 + Math.random() * 0.3)
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)
  }

  const particleGeo = new THREE.BufferGeometry()
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const particleMat = new THREE.PointsMaterial({
    color: 0x556677,
    size: 0.15,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const particles = new THREE.Points(particleGeo, particleMat)
  particles.name = 'oort-particles'
  group.add(particles)

  return group
}
