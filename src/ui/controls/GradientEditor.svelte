<script lang="ts">
  import type { GradientStop } from '@lib/ecs/types'

  let {
    stops = $bindable<GradientStop[]>([
      { position: 0, color: '#ff00aa' },
      { position: 1, color: '#00aaff' },
    ]),
    onchange,
  }: {
    stops: GradientStop[]
    onchange?: (stops: GradientStop[]) => void
  } = $props()

  let barEl: HTMLDivElement | undefined
  let draggingIndex: number | null = null

  // Build CSS gradient string from stops
  function gradientCSS(stops: GradientStop[]): string {
    const sorted = [...stops].sort((a, b) => a.position - b.position)
    const parts = sorted.map((s) => `${s.color} ${s.position * 100}%`)
    return `linear-gradient(to right, ${parts.join(', ')})`
  }

  // Add a new stop on click (not on an existing handle)
  function handleBarClick(e: MouseEvent) {
    if (draggingIndex !== null) return
    if ((e.target as HTMLElement).closest('.gradient-handle')) return

    const rect = barEl!.getBoundingClientRect()
    const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))

    // Interpolate color at this position
    const sorted = [...stops].sort((a, b) => a.position - b.position)
    let color = sorted[0]?.color ?? '#ffffff'
    for (let i = 0; i < sorted.length - 1; i++) {
      if (position >= sorted[i].position && position <= sorted[i + 1].position) {
        // Simple midpoint — real interpolation would blend colors
        const t = (position - sorted[i].position) / (sorted[i + 1].position - sorted[i].position)
        color = t < 0.5 ? sorted[i].color : sorted[i + 1].color
        break
      }
    }

    stops = [...stops, { position, color }]
    onchange?.(stops)
  }

  // Start dragging a handle
  function startDrag(index: number, e: MouseEvent) {
    e.stopPropagation()
    draggingIndex = index

    const onMove = (e: MouseEvent) => {
      if (draggingIndex === null || !barEl) return
      const rect = barEl.getBoundingClientRect()
      const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      stops = stops.map((s, i) => (i === draggingIndex ? { ...s, position } : s))
      onchange?.(stops)
    }

    const onUp = () => {
      draggingIndex = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Remove a stop (right-click), minimum 2 stops
  function removeStop(index: number, e: MouseEvent) {
    e.preventDefault()
    if (stops.length <= 2) return
    stops = stops.filter((_, i) => i !== index)
    onchange?.(stops)
  }

  // Update a stop's color via color picker
  function updateColor(index: number, color: string) {
    stops = stops.map((s, i) => (i === index ? { ...s, color } : s))
    onchange?.(stops)
  }
</script>

<div class="flex flex-col gap-2">
  <span class="text-xs text-gray-400">Color Gradient</span>

  <!-- Gradient Bar -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={barEl}
    onclick={handleBarClick}
    class="relative h-6 rounded-lg cursor-crosshair border border-white/10 select-none"
    style="background: {gradientCSS(stops)}"
  >
    <!-- Stop Handles -->
    {#each stops as stop, i}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="gradient-handle absolute top-1/2 -translate-y-1/2 -translate-x-1/2
               w-3.5 h-3.5 rounded-full border-2 border-white shadow-md cursor-grab
               active:cursor-grabbing hover:scale-125 transition-transform z-10"
        style="left: {stop.position * 100}%; background: {stop.color}"
        onmousedown={(e) => startDrag(i, e)}
        oncontextmenu={(e) => removeStop(i, e)}
      ></div>
    {/each}
  </div>

  <!-- Color pickers row -->
  <div class="flex gap-1.5 flex-wrap">
    {#each stops.sort((a, b) => a.position - b.position) as stop, i}
      {@const originalIndex = stops.indexOf(stop)}
      <div class="flex items-center gap-1">
        <input
          type="color"
          value={stop.color}
          oninput={(e) => updateColor(originalIndex, (e.target as HTMLInputElement).value)}
          class="w-5 h-5 rounded cursor-pointer bg-transparent border-none p-0"
        />
        <span class="text-[10px] text-gray-500 font-mono">{Math.round(stop.position * 100)}%</span>
      </div>
    {/each}
  </div>

  <p class="text-[10px] text-gray-600">Click bar to add stops. Right-click to remove.</p>
</div>
