<script lang="ts">
  export let typeStats: Array<{
    label: string;
    ordered: number;
    wip: number;
    delivered: number;
  }>;
  export let totalStats: {
    ordered: number;
    wip: number;
    delivered: number;
  };
  export let expandTable: boolean;
</script>

<div class={`mb-4 ${expandTable ? 'hidden' : ''}`}>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <!-- Total Statistics -->
    <div class="theme-bg-primary rounded-lg p-4 shadow transition-colors duration-200">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium theme-text-secondary">Total Ordered</p>
          <p class="text-2xl font-bold theme-text-primary">{totalStats.ordered}</p>
        </div>
        <div class="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
          <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      </div>
    </div>

    <div class="theme-bg-primary rounded-lg p-4 shadow transition-colors duration-200">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium theme-text-secondary">Work in Progress</p>
          <p class="text-2xl font-bold theme-text-primary">{totalStats.wip}</p>
        </div>
        <div class="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-full">
          <svg class="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
    </div>

    <div class="theme-bg-primary rounded-lg p-4 shadow transition-colors duration-200">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium theme-text-secondary">Delivered</p>
          <p class="text-2xl font-bold theme-text-primary">{totalStats.delivered}</p>
        </div>
        <div class="p-2 bg-green-100 dark:bg-green-900 rounded-full">
          <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
    </div>

    <div class="theme-bg-primary rounded-lg p-4 shadow transition-colors duration-200">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium theme-text-secondary">Completion Rate</p>
          <p class="text-2xl font-bold theme-text-primary">
            {totalStats.ordered > 0 ? Math.round((totalStats.delivered / totalStats.ordered) * 100) : 0}%
          </p>
        </div>
        <div class="p-2 bg-purple-100 dark:bg-purple-900 rounded-full">
          <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
      </div>
    </div>
  </div>

  <!-- Type-wise Statistics -->
  {#if typeStats.length > 0}
    <div class="theme-bg-primary rounded-lg p-4 shadow transition-colors duration-200">
      <h3 class="text-lg font-semibold theme-text-primary mb-4">Statistics by Type</h3>
      <div class="flex overflow-x-auto gap-4 pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800">
        {#each typeStats as stat}
          <div class="border theme-border rounded-lg p-3 transition-colors duration-200 flex-shrink-0 min-w-[200px]">
            <h4 class="font-medium theme-text-primary mb-2">{stat.label}</h4>
            <div class="space-y-1">
              <div class="flex justify-between text-sm">
                <span class="theme-text-secondary">Ordered:</span>
                <span class="theme-text-primary font-medium">{stat.ordered}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="theme-text-secondary">WIP:</span>
                <span class="theme-text-primary font-medium">{stat.wip}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="theme-text-secondary">Delivered:</span>
                <span class="theme-text-primary font-medium">{stat.delivered}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  /* Custom scrollbar styles for better cross-browser compatibility */
  .scrollbar-thin::-webkit-scrollbar {
    height: 6px;
  }
  
  .scrollbar-thin::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
  }
  
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
  
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
  
  /* Dark theme scrollbar */
  :global([data-theme="dark"]) .scrollbar-thin::-webkit-scrollbar-track {
    background: #475569;
  }
  
  :global([data-theme="dark"]) .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #64748b;
  }
  
  :global([data-theme="dark"]) .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
  
  /* Firefox scrollbar */
  .scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 #f1f5f9;
  }
  
  :global([data-theme="dark"]) .scrollbar-thin {
    scrollbar-color: #64748b #475569;
  }
  
  /* Smooth scrolling */
  .overflow-x-auto {
    scroll-behavior: smooth;
  }
</style> 