<script lang="ts">
  import { onMount } from 'svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { fetchStages } from '$lib/api/employee';
  import {
    fetchActiveEmployeesByStage,
    fetchActiveShiftOptions,
    computeTargetShiftOptions,
    fetchShiftChangeHistory,
    applyShiftChangeForEmployees,
    type StageEmployeeRow,
    type ShiftOption,
    type ShiftChangeLogRow
  } from '$lib/api/production';
  import { getCurrentUsername } from '$lib/utils/userUtils';
  import { formatDateTimeLocal } from '$lib/utils/formatDate';

  let showSidebar = false;
  let menus: any[] = [];

  let stages: string[] = [];
  let selectedStage = '';
  let employees: StageEmployeeRow[] = [];
  let allShifts: ShiftOption[] = [];
  let isLoadingStages = false;
  let isLoadingEmployees = false;
  let isSavingShift = false;

  let selectedIds = new Set<string>();
  let message = '';
  let messageType: 'success' | 'error' = 'success';

  let showChangeModal = false;
  let targetShiftOptions: ShiftOption[] = [];
  let selectedNewShift = '';

  let showHistoryModal = false;
  let historyForEmpId = '';
  let historyForEmpName = '';
  let historyRows: ShiftChangeLogRow[] = [];
  let isHistoryLoading = false;

  $: selectedRows = employees.filter((e) => selectedIds.has(e.emp_id));
  $: allSelectedOnPage =
    employees.length > 0 && employees.every((e) => selectedIds.has(e.emp_id));

  function showMsg(text: string, type: 'success' | 'error') {
    message = text;
    messageType = type;
  }

  async function loadStages() {
    isLoadingStages = true;
    try {
      stages = await fetchStages();
    } catch (e) {
      console.error(e);
      showMsg('Could not load stages.', 'error');
    } finally {
      isLoadingStages = false;
    }
  }

  async function loadAllShifts() {
    try {
      allShifts = await fetchActiveShiftOptions();
    } catch (e) {
      console.error(e);
    }
  }

  async function loadEmployeesForStage() {
    if (!selectedStage) {
      employees = [];
      selectedIds = new Set();
      return;
    }
    isLoadingEmployees = true;
    selectedIds = new Set();
    try {
      employees = await fetchActiveEmployeesByStage(selectedStage);
    } catch (e) {
      console.error(e);
      employees = [];
      showMsg('Could not load employees for this stage.', 'error');
    } finally {
      isLoadingEmployees = false;
    }
  }

  function toggleSelect(empId: string) {
    const next = new Set(selectedIds);
    if (next.has(empId)) next.delete(empId);
    else next.add(empId);
    selectedIds = next;
  }

  function toggleSelectAllOnPage() {
    if (allSelectedOnPage) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(employees.map((e) => e.emp_id));
    }
  }

  function openChangeModal() {
    if (selectedRows.length === 0) return;
    targetShiftOptions = computeTargetShiftOptions(selectedRows, allShifts);
    selectedNewShift = targetShiftOptions[0]?.shift_code ?? '';
    if (targetShiftOptions.length === 0) {
      showMsg('No alternative shifts are available for the current selection.', 'error');
      return;
    }
    showChangeModal = true;
  }

  async function confirmShiftChange() {
    if (!selectedStage || !selectedNewShift || selectedRows.length === 0) return;
    isSavingShift = true;
    try {
      const username = getCurrentUsername();
      const empIds = selectedRows.map((r) => r.emp_id);
      const { updated, skipped } = await applyShiftChangeForEmployees(
        selectedStage,
        empIds,
        selectedNewShift,
        username
      );
      showChangeModal = false;
      selectedIds = new Set();
      await loadEmployeesForStage();
      if (updated > 0) {
        showMsg(
          `Updated shift for ${updated} employee(s).${skipped > 0 ? ` ${skipped} skipped (already on shift or not found).` : ''}`,
          'success'
        );
      } else {
        showMsg('No rows were updated (selection may already be on the chosen shift).', 'error');
      }
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Shift update failed.';
      showMsg(msg, 'error');
    } finally {
      isSavingShift = false;
    }
  }

  async function openHistory(empId: string, empName: string) {
    historyForEmpId = empId;
    historyForEmpName = empName;
    showHistoryModal = true;
    isHistoryLoading = true;
    historyRows = [];
    try {
      historyRows = await fetchShiftChangeHistory(empId);
    } catch (e) {
      console.error(e);
      showMsg('Could not load shift history.', 'error');
    } finally {
      isHistoryLoading = false;
    }
  }

  function closeHistory() {
    showHistoryModal = false;
    historyRows = [];
  }

  onMount(async () => {
    const username = localStorage.getItem('username');
    if (!username) {
      window.location.href = '/';
      return;
    }
    menus = await fetchUserMenus(username);
    await Promise.all([loadStages(), loadAllShifts()]);
  });

  function onStageSelectChange() {
    loadEmployeesForStage();
  }
