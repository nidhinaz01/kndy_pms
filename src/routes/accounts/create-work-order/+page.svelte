<script lang="ts">
  import { onMount } from 'svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { getCurrentUsername } from '$lib/utils/userUtils';
  import {
    fetchNonCommercialNcCategories,
    fetchDistinctWoTypeCodes,
    fetchDistinctWoTypeNames,
    normalizeNcWoNo,
    createNonCommercialWo
  } from '$lib/api/accounts/nonCommercialWoService';

  let showSidebar = false;
  let menus: any[] = [];

  let ncCategories: string[] = [];
  let woTypeCodes: string[] = [];
  let woTypeNames: string[] = [];
  let isLoadingOptions = true;
  let isSubmitting = false;

  let wo_no = '';
  let pwo_no = '';
  let customer_name = '';
  let wo_date = '';
  let nc_category = '';
  let wo_type = '';
  let wo_model = '';
  let comments = '';

  let message = '';
  let messageType: 'success' | 'error' = 'success';

  /** Once a category is chosen, it stays fixed until Reset. */
  $: ncCategoryLocked = nc_category.trim() !== '';

  function showMsg(text: string, type: 'success' | 'error') {
    message = text;
    messageType = type;
  }

  function passesCommentsRule(): boolean {
    const t = wo_type.trim();
    const m = wo_model.trim();
    const c = comments.trim();
    if (t !== '' && m !== '') return true;
    return c !== '';
  }

  function onWoNoInput(e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value;
    wo_no = normalizeNcWoNo(v);
  }

  function resetForm() {
    message = '';
    wo_no = '';
    pwo_no = '';
    customer_name = '';
    wo_date = '';
    nc_category = '';
    wo_type = '';
    wo_model = '';
    comments = '';
  }

  async function handleSubmit() {
    message = '';
    const woNoNorm = normalizeNcWoNo(wo_no);
    if (!woNoNorm) {
      showMsg('WO number is required.', 'error');
      return;
    }
    if (!customer_name.trim()) {
      showMsg('Customer name is required.', 'error');
      return;
    }
    if (!wo_date) {
      showMsg('Date WO placed is required.', 'error');
      return;
    }
    if (!nc_category) {
      showMsg('Non-commercial category is required.', 'error');
      return;
    }
    if (!passesCommentsRule()) {
      showMsg('Comments are required unless both Type and Model are selected.', 'error');
      return;
    }

    isSubmitting = true;
    try {
      const { id } = await createNonCommercialWo({
        wo_no: woNoNorm,
        pwo_no: pwo_no.trim() || null,
        customer_name: customer_name.trim(),
        wo_date,
        nc_category,
        wo_type: wo_type || null,
        wo_model: wo_model || null,
        comments: comments.trim() || null
      });
      resetForm();
      showMsg(`Non-commercial work order saved (prdn_wo_details.id = ${id}).`, 'success');
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code === '23505') {
        showMsg('This WO number already exists. Use a different number.', 'error');
      } else {
        showMsg(err?.message || 'Could not save. Please try again.', 'error');
      }
      console.error(e);
    } finally {
      isSubmitting = false;
    }
  }

  onMount(async () => {
    try {
      const username = getCurrentUsername();
      menus = await fetchUserMenus(username);
    } catch {
      menus = [];
    }
    isLoadingOptions = true;
    try {
      [ncCategories, woTypeCodes, woTypeNames] = await Promise.all([
        fetchNonCommercialNcCategories(),
        fetchDistinctWoTypeCodes(),
        fetchDistinctWoTypeNames()
      ]);
    } catch (e) {
      console.error(e);
      showMsg('Could not load dropdown options. Check data elements and vehicle types.', 'error');
    } finally {
      isLoadingOptions = false;
    }
  });
</script>

<svelte:head>
  <title>Accounts — Create non-commercial work order</title>
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
  <AppHeader
    title="Create non-commercial work order"
    onSidebarToggle={() => (showSidebar = !showSidebar)}
  />

  <div class="p-4 md:p-6 max-w-3xl mx-auto w-full">
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

    <div class="theme-bg-primary rounded-lg shadow border theme-border p-6">
      {#if isLoadingOptions}
        <p class="theme-text-secondary">Loading options…</p>
      {:else}
        <form
          class="space-y-4"
          on:submit|preventDefault={handleSubmit}
        >
          <!-- Row 1: category + WO number -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="nc_category" class="block text-sm font-medium theme-text-primary mb-1"
                >Non-commercial category *</label
              >
              <select
                id="nc_category"
                bind:value={nc_category}
                disabled={ncCategoryLocked}
                class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                required
              >
                <option value="">— Select —</option>
                {#each ncCategories as c}
                  <option value={c}>{c}</option>
                {/each}
              </select>
            </div>
            <div>
              <label for="wo_no" class="block text-sm font-medium theme-text-primary mb-1">WO number *</label>
              <input
                id="wo_no"
                type="text"
                value={wo_no}
                on:input={onWoNoInput}
                autocomplete="off"
                class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="No spaces (e.g. JBC/100/25)"
                required
              />
            </div>
          </div>
          {#if ncCategoryLocked}
            <p class="text-xs theme-text-secondary mt-1">
              Category is locked for this entry. Use <strong>Reset form</strong> (next to Save) to clear
              everything and choose a different category.
            </p>
          {/if}

          <!-- Row 2: production/commercial WO + date -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="pwo_no" class="block text-sm font-medium theme-text-primary mb-1"
                >Production / commercial WO no. (optional)</label
              >
              <input
                id="pwo_no"
                type="text"
                bind:value={pwo_no}
                maxlength="10"
                class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label for="wo_date" class="block text-sm font-medium theme-text-primary mb-1"
                >Date WO placed *</label
              >
              <input
                id="wo_date"
                type="date"
                bind:value={wo_date}
                max={new Date().toISOString().split('T')[0]}
                class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <!-- Row 3: customer -->
          <div>
            <label for="customer_name" class="block text-sm font-medium theme-text-primary mb-1"
              >Customer name *</label
            >
            <input
              id="customer_name"
              type="text"
              bind:value={customer_name}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          <!-- Row 4: Type + Model -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="wo_type" class="block text-sm font-medium theme-text-primary mb-1">Type</label>
              <select
                id="wo_type"
                bind:value={wo_type}
                class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">— Select —</option>
                {#each woTypeCodes as code}
                  <option value={code}>{code}</option>
                {/each}
              </select>
            </div>
            <div>
              <label for="wo_model" class="block text-sm font-medium theme-text-primary mb-1">Model</label>
              <select
                id="wo_model"
                bind:value={wo_model}
                class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">— Select —</option>
                {#each woTypeNames as name}
                  <option value={name}>{name}</option>
                {/each}
              </select>
            </div>
          </div>

          <!-- Row 5: comments -->
          <div>
            <label for="comments" class="block text-sm font-medium theme-text-primary mb-1">Comments</label>
            <textarea
              id="comments"
              bind:value={comments}
              rows="3"
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Required if Type or Model is not selected."
            ></textarea>
          </div>

          <div class="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" disabled={isSubmitting} on:click={resetForm}>
              Reset form
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      {/if}
    </div>
  </div>

  <FloatingThemeToggle />
</div>
