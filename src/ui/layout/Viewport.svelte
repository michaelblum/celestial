<script lang="ts">
  import * as THREE from 'three'
  import { onMount, onDestroy } from 'svelte'
  import { Engine } from '@lib/engine/Engine'
  import { setEngine } from '@lib/stores/engineStore.svelte'
  import { handleViewportClick } from '@lib/stores/selectionStore.svelte'

  let canvasEl: HTMLCanvasElement
  let containerEl: HTMLDivElement
  let engine: Engine | null = null

  onMount(() => {
    engine = new Engine(canvasEl)
    setEngine(engine)

    // Add a directional light for entities
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
    dirLight.position.set(5, 8, 5)
    engine.scene.add(dirLight)

    // Add a subtle point light at origin for warmth
    const pointLight = new THREE.PointLight(0xffddaa, 0.5, 50)
    pointLight.position.set(0, 2, 0)
    engine.scene.add(pointLight)

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
