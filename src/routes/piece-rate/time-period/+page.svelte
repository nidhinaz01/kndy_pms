<script lang="ts">
  import { onMount } from 'svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { supabase } from '$lib/supabaseClient';
  import { formatDateLocal } from '$lib/utils/formatDate';

  let showSidebar = false;
  let menus: any[] = [];
  let isLoading = false;
  
  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }
  
  // Form state
  let selectedEmployeeId = '';
  let fromDate = '';
  let toDate = '';
  
  // Data
  let pieceRateData: any[] = [];
  let employees: any[] = [];
  let isDataLoading = false;
  
  // Validation errors
  let errors: { employee?: string; dates?: string } = {};

  onMount(async () => {
    const username = localStorage.getItem('username');
    if (username) {
      menus = await fetchUserMenus(username);
    }
    await loadEmployees();
  });

  async function loadEmployees() {
    try {
      const { data, error } = await supabase
        .from('hr_emp')
        .select('emp_id, emp_name, skill_short')
        .eq('is_deleted', false)
        .eq('is_active', true)
        .order('emp_name');

      if (error) throw error;
      employees = data || [];
    } catch (error) {
      console.error('Error loading employees:', error);
      alert('Error loading employees');
    }
  }

  function validateDates(): boolean {
    errors = {};
    
    if (!fromDate || !toDate) {
      errors.dates = 'Please select both from date and to date';
      return false;
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (to < from) {
      errors.dates = 'To date must be greater than or equal to from date';
      return false;
    }

    // Check if both dates are in the same month and year
    if (from.getFullYear() !== to.getFullYear() || from.getMonth() !== to.getMonth()) {
      errors.dates = 'Both dates must be in the same month and year';
      return false;
    }

    return true;
  }

  async function loadPieceRateData() {
    if (!selectedEmployeeId) {
      errors.employee = 'Please select an employee';
      return;
    }

    if (!validateDates()) {
      return;
    }

    isDataLoading = true;
    try {
      const { data, error } = await supabase
        .from('prdn_work_reporting')
        .select(`
          id,
          planning_id,
          worker_id,
          from_date,
          to_date,
          hours_worked_today,
          completion_status,
          pr_amount,
          pr_calculated_dt,
          pr_rate,
          pr_std_time,
          pr_pow,
          pr_type,
          overtime_minutes,
          overtime_amount,
          lt_minutes_total,
          lt_details,
          prdn_work_planning!inner(
            id,
            derived_sw_code,
            other_work_code,
            sc_required,
            std_work_type_details!left(
              std_work_details!left(
                sw_name
              )
            ),
            prdn_work_additions!left(
              other_work_desc
            )
          )
        `)
        .eq('worker_id', selectedEmployeeId)
        .gte('from_date', fromDate)
        .lte('to_date', toDate)
        .eq('is_deleted', false)
        .eq('is_active', true)
        .order('from_date', { ascending: true })
        .order('from_time', { ascending: true });

      if (error) throw error;

      pieceRateData = data || [];
    } catch (error) {
      console.error('Error loading piece rate data:', error);
      alert('Error loading piece rate data');
    } finally {
      isDataLoading = false;
    }
  }

  function getWorkName(report: any): string {
    const planning = report.prdn_work_planning;
    if (planning?.derived_sw_code) {
      return planning.std_work_type_details?.std_work_details?.sw_name || planning.derived_sw_code;
    } else if (planning?.other_work_code) {
      return planning.prdn_work_additions?.other_work_desc || planning.other_work_code;
    }
    return 'Unknown';
  }

  function getWorkCode(report: any): string {
    const planning = report.prdn_work_planning;
    return planning?.derived_sw_code || planning?.other_work_code || 'N/A';
  }

  function formatCurrency(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return '-';
    return `₹${amount.toFixed(2)}`;
  }

  function formatPercentage(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-';
    return `${(value * 100).toFixed(2)}%`;
  }

  // Calculate totals
  $: totalPieceRate = pieceRateData.reduce((sum, r) => sum + (r.pr_amount || 0), 0);
  $: totalOvertime = pieceRateData.reduce((sum, r) => sum + (r.overtime_amount || 0), 0);
  $: totalLostTime = pieceRateData.reduce((sum, r) => {
    if (r.lt_details && Array.isArray(r.lt_details)) {
      return sum + r.lt_details.reduce((ltSum: number, lt: any) => ltSum + (lt.lt_value || 0), 0);
    }
    return sum;
  }, 0);
  $: totalHours = pieceRateData.reduce((sum, r) => sum + (r.hours_worked_today || 0), 0);

  const selectedEmployee = employees.find(e => e.emp_id === selectedEmployeeId);
</script>

<svelte:head>
  <title>Piece Rate - Time Period</title>
</svelte:head>

<!-- Sidebar Overlay -->
{#if showSidebar}
  <div class="fixed inset-0 z-50">
    <button
      type="button"
      aria-label="Close sidebar overlay"
      class="fixed inset-0 bg-black bg-opacity-40 z-40"
      on:click={handleSidebarToggle}
      tabindex="0"
      on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSidebarToggle()}
      style="cursor: pointer; border: none; width: 100%; height: 100%; position: fixed; left: 0; top: 0; background-color: rgba(0,0,0,0.4);"
    ></button>
    <div class="fixed left-0 top-0 h-full w-64 z-50 theme-bg-primary shadow-lg">
      <Sidebar {menus} />
    </div>
  </div>
{/if}

<div class="flex flex-col h-full w-full theme-bg-secondary transition-colors duration-200" style="min-height: 100vh;">
  <!-- Header -->
  <AppHeader 
    title="Piece Rate - Time Period"
    onSidebarToggle={handleSidebarToggle}
  />

  <!-- Main Content -->
  <div class="flex flex-1 p-4">
    <div class="w-full">

      <!-- Filters -->
      <div class="theme-bg-secondary rounded-lg shadow border theme-border p-6 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium theme-text-primary mb-2">
              Employee <span class="text-red-500">*</span>
            </label>
            <select
              bind:value={selectedEmployeeId}
              class="w-full px-3 py-2 theme-border border rounded-md theme-bg-primary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Employee</option>
              {#each employees as emp}
                <option value={emp.emp_id}>{emp.emp_name} ({emp.emp_id})</option>
              {/each}
            </select>
            {#if errors.employee}
              <p class="text-red-500 text-xs mt-1">{errors.employee}</p>
            {/if}
          </div>

          <div>
            <label class="block text-sm font-medium theme-text-primary mb-2">
              From Date <span class="text-red-500">*</span>
            </label>
            <input
              type="date"
              bind:value={fromDate}
              class="w-full px-3 py-2 theme-border border rounded-md theme-bg-primary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium theme-text-primary mb-2">
              To Date <span class="text-red-500">*</span>
            </label>
            <input
              type="date"
              bind:value={toDate}
              class="w-full px-3 py-2 theme-border border rounded-md theme-bg-primary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {#if errors.dates}
          <p class="text-red-500 text-xs mt-2">{errors.dates}</p>
        {/if}

        <div class="mt-4">
          <Button
            on:click={loadPieceRateData}
            disabled={isDataLoading}
            class="px-6 py-2"
          >
            {isDataLoading ? 'Loading...' : 'Load Data'}
          </Button>
        </div>
      </div>

      <!-- Results -->
      {#if pieceRateData.length > 0}
        <div class="theme-bg-secondary rounded-lg shadow border theme-border overflow-hidden">
          <div class="p-6 border-b theme-border">
            <h2 class="text-lg font-semibold theme-text-primary">
              Piece Rate Report
              {#if selectedEmployee}
                - {selectedEmployee.emp_name} ({selectedEmployee.emp_id})
              {/if}
            </h2>
            <p class="text-sm theme-text-secondary mt-1">
              {formatDateLocal(fromDate)} to {formatDateLocal(toDate)}
            </p>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="theme-bg-secondary border-b theme-border">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">Date</th>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">Work Code</th>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">Work Name</th>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">Hours</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Piece Rate</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Rate/Hour</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Std Time (min)</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">POW</th>
                  <th class="px-4 py-3 text-center text-xs font-medium theme-text-primary uppercase">Type</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Overtime</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Lost Time</th>
                  <th class="px-4 py-3 text-center text-xs font-medium theme-text-primary uppercase">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y theme-border">
                {#each pieceRateData as report}
                  <tr class="hover:theme-bg-secondary transition-colors">
                    <td class="px-4 py-3 text-sm theme-text-primary">{formatDateLocal(report.from_date)}</td>
                    <td class="px-4 py-3 text-sm theme-text-primary">{getWorkCode(report)}</td>
                    <td class="px-4 py-3 text-sm theme-text-primary">{getWorkName(report)}</td>
                    <td class="px-4 py-3 text-sm theme-text-primary">{report.hours_worked_today?.toFixed(2) || '-'}</td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary font-medium">
                      {formatCurrency(report.pr_amount)}
                    </td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">
                      {formatCurrency(report.pr_rate)}
                    </td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">
                      {report.pr_std_time || '-'}
                    </td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">
                      {formatPercentage(report.pr_pow)}
                    </td>
                    <td class="px-4 py-3 text-sm text-center">
                      <span class="px-2 py-1 rounded text-xs {
                        report.pr_type === 'PR' 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                          : report.pr_type === 'SL'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }">
                        {report.pr_type || '-'}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">
                      {formatCurrency(report.overtime_amount)}
                    </td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">
                      {formatCurrency(
                        report.lt_details && Array.isArray(report.lt_details)
                          ? report.lt_details.reduce((sum: number, lt: any) => sum + (lt.lt_value || 0), 0)
                          : 0
                      )}
                    </td>
                    <td class="px-4 py-3 text-sm text-center">
                      <span class="px-2 py-1 rounded text-xs {
                        report.completion_status === 'C' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }">
                        {report.completion_status === 'C' ? 'Completed' : 'Not Completed'}
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
              <tfoot class="theme-bg-secondary border-t theme-border font-semibold">
                <tr>
                  <td colspan="3" class="px-4 py-3 text-sm theme-text-primary">Total</td>
                  <td class="px-4 py-3 text-sm theme-text-primary">{totalHours.toFixed(2)}</td>
                  <td class="px-4 py-3 text-sm text-right theme-text-primary">{formatCurrency(totalPieceRate)}</td>
                  <td colspan="5"></td>
                  <td class="px-4 py-3 text-sm text-right theme-text-primary">{formatCurrency(totalOvertime)}</td>
                  <td class="px-4 py-3 text-sm text-right theme-text-primary">{formatCurrency(totalLostTime)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="p-6 border-t theme-border">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p class="text-sm theme-text-secondary">Total Hours</p>
                <p class="text-lg font-semibold theme-text-primary">{totalHours.toFixed(2)}</p>
              </div>
              <div>
                <p class="text-sm theme-text-secondary">Total Piece Rate</p>
                <p class="text-lg font-semibold theme-text-primary">{formatCurrency(totalPieceRate)}</p>
              </div>
              <div>
                <p class="text-sm theme-text-secondary">Total Overtime</p>
                <p class="text-lg font-semibold theme-text-primary">{formatCurrency(totalOvertime)}</p>
              </div>
              <div>
                <p class="text-sm theme-text-secondary">Total Lost Time</p>
                <p class="text-lg font-semibold theme-text-primary">{formatCurrency(totalLostTime)}</p>
              </div>
            </div>
          </div>
        </div>
      {:else if isDataLoading}
        <div class="text-center py-12">
          <p class="theme-text-secondary">Loading data...</p>
        </div>
      {:else if selectedEmployeeId && fromDate && toDate}
        <div class="text-center py-12">
          <p class="theme-text-secondary">No data found for the selected criteria</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />

