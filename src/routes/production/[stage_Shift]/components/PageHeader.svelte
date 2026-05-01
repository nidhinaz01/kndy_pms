<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import { goto } from '$app/navigation';

  export let activeTab: string = 'work-orders';
  export let selectedDate: string = '';
  export let tabs: Array<{ id: string; label: string; icon?: string }> = [];

  const dispatch = createEventDispatcher();
  let tabsNavEl: HTMLElement | null = null;

  function handleTabChange(tabId: string) {
    dispatch('tabChange', tabId);
  }

  function handleDateChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const newDate = target.value;
    console.log(`📅 PageHeader: Date picker changed, target.value="${newDate}", selectedDate prop="${selectedDate}"`);
    // The bind:value should update selectedDate automatically, but log both to verify
    dispatch('dateChange');
  }
  
  function handleDateInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const newDate = target.value;
    console.log(`📥 PageHeader: Date picker input event, target.value="${newDate}", selectedDate prop="${selectedDate}"`);
  }
  
  // Watch for selectedDate changes
  $: if (selectedDate) {
    console.log(`👀 PageHeader: selectedDate prop changed to: ${selectedDate}`);
  }

  function handleSidebarToggle() {
    dispatch('sidebarToggle');
  }

  async function scrollActiveTabIntoView() {
    if (!tabsNavEl || !activeTab) return;
    await tick();
    const activeButton = tabsNavEl.querySelector<HTMLButtonElement>(`button[data-tab-id="${activeTab}"]`);
    activeButton?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  $: if (tabsNavEl && activeTab) {
    scrollActiveTabIntoView();
  }
</script>

<div class="theme-bg-primary shadow-sm border-b theme-border">
  <div class="w-full mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex min-w-0 flex-nowrap items-center justify-between gap-x-2 gap-y-2 py-3">
      <!-- Burger Menu -->
      <button 
        class="shrink-0 rounded p-2 hover:theme-bg-tertiary focus:outline-none transition-colors duration-200" 
        on:click={handleSidebarToggle} 
        aria-label="Show sidebar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <!-- Tab Navigation: single horizontal row with slightly wider pills -->
      <nav
        bind:this={tabsNavEl}
        class="min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain px-0.5 py-0.5 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent dark:scrollbar-thumb-gray-600"
        aria-label="Production sections"
      >
        <div class="mx-auto flex w-max max-w-none flex-nowrap items-stretch justify-center gap-x-1 sm:gap-x-1.5">
          {#each tabs as tab}
            <button
              type="button"
              data-tab-id={tab.id}
              class="flex min-h-[3.25rem] w-[4.2rem] shrink-0 flex-col items-center justify-center rounded-lg border-2 px-1.5 py-1.5 text-center transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-blue-400/50 dark:focus-visible:ring-offset-slate-900 sm:w-[4.7rem] sm:min-h-[3.5rem] sm:px-2 {activeTab === tab.id
                ? 'border-blue-600 bg-blue-100 font-semibold text-blue-950 shadow-sm ring-2 ring-blue-500/45 ring-offset-0 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-50 dark:ring-blue-400/40'
                : 'border-slate-300 bg-transparent text-slate-600 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100'}"
              aria-current={activeTab === tab.id ? 'page' : undefined}
              on:click={() => handleTabChange(tab.id)}
            >
              <span
                class="w-full max-w-full hyphens-auto break-words text-center text-[0.68rem] font-medium leading-[1.1] sm:text-[0.72rem] sm:leading-tight"
              >{tab.label}</span>
            </button>
          {/each}
        </div>
      </nav>

      <!-- Date picker -->
      <div class="flex shrink-0 flex-row flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:gap-x-3">
        <label for="selectedDate" class="shrink-0 text-sm font-medium theme-text-primary">
          Date:
        </label>
        <input
          id="selectedDate"
          type="date"
          bind:value={selectedDate}
          on:input={handleDateInput}
          on:change={handleDateChange}
          class="min-w-0 rounded-lg border theme-border px-2 py-1.5 text-sm theme-bg-primary theme-text-primary focus:border-transparent focus:ring-2 focus:ring-blue-500 sm:px-3 sm:py-2"
        />
      </div>

      <!-- Favicon -->
      <button
        on:click={() => goto('/dashboard')}
        class="flex shrink-0 items-center hover:opacity-80 transition-opacity cursor-pointer"
        aria-label="Go to dashboard"
      >
        <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
      </button>
    </div>
  </div>
</div>

