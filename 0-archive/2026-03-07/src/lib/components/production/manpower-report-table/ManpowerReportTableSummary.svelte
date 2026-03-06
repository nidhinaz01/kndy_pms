<script lang="ts">
  export let totals: {
    totalEmployees: number;
    totalPlannedHours: number;
    totalReportedHours: number;
    totalOTHours: number;
    totalLTHours: number;
    totalLTPHours: number;
    totalLTNPHours: number;
    totalToOtherStageHours: number;
    totalFromOtherStageHours: number;
  };
</script>

<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-4">
  <div class="text-center">
    <div class="text-2xl font-bold theme-text-primary">{totals.totalEmployees}</div>
    <div class="text-xs theme-text-secondary">Total Employees</div>
  </div>
  <div class="text-center">
    <div class="text-2xl font-bold theme-text-primary">{totals.totalPlannedHours.toFixed(1)}</div>
    <div class="text-xs theme-text-secondary">Planned Hours</div>
  </div>
  <div class="text-center">
    <div class="text-2xl font-bold theme-text-primary">{totals.totalReportedHours.toFixed(1)}</div>
    <div class="text-xs theme-text-secondary">Reported Hours</div>
  </div>
  <div class="text-center">
    <div class="text-2xl font-bold text-green-600 dark:text-green-400">{totals.totalOTHours.toFixed(1)}</div>
    <div class="text-xs theme-text-secondary">OT Hours</div>
  </div>
  <div class="text-center">
    <div class="text-2xl font-bold text-red-600 dark:text-red-400">{totals.totalLTHours.toFixed(1)}</div>
    <div class="text-xs theme-text-secondary">LT Hours</div>
  </div>
  <div class="text-center">
    <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">{totals.totalLTPHours.toFixed(1)}</div>
    <div class="text-xs theme-text-secondary">LTP Hours</div>
  </div>
  <div class="text-center">
    <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{totals.totalLTNPHours.toFixed(1)}</div>
    <div class="text-xs theme-text-secondary">LTNP Hours</div>
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

