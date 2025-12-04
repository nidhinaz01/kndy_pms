<script lang="ts">
  import type { ScheduleData } from '../services/scheduleService';

  export let scheduleData: ScheduleData[] = [];
  export let plantStages: string[] = [];

  // Calculate statistics
  $: statistics = (() => {
    const stats = new Map<string, {
      plannedEntries: number;
      actualEntries: number;
      plannedExits: number;
      actualExits: number;
    }>();

    // Initialize all stages with zero counts
    plantStages.forEach(stage => {
      stats.set(stage, {
        plannedEntries: 0,
        actualEntries: 0,
        plannedExits: 0,
        actualExits: 0
      });
    });

    // Count entries and exits
    scheduleData
      .filter(item => item.stage_code && (item.date_type === 'entry' || item.date_type === 'exit'))
      .forEach(item => {
        const stage = item.stage_code!;
        if (!stats.has(stage)) {
          stats.set(stage, {
            plannedEntries: 0,
            actualEntries: 0,
            plannedExits: 0,
            actualExits: 0
          });
        }

        const stageStats = stats.get(stage)!;

        if (item.date_type === 'entry') {
          if (item.planned_date) stageStats.plannedEntries++;
          if (item.actual_date) stageStats.actualEntries++;
        } else if (item.date_type === 'exit') {
          if (item.planned_date) stageStats.plannedExits++;
          if (item.actual_date) stageStats.actualExits++;
        }
      });

    return stats;
  })();

  // Get total statistics
  $: totalStats = (() => {
    let totalPlannedEntries = 0;
    let totalActualEntries = 0;
    let totalPlannedExits = 0;
    let totalActualExits = 0;

    statistics.forEach(stats => {
      totalPlannedEntries += stats.plannedEntries;
      totalActualEntries += stats.actualEntries;
      totalPlannedExits += stats.plannedExits;
      totalActualExits += stats.actualExits;
    });

    return {
      plannedEntries: totalPlannedEntries,
      actualEntries: totalActualEntries,
      plannedExits: totalPlannedExits,
      actualExits: totalActualExits
    };
  })();
</script>

<div class="p-6 border-b theme-border">
  <h3 class="text-lg font-semibold theme-text-primary mb-4">Statistics</h3>
  
  <div class="overflow-x-auto">
    <table class="w-full">
      <thead class="theme-bg-secondary">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">Stage</th>
          <th class="px-6 py-3 text-center text-xs font-medium theme-text-primary uppercase tracking-wider">Planned Entries</th>
          <th class="px-6 py-3 text-center text-xs font-medium theme-text-primary uppercase tracking-wider">Actual Entries</th>
          <th class="px-6 py-3 text-center text-xs font-medium theme-text-primary uppercase tracking-wider">Planned Exits</th>
          <th class="px-6 py-3 text-center text-xs font-medium theme-text-primary uppercase tracking-wider">Actual Exits</th>
        </tr>
      </thead>
      <tbody class="theme-bg-primary divide-y theme-border">
        {#each plantStages as stage}
          {@const stageStats = statistics.get(stage) || { plannedEntries: 0, actualEntries: 0, plannedExits: 0, actualExits: 0 }}
          <tr class="hover:theme-bg-secondary">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm font-medium theme-text-primary">{stage}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
              <div class="text-sm theme-text-primary">{stageStats.plannedEntries}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
              <div class="text-sm theme-text-primary">{stageStats.actualEntries}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
              <div class="text-sm theme-text-primary">{stageStats.plannedExits}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
              <div class="text-sm theme-text-primary">{stageStats.actualExits}</div>
            </td>
          </tr>
        {/each}
        <!-- Total Row -->
        <tr class="hover:theme-bg-secondary border-t-2 theme-border font-semibold">
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-bold theme-text-primary">Total</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
            <div class="text-sm font-bold theme-text-primary">{totalStats.plannedEntries}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
            <div class="text-sm font-bold theme-text-primary">{totalStats.actualEntries}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
            <div class="text-sm font-bold theme-text-primary">{totalStats.plannedExits}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
            <div class="text-sm font-bold theme-text-primary">{totalStats.actualExits}</div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

