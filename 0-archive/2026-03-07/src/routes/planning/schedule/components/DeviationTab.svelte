<script lang="ts">
  import type { ScheduleData } from '../services/scheduleService';

  export let scheduleData: ScheduleData[] = [];
  export let plantStages: string[] = [];

  // Group data by work order
  $: workOrderMap = (() => {
    const map = new Map<number, {
      wo_no: string | null;
      pwo_no: string | null;
      customer_name: string | null;
      stages: Map<string, { 
        entry: { planned: string | null; actual: string | null };
        exit: { planned: string | null; actual: string | null };
      }>
    }>();

    scheduleData
      .filter(item => item.stage_code && (item.date_type === 'entry' || item.date_type === 'exit'))
      .forEach(item => {
        const woId = item.sales_order_id;
        const stage = item.stage_code!;
        const dateType = item.date_type;

        if (!map.has(woId)) {
          map.set(woId, {
            wo_no: item.prdn_wo_details.wo_no,
            pwo_no: item.prdn_wo_details.pwo_no,
            customer_name: item.prdn_wo_details.customer_name,
            stages: new Map()
          });
        }

        const woData = map.get(woId)!;
        if (!woData.stages.has(stage)) {
          woData.stages.set(stage, { 
            entry: { planned: null, actual: null },
            exit: { planned: null, actual: null }
          });
        }

        const stageData = woData.stages.get(stage)!;
        if (dateType === 'entry') {
          if (item.planned_date) stageData.entry.planned = item.planned_date;
          if (item.actual_date) stageData.entry.actual = item.actual_date;
        } else if (dateType === 'exit') {
          if (item.planned_date) stageData.exit.planned = item.planned_date;
          if (item.actual_date) stageData.exit.actual = item.actual_date;
        }
      });

    return map;
  })();

  // Get all work orders
  $: workOrders = Array.from(workOrderMap.entries()).map(([id, data]) => ({
    id,
    ...data
  }));

  function formatDateTime(dateStr: string | null): string {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getStageData(workOrder: typeof workOrders[0], stage: string) {
    return workOrder.stages.get(stage) || { 
      entry: { planned: null, actual: null },
      exit: { planned: null, actual: null }
    };
  }

  function calculateDeviation(plannedDate: string | null, actualDate: string | null): { hours: number; days: number; label: string; color: string } {
    if (!plannedDate || !actualDate) {
      return { hours: 0, days: 0, label: 'N/A', color: 'text-gray-500' };
    }

    const planned = new Date(plannedDate);
    const actual = new Date(actualDate);
    const diffMs = actual.getTime() - planned.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    let label = '';
    let color = '';

    if (diffHours === 0) {
      label = 'On Time';
      color = 'text-green-600 dark:text-green-400';
    } else if (diffHours > 0) {
      label = `+${diffHours}h`;
      if (diffDays !== 0) label += ` (${diffDays > 0 ? '+' : ''}${diffDays}d)`;
      color = 'text-red-600 dark:text-red-400';
    } else {
      label = `${diffHours}h`;
      if (diffDays !== 0) label += ` (${diffDays}d)`;
      color = 'text-green-600 dark:text-green-400';
    }

    return { hours: diffHours, days: diffDays, label, color };
  }
</script>

<div class="p-6">
  {#if workOrders.length === 0}
    <div class="text-center py-12">
      <p class="theme-text-secondary">No data found for the selected date range.</p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="theme-bg-secondary">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider sticky left-0 z-10 theme-bg-secondary">Work Order</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">Customer</th>
            {#each plantStages as stage}
              <th class="px-6 py-3 text-center text-xs font-medium theme-text-primary uppercase tracking-wider border-l theme-border" colspan="6">
                {stage}
              </th>
            {/each}
          </tr>
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider sticky left-0 z-10 theme-bg-secondary"></th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider"></th>
            {#each plantStages as stage}
              <th class="px-6 py-3 text-center text-xs font-medium theme-text-secondary uppercase tracking-wider border-l theme-border" colspan="3">Entry</th>
              <th class="px-6 py-3 text-center text-xs font-medium theme-text-secondary uppercase tracking-wider" colspan="3">Exit</th>
            {/each}
          </tr>
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider sticky left-0 z-10 theme-bg-secondary"></th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider"></th>
            {#each plantStages as stage}
              <th class="px-6 py-3 text-center text-xs font-medium theme-text-secondary uppercase tracking-wider border-l theme-border">Planned</th>
              <th class="px-6 py-3 text-center text-xs font-medium theme-text-secondary uppercase tracking-wider">Actual</th>
              <th class="px-6 py-3 text-center text-xs font-medium theme-text-secondary uppercase tracking-wider">Deviation</th>
              <th class="px-6 py-3 text-center text-xs font-medium theme-text-secondary uppercase tracking-wider">Planned</th>
              <th class="px-6 py-3 text-center text-xs font-medium theme-text-secondary uppercase tracking-wider">Actual</th>
              <th class="px-6 py-3 text-center text-xs font-medium theme-text-secondary uppercase tracking-wider">Deviation</th>
            {/each}
          </tr>
        </thead>
        <tbody class="theme-bg-primary divide-y theme-border">
          {#each workOrders as workOrder}
            <tr class="hover:theme-bg-secondary">
              <td class="px-6 py-4 whitespace-nowrap sticky left-0 z-10 theme-bg-primary">
                <div class="text-sm font-medium theme-text-primary">{workOrder.wo_no || 'N/A'}</div>
                {#if workOrder.pwo_no}
                  <div class="text-sm theme-text-secondary">{workOrder.pwo_no}</div>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm theme-text-primary">{workOrder.customer_name || 'N/A'}</div>
              </td>
              {#each plantStages as stage}
                {@const stageData = getStageData(workOrder, stage)}
                {@const entryDeviation = calculateDeviation(stageData.entry.planned, stageData.entry.actual)}
                {@const exitDeviation = calculateDeviation(stageData.exit.planned, stageData.exit.actual)}
                <!-- Entry columns -->
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary border-l theme-border text-center">
                  {formatDateTime(stageData.entry.planned)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary text-center">
                  {formatDateTime(stageData.entry.actual)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {entryDeviation.color} text-center">
                  {entryDeviation.label}
                </td>
                <!-- Exit columns -->
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary text-center">
                  {formatDateTime(stageData.exit.planned)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary text-center">
                  {formatDateTime(stageData.exit.actual)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {exitDeviation.color} text-center">
                  {exitDeviation.label}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
