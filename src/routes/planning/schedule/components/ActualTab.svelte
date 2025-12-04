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
      stages: Map<string, { entry: string | null; exit: string | null }>
    }>();

    scheduleData
      .filter(item => item.actual_date && item.stage_code && (item.date_type === 'entry' || item.date_type === 'exit'))
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
          woData.stages.set(stage, { entry: null, exit: null });
        }

        const stageData = woData.stages.get(stage)!;
        if (dateType === 'entry') {
          stageData.entry = item.actual_date;
        } else if (dateType === 'exit') {
          stageData.exit = item.actual_date;
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

  function getStageData(workOrder: typeof workOrders[0], stage: string): { entry: string | null; exit: string | null } {
    return workOrder.stages.get(stage) || { entry: null, exit: null };
  }
</script>

<div class="p-6">
  {#if workOrders.length === 0}
    <div class="text-center py-12">
      <p class="theme-text-secondary">No actual dates found for the selected date range.</p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="theme-bg-secondary">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider sticky left-0 z-10 theme-bg-secondary">Work Order</th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider">Customer</th>
            {#each plantStages as stage}
              <th class="px-6 py-3 text-center text-xs font-medium theme-text-primary uppercase tracking-wider border-l theme-border" colspan="2">
                {stage}
              </th>
            {/each}
          </tr>
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider sticky left-0 z-10 theme-bg-secondary"></th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider"></th>
            {#each plantStages as stage}
              <th class="px-6 py-3 text-center text-xs font-medium theme-text-secondary uppercase tracking-wider border-l theme-border">Entry</th>
              <th class="px-6 py-3 text-center text-xs font-medium theme-text-secondary uppercase tracking-wider">Exit</th>
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
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary border-l theme-border text-center">
                  {formatDateTime(stageData.entry)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary text-center">
                  {formatDateTime(stageData.exit)}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
