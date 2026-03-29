<script lang="ts">
  import { getFilters, setFilter } from '@lib/stores/filterStore.svelte'

  const filters = $derived(getFilters())

  function toggle(key: keyof typeof filters) {
    setFilter(key, !filters[key])
  }
</script>

<div class="filter-panel bg-black/70 backdrop-blur-xl border border-white/10 rounded-lg p-3">
  <h3 class="text-white/60 text-xs font-medium uppercase tracking-wider mb-2">Orbit Overlays</h3>

  <label class="filter-row">
    <input type="checkbox" checked={filters.planetOrbits} onchange={() => toggle('planetOrbits')} />
    <span>Planets</span>
  </label>

  <label class="filter-row">
    <input type="checkbox" checked={filters.dwarfPlanetOrbits} onchange={() => toggle('dwarfPlanetOrbits')} />
    <span>Dwarf Planets</span>
  </label>

  <label class="filter-row">
    <input type="checkbox" checked={filters.majorMoonOrbits} onchange={() => toggle('majorMoonOrbits')} />
    <span>Major Moons</span>
  </label>

  <label class="filter-row">
    <input type="checkbox" checked={filters.notableMoonOrbits} onchange={() => toggle('notableMoonOrbits')} />
    <span>Notable Moons</span>
  </label>

  <label class="filter-row">
    <input type="checkbox" checked={filters.minorMoonOrbits} onchange={() => toggle('minorMoonOrbits')} />
    <span>Minor Moons</span>
  </label>

  <label class="filter-row">
    <input type="checkbox" checked={filters.cometOrbits} onchange={() => toggle('cometOrbits')} />
    <span>Comets</span>
  </label>
</div>

<style>
  .filter-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.8rem;
  }
  .filter-row:hover {
    color: white;
  }
  .filter-row input[type="checkbox"] {
    accent-color: #4488ff;
  }
</style>
