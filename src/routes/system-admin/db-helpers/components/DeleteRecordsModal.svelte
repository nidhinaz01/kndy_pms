<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import { supabase } from '$lib/supabaseClient';

  export let show = false;
  export let onClose: () => void = () => {};

  type TableOption = {
    table: 'prdn_work_planning' | 'prdn_work_reporting';
    label: string;
    pkColumn: string;
  };

  const tableOptions: TableOption[] = [
    { table: 'prdn_work_planning', label: 'prdn_work_planning', pkColumn: 'id' },
    { table: 'prdn_work_reporting', label: 'prdn_work_reporting', pkColumn: 'id' }
  ];

  let selectedTable: TableOption['table'] = 'prdn_work_planning';
  let pkInput = '';
  let loadingPreview = false;
  let deleting = false;
  let errorMessage = '';
  let successMessage = '';
  let rows: Record<string, unknown>[] = [];
  let selectedRowPk: string | null = null;
  let confirmText = '';

  $: currentTableOption = tableOptions.find((t) => t.table === selectedTable) ?? tableOptions[0];
  $: allColumns = (() => {
    const s = new Set<string>();
    for (const row of rows) {
      Object.keys(row || {}).forEach((k) => s.add(k));
    }
    const rest = [...s].filter((k) => k !== currentTableOption.pkColumn).sort();
    return [currentTableOption.pkColumn, ...rest];
  })();
  $: canDelete = selectedRowPk !== null && confirmText.trim() === 'DELETE';

  $: if (show) {
    successMessage = '';
  }

  function closeModal() {
    onClose();
  }

  function formatCell(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  }

  async function getAccessToken(): Promise<string | null> {
    for (let i = 0; i < 10; i++) {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || null;
      if (token) return token;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    // Try one refresh cycle in case session exists but token was not hydrated yet.
    try {
      await supabase.auth.refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch {
      return null;
    }
  }

  async function authFetch(payload: Record<string, unknown>) {
    const token = await getAccessToken();
    if (!token) throw new Error('No active session. Please sign in again.');
    const res = await fetch('/api/system-admin/db-records', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
    return body;
  }

  async function previewRecords() {
    errorMessage = '';
    successMessage = '';
    rows = [];
    selectedRowPk = null;
    confirmText = '';
    if (!pkInput.trim()) {
      errorMessage = `Enter ${currentTableOption.pkColumn} first.`;
      return;
    }
    loadingPreview = true;
    try {
      const body = await authFetch({
        action: 'preview',
        table: selectedTable,
        pkValue: pkInput.trim()
      });
      rows = Array.isArray(body?.rows) ? body.rows : [];
      if (rows.length === 0) {
        successMessage = 'No rows found.';
      } else {
        successMessage = `Loaded ${rows.length} row(s). Select one to delete.`;
      }
    } catch (e) {
      errorMessage = (e as Error)?.message || 'Failed to preview records.';
    } finally {
      loadingPreview = false;
    }
  }

  async function deleteSelectedRecord() {
    if (!canDelete || !selectedRowPk) return;
    deleting = true;
    errorMessage = '';
    successMessage = '';
    try {
      const body = await authFetch({
        action: 'delete',
        table: selectedTable,
        pkValue: selectedRowPk
      });
      const deletedCount = Number(body?.deletedCount || 0);
      successMessage = deletedCount > 0 ? `Deleted ${deletedCount} row(s).` : 'No rows deleted (already removed?).';
      rows = rows.filter((r) => String(r?.[currentTableOption.pkColumn] ?? '') !== selectedRowPk);
      selectedRowPk = null;
      confirmText = '';
    } catch (e) {
      errorMessage = (e as Error)?.message || 'Delete failed.';
    } finally {
      deleting = false;
    }
  }
</script>

{#if show}
  <div class="fixed inset-0 z-[220] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-records-title">
    <button
      type="button"
      class="absolute inset-0 z-0 border-none bg-black/50 p-0"
      aria-label="Close"
      on:click={closeModal}
    ></button>
    <div class="relative z-10 flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border-2 border-slate-300 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900">
      <div class="border-b border-slate-200 px-4 py-3 dark:border-slate-600 sm:px-6">
        <h2 id="delete-records-title" class="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Delete records
        </h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Hard delete a selected row from allowed tables. Load rows by primary key, select one record, then type
          <code class="text-xs">DELETE</code> to confirm.
        </p>
      </div>

      <div class="space-y-4 px-4 py-4 sm:px-6">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium theme-text-primary">Table</span>
            <select
              class="h-10 rounded border theme-border theme-bg-primary px-3 theme-text-primary"
              bind:value={selectedTable}
              disabled={loadingPreview || deleting}
            >
              {#each tableOptions as opt}
                <option value={opt.table}>{opt.label}</option>
              {/each}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm md:col-span-2">
            <span class="font-medium theme-text-primary">Primary key ({currentTableOption.pkColumn})</span>
            <div class="flex gap-2">
              <input
                class="h-10 w-full rounded border theme-border theme-bg-primary px-3 theme-text-primary"
                bind:value={pkInput}
                placeholder={`Enter ${currentTableOption.pkColumn}`}
                disabled={loadingPreview || deleting}
              />
              <Button
                variant="secondary"
                size="sm"
                class="!h-10 !px-3 !py-0 whitespace-nowrap"
                on:click={previewRecords}
                disabled={loadingPreview || deleting}
              >
                {loadingPreview ? 'Loading…' : 'Load records'}
              </Button>
            </div>
          </label>
        </div>

        {#if errorMessage}
          <p class="text-sm text-red-600 dark:text-red-400" role="alert">{errorMessage}</p>
        {/if}
        {#if successMessage}
          <p class="text-sm text-green-700 dark:text-green-400" role="status">{successMessage}</p>
        {/if}
      </div>

      <div class="min-h-0 flex-1 overflow-auto border-y border-slate-200 px-4 py-3 dark:border-slate-600 sm:px-6">
        {#if rows.length === 0}
          <p class="text-sm text-slate-500 dark:text-slate-400">No records loaded.</p>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full min-w-[900px] text-left text-xs sm:text-sm">
              <thead class="border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th class="w-14 px-2 py-2">Select</th>
                  {#each allColumns as col (col)}
                    <th class="whitespace-nowrap px-2 py-2 font-mono text-[10px] font-normal text-slate-600 dark:text-slate-400">
                      {col}
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each rows as row, idx (`${row?.[currentTableOption.pkColumn] ?? 'na'}_${idx}`)}
                  {@const rowPk = String(row?.[currentTableOption.pkColumn] ?? '')}
                  <tr class="border-b border-slate-100 dark:border-slate-800">
                    <td class="px-2 py-2 align-top">
                      <input
                        type="radio"
                        name="delete-record-selected-row"
                        checked={selectedRowPk === rowPk}
                        on:change={() => (selectedRowPk = rowPk)}
                        disabled={deleting || !rowPk}
                        aria-label={`Select row ${rowPk}`}
                      />
                    </td>
                    {#each allColumns as col (col)}
                      <td class="max-w-[16rem] whitespace-pre-wrap break-words px-2 py-2 align-top font-mono text-[11px] leading-snug">
                        {formatCell(row?.[col])}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>

      <div class="flex flex-wrap items-end justify-between gap-3 px-4 py-3 sm:px-6">
        <label class="flex min-w-[260px] flex-1 flex-col gap-1 text-sm">
          <span class="font-medium theme-text-primary">Type DELETE to confirm</span>
          <input
            class="h-10 rounded border theme-border theme-bg-primary px-3 theme-text-primary"
            bind:value={confirmText}
            placeholder="DELETE"
            disabled={deleting || rows.length === 0}
          />
        </label>
        <div class="flex items-end gap-2 self-end">
          <Button variant="secondary" size="sm" class="!h-10 !px-3 !py-0" on:click={closeModal} disabled={deleting}>Close</Button>
          <Button
            variant="danger"
            size="sm"
            class="!h-10 !px-3 !py-0"
            on:click={deleteSelectedRecord}
            disabled={!canDelete || deleting}
          >
            {deleting ? 'Deleting…' : 'Delete selected record'}
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}
