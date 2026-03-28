import { Engine } from '@lib/engine/Engine'

/** Singleton engine instance — set once when Viewport mounts */
let engine: Engine | null = $state(null)

export function getEngine(): Engine | null {
  return engine
}

export function setEngine(e: Engine): void {
  engine = e
}
