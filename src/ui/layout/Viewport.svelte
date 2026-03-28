<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { Engine } from '@lib/engine/Engine'
  import { setEngine } from '@lib/stores/engineStore.svelte'

  let canvasEl: HTMLCanvasElement
  let containerEl: HTMLDivElement
  let engine: Engine | null = null

  onMount(() => {
    engine = new Engine(canvasEl)
    setEngine(engine)

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
</script>

<div bind:this={containerEl} class="absolute inset-0 w-full h-full">
  <canvas bind:this={canvasEl} class="block w-full h-full"></canvas>
</div>