</script>

<svelte:head>
  <title>PMS - Shift Change</title>
</svelte:head>

{#if showSidebar}
  <div class="fixed inset-0 z-50">
    <button
      type="button"
      aria-label="Close sidebar overlay"
      class="fixed inset-0 bg-black bg-opacity-40 z-40"
      on:click={() => (showSidebar = false)}
    ></button>
    <div class="fixed left-0 top-0 h-full w-64 z-50 theme-bg-primary shadow-lg">
      <Sidebar {menus} />
    </div>
  </div>
{/if}

<div class="flex flex-col min-h-screen theme-bg-secondary transition-colors duration-200">
  <AppHeader title="Shift change" onSidebarToggle={() => (showSidebar = !showSidebar)} />

  <div class="p-4 md:p-6 max-w-7xl mx-auto w-full">
    {#if message}
      <div
        class={`mb-4 p-4 rounded-lg ${
          messageType === 'success'
            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
            : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
        }`}
      >
        {message}
      </div>
    {/if}

    <div class="theme-bg-primary rounded-lg shadow border theme-border p-6 mb-6">
      <h1 class="text-lg font-semibold theme-text-primary mb-2">Select stage</h1>
      <p class="text-sm theme-text-secondary mb-4">
        Load active employees for the stage, then select who should move to another shift. Changes are stored in
        <code class="text-xs">hr_emp.shift_code</code> and audited in
        <code class="text-xs">prdn_emp_shift_change_log</code>.
      </p>
      <div class="flex flex-wrap items-end gap-4">
        <div>
          <label for="stage-select" class="block text-sm font-medium theme-text-primary mb-1">Stage</label>
          <select
            id="stage-select"
            bind:value={selectedStage}
            on:change={onStageSelectChange}
            class="border theme-border rounded-lg px-3 py-2 theme-bg-secondary theme-text-primary min-w-[14rem]"
            disabled={isLoadingStages}
          >
            <option value="">— Choose stage —</option>
            {#each stages as s}
              <option value={s}>{s}</option>
            {/each}
          </select>
        </div>
      </div>
    </div>

    {#if selectedStage}
      <div class="theme-bg-primary rounded-lg shadow border theme-border overflow-hidden">
        <div
          class="p-4 border-b theme-border flex flex-wrap items-center justify-between gap-3"
        >
          <h2 class="text-md font-semibold theme-text-primary">
            Employees — {selectedStage}
            {#if !isLoadingEmployees}
              <span class="text-sm font-normal theme-text-secondary">({employees.length})</span>
            {/if}
          </h2>
          <Button
            variant="primary"
            size="md"
            disabled={selectedRows.length === 0 || isLoadingEmployees}
            on:click={openChangeModal}
          >
            Change shift ({selectedRows.length})
          </Button>
        </div>

        {#if isLoadingEmployees}
          <div class="p-12 text-center theme-text-secondary">Loading employees…</div>
        {:else if employees.length === 0}
          <div class="p-12 text-center theme-text-secondary">No active employees for this stage.</div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="theme-bg-secondary border-b theme-border">
                <tr>
                  <th class="p-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allSelectedOnPage}
                      on:change={toggleSelectAllOnPage}
                      aria-label="Select all on page"
                    />
                  </th>
                  <th class="p-3 text-left theme-text-primary">Employee ID</th>
                  <th class="p-3 text-left theme-text-primary">Name</th>
                  <th class="p-3 text-left theme-text-primary">Skill</th>
                  <th class="p-3 text-left theme-text-primary">Shift code</th>
                  <th class="p-3 text-left theme-text-primary">Shift name</th>
                  <th class="p-3 text-left theme-text-primary w-44">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each employees as row (row.emp_id)}
                  <tr class="border-b theme-border hover:theme-bg-secondary/50">
                    <td class="p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.emp_id)}
                        on:change={() => toggleSelect(row.emp_id)}
                        aria-label="Select {row.emp_id}"
                      />
                    </td>
                    <td class="p-3 theme-text-primary font-mono text-xs">{row.emp_id}</td>
                    <td class="p-3 theme-text-primary">{row.emp_name}</td>
                    <td class="p-3 theme-text-secondary">{row.skill_short}</td>
                    <td class="p-3 theme-text-primary">{row.shift_code}</td>
                    <td class="p-3 theme-text-secondary">{row.shift_name ?? '—'}</td>
                    <td class="p-3">
                      <Button variant="secondary" size="sm" on:click={() => openHistory(row.emp_id, row.emp_name)}>
                        View shift history
                      </Button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<FloatingThemeToggle />

{#if showChangeModal}
  <div class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
    <div class="flex min-h-full items-center justify-center p-4">
      <div
        class="theme-bg-primary rounded-lg shadow-xl max-w-md w-full border theme-border p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-shift-title"
      >
        <h2 id="change-shift-title" class="text-lg font-semibold theme-text-primary mb-2">Change shift</h2>
        <p class="text-sm theme-text-secondary mb-4">
          {selectedRows.length} employee(s) selected. Choose the new shift.
        </p>
        <label for="new-shift" class="block text-sm font-medium theme-text-primary mb-1">New shift</label>
        <select
          id="new-shift"
          bind:value={selectedNewShift}
          class="w-full border theme-border rounded-lg px-3 py-2 theme-bg-secondary theme-text-primary mb-6"
        >
          {#each targetShiftOptions as opt}
            <option value={opt.shift_code}>
              {opt.shift_code}{opt.shift_name ? ` — ${opt.shift_name}` : ''}
            </option>
          {/each}
        </select>
        <div class="flex justify-end gap-2">
          <Button variant="secondary" size="md" disabled={isSavingShift} on:click={() => (showChangeModal = false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={isSavingShift || !selectedNewShift}
            on:click={confirmShiftChange}
          >
            {isSavingShift ? 'Saving…' : 'Apply'}
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showHistoryModal}
  <div class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
    <div class="flex min-h-full items-center justify-center p-4">
      <div
        class="theme-bg-primary rounded-lg shadow-xl max-w-2xl w-full border theme-border p-6 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div class="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 class="text-lg font-semibold theme-text-primary">Shift history</h2>
            <p class="text-sm theme-text-secondary mt-1">
              {historyForEmpName} (<span class="font-mono">{historyForEmpId}</span>)
            </p>
          </div>
          <button
            type="button"
            class="theme-text-secondary hover:theme-text-primary p-1"
            aria-label="Close"
            on:click={closeHistory}
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {#if isHistoryLoading}
          <p class="theme-text-secondary py-8 text-center">Loading…</p>
        {:else if historyRows.length === 0}
          <p class="theme-text-secondary py-8 text-center">No shift changes recorded yet.</p>
        {:else}
          <div class="overflow-x-auto border theme-border rounded-lg">
            <table class="w-full text-sm">
              <thead class="theme-bg-secondary">
                <tr>
                  <th class="p-2 text-left theme-text-primary">From</th>
                  <th class="p-2 text-left theme-text-primary">To</th>
                  <th class="p-2 text-left theme-text-primary">When</th>
                  <th class="p-2 text-left theme-text-primary">By</th>
                </tr>
              </thead>
              <tbody>
                {#each historyRows as h (h.id)}
                  <tr class="border-t theme-border">
                    <td class="p-2 theme-text-primary">{h.shift_code_from}</td>
                    <td class="p-2 theme-text-primary">{h.shift_code_to}</td>
                    <td class="p-2 theme-text-secondary whitespace-nowrap">{formatDateTimeLocal(h.changed_at)}</td>
                    <td class="p-2 theme-text-secondary">{h.changed_by}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
        <div class="flex justify-end mt-4">
          <Button variant="secondary" size="md" on:click={closeHistory}>Close</Button>
        </div>
      </div>
    </div>
  </div>
{/if}
