<script lang="ts">
  import * as THREE from 'three'
  import { onMount, onDestroy } from 'svelte'
  import { Engine } from '@lib/engine/Engine'
  import { setEngine, setCameraController } from '@lib/stores/engineStore.svelte'
  import { handleViewportClick } from '@lib/stores/selectionStore.svelte'
  import { registerAnimationTick } from '@lib/stores/sceneStore.svelte'
  import { CameraController } from '@lib/camera/CameraController'

  let canvasEl: HTMLCanvasElement
  let containerEl: HTMLDivElement
  let engine: Engine | null = null

  onMount(() => {
    engine = new Engine(canvasEl)
    setEngine(engine)

    // Initialize camera controller
    const camController = new CameraController(engine.camera, engine.controls)
    setCameraController(camController)

    // Camera controller update in the render loop
    engine.onTick((dt) => {
      camController.update(dt)
    })

    // Size to container
    const rect = containerEl.getBoundingClientRect()
    engine.resize(rect.width, rect.height)

    // Watch for resize
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          engine?.resize(width, height)
        }
      }
    })
    observer.observe(containerEl)

    // Start render loop
    engine.start()

    // Register entity animation tick (shader uniforms, billboards, etc.)
    registerAnimationTick()

    return () => {
      observer.disconnect()
    }
  })

  onDestroy(() => {
    engine?.dispose()
  })

  function onClick(e: MouseEvent) {
    handleViewportClick(e)
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={containerEl} class="absolute inset-0 w-full h-full" onclick={onClick}>
  <canvas bind:this={canvasEl} class="block w-full h-full"></canvas>
</div>
