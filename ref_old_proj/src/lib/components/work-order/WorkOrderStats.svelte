<script lang="ts">
  export let typeStats: any[];
  export let totalStats: any;
  export let expandTable: boolean;
</script>

<div class={`mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 ${expandTable ? 'hidden' : ''}`}>  
  {#each [...typeStats, totalStats] as t, i}
    <div class={`theme-bg-primary rounded-xl shadow-lg p-6 flex flex-col items-center border-t-4 ${i === 0 ? 'border-blue-400' : i === 1 ? 'border-green-400' : i === 2 ? 'border-yellow-400' : i === 3 ? 'border-purple-400' : 'border-gray-400'} transition-colors duration-200`}>
      <div class="text-lg font-bold mb-2 theme-text-primary transition-colors duration-200">
        {i === typeStats.length ? 'Total' : t.label}
      </div>
      <div class="flex flex-col gap-2 w-full">
        <div class="flex justify-between w-full">
          <span class="text-xs theme-text-tertiary transition-colors duration-200">Ordered</span>
          <span class="font-semibold text-blue-700 dark:text-blue-400 transition-colors duration-200">{t.ordered}</span>
        </div>
        <div class="flex justify-between w-full">
          <span class="text-xs theme-text-tertiary transition-colors duration-200">WIP</span>
          <span class="font-semibold text-yellow-700 dark:text-yellow-400 transition-colors duration-200">{t.wip}</span>
        </div>
        <div class="flex justify-between w-full">
          <span class="text-xs theme-text-tertiary transition-colors duration-200">Delivered</span>
          <span class="font-semibold text-green-700 dark:text-green-400 transition-colors duration-200">{t.delivered}</span>
        </div>
      </div>
    </div>
  {/each}
</div> 