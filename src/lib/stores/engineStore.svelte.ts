import { Engine } from '@lib/engine/Engine'
import type { CameraController } from '@lib/camera/CameraController'

/** Singleton engine instance — set once when Viewport mounts */
let engine: Engine | null = $state(null)
let cameraController: CameraController | null = $state(null)

export function getEngine(): Engine | null {
  return engine
}

export function setEngine(e: Engine): void {
  engine = e
}

export function getCameraController(): CameraController | null {
  return cameraController
}

export function setCameraController(c: CameraController): void {
  cameraController = c
}
