<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import type { WorkOrderListItem } from '$lib/api/archive/archiveWoService';

  let {
    showModal = false,
    workOrders = [],
    selectedIds = $bindable(),
    loading = false,
    onConfirm,
    onCancel
  }: {
    showModal?: boolean;
    workOrders?: WorkOrderListItem[];
    selectedIds?: number[];
    loading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();

  let searchQuery = $state('');
  type SortOption = 'wo_asc' | 'wo_desc';
  let sortBy = $state<SortOption>('wo_asc');

  $effect(() => {
    if (!showModal) {
      searchQuery = '';
    }
  });

  const filteredWorkOrders = $derived(
    searchQuery.trim() === ''
      ? workOrders
      : workOrders.filter((wo) => {
          const q = searchQuery.trim().toLowerCase();
          const woNo = (wo.wo_no ?? '').toLowerCase();
          return woNo.includes(q);
        })
  );

  const sortedFilteredWorkOrders = $derived.by(() => {
    const list = [...filteredWorkOrders];
    if (sortBy === 'wo_desc') {
      list.sort((a, b) => ((b.wo_no ?? '').localeCompare(a.wo_no ?? '', undefined, { numeric: true })));
    } else {
      list.sort((a, b) => ((a.wo_no ?? '').localeCompare(b.wo_no ?? '', undefined, { numeric: true })));
    }
    return list;
  });

  const ids = $derived(selectedIds ?? []);

  function toggle(id: number) {
    if (ids.includes(id)) {
      selectedIds = ids.filter((x) => x !== id);
    } else {
      selectedIds = [...ids, id];
    }
  }

  function selectAll() {
    const filteredIds = sortedFilteredWorkOrders.map((w) => w.id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => ids.includes(id));
    if (allFilteredSelected) {
      selectedIds = ids.filter((id) => !filteredIds.includes(id));
    } else {
      const combined = new Set([...ids, ...filteredIds]);
      selectedIds = Array.from(combined);
    }
  }

  function handleClose() {
    searchQuery = '';
    onCancel();
  }
</script>

{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div
      class="fixed inset-0 bg-black bg-opacity-50"
      role="button"
      tabindex="0"
      onclick={handleClose}
      onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && handleClose()}
    ></div>
    <div class="relative theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
      <h2 class="text-xl font-bold theme-text-primary mb-4">Select work order(s) to archive</h2>
      {#if loading}
        <p class="theme-text-secondary">Loading work orders...</p>
      {:else if workOrders.length === 0}
        <p class="theme-text-secondary">No work orders available to archive.</p>
      {:else}
        <div class="mb-3">
          <label for="wo-search" class="block text-sm font-medium theme-text-primary mb-1.5">Search</label>
          <input
            id="wo-search"
            type="text"
            bind:value={searchQuery}
            placeholder="Search by WO number..."
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary placeholder-theme-text-secondary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div class="mb-3">
          <label for="wo-sort" class="block text-sm font-medium theme-text-primary mb-1.5">Sort</label>
          <select
            id="wo-sort"
            bind:value={sortBy}
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="wo_asc">WO number (A→Z)</option>
            <option value="wo_desc">WO number (Z→A)</option>
          </select>
        </div>
        <div class="flex items-center gap-2 mb-2">
          <button
            type="button"
            class="text-sm theme-text-primary underline"
            onclick={selectAll}
          >
            {sortedFilteredWorkOrders.length > 0 && sortedFilteredWorkOrders.every((w) => ids.includes(w.id))
              ? 'Deselect all'
              : 'Select all'}
          </button>
          {#if searchQuery.trim() !== ''}
            <span class="text-sm theme-text-secondary">
              ({sortedFilteredWorkOrders.length} of {workOrders.length})
            </span>
          {/if}
        </div>
        <div class="overflow-y-auto flex-1 border theme-border rounded-lg p-2 mb-4 max-h-64">
          {#each sortedFilteredWorkOrders as wo}
            <label class="flex items-center gap-2 py-1.5 cursor-pointer theme-text-primary">
              <input
                type="checkbox"
                checked={ids.includes(wo.id)}
                onchange={() => toggle(wo.id)}
              />
              <span>{wo.wo_no ?? 'WO-' + wo.id}</span>
            </label>
          {/each}
          {#if searchQuery.trim() !== '' && sortedFilteredWorkOrders.length === 0}
            <p class="py-2 text-sm theme-text-secondary">No work orders match your search.</p>
          {/if}
        </div>
      {/if}
      <div class="flex justify-end gap-2">
        <Button variant="secondary" size="md" on:click={handleClose}>Cancel</Button>
        <Button
          variant="primary"
          size="md"
          on:click={onConfirm}
          disabled={loading || ids.length === 0}
        >
          OK
        </Button>
      </div>
    </div>
  </div>
{/if}
