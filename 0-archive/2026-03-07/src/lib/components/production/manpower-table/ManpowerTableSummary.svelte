<script lang="ts">
  export let totals: {
    totalEmployees: number;
    totalPlannedHours: number;
    totalReportedHours?: number;
    totalOTHours?: number;
    totalLTHours?: number;
    totalLTPHours?: number;
    totalLTNPHours?: number;
    totalToOtherStageHours: number;
    totalFromOtherStageHours: number;
  };
</script>

<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
  <div class="text-center">
    <div class="text-2xl font-bold theme-text-primary">{totals.totalEmployees}</div>
    <div class="text-xs theme-text-secondary">Total Employees</div>
  </div>
  <div class="text-center">
    <div class="text-2xl font-bold theme-text-primary">{totals.totalPlannedHours.toFixed(1)}</div>
    <div class="text-xs theme-text-secondary">Planned Hours</div>
  </div>
  <div class="text-center">
    <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{totals.totalToOtherStageHours.toFixed(1)}</div>
    <div class="text-xs theme-text-secondary">To Other Stage</div>
  </div>
  <div class="text-center">
    <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">{totals.totalFromOtherStageHours.toFixed(1)}</div>
    <div class="text-xs theme-text-secondary">From Other Stage</div>
  </div>
</div>

