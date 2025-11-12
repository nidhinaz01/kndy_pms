<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fetchPlantStages, fetchMaxSeqNo, insertStdWorkDetail } from '$lib/api/stdWorkDetails';
  import Button from '$lib/components/common/Button.svelte';
  import { supabase } from '$lib/supabaseClient';

  export let showAddModal: boolean;
  export let onClose: () => void;
  export let onItemAdded: () => void;

  let plantStages: string[] = [];
  let selectedPlantStage = '';
  let workTypes = ['Parent', 'Mother', 'Child'];
  let selectedWorkType = '';
  let workDetails = '';
  let workCode = '';
  let seqNo = 0;
  let errorMsg = '';
  let submitting = false;

  const dispatch = createEventDispatcher();

  onMount(async () => {
    plantStages = await fetchPlantStages();
  });

  $: if (selectedWorkType) {
    fetchMaxSeqNo(selectedWorkType).then(maxSeq => {
      seqNo = maxSeq + 1;
      workCode = `${selectedWorkType.charAt(0).toUpperCase()}${seqNo.toString().padStart(3, '0')}`;
    });
  } else {
    workCode = '';
    seqNo = 0;
  }

  async function handleSubmit() {
    errorMsg = '';
    if (!selectedPlantStage || !selectedWorkType || !workDetails.trim()) {
      errorMsg = 'All fields are required.';
      return;
    }
    if (workDetails.length > 200) {
      errorMsg = 'Work Details must be less than 200 characters.';
      return;
    }
    if (!workCode) {
      errorMsg = 'Work Code could not be generated.';
      return;
    }
    submitting = true;
    try {
      // Fix: use getUser() instead of supabase.auth.user
      const { data: userData } = await supabase.auth.getUser();
      const username = userData?.user?.email || 'system';
      const now = new Date().toISOString();
      await insertStdWorkDetail({
        sw_code: workCode,
        sw_name: workDetails,
        plant_stage: selectedPlantStage,
        sw_type: selectedWorkType as 'Parent' | 'Mother' | 'Child',
        sw_seq_no: seqNo,
        created_by: username,
        created_dt: now,
        modified_by: username,
        modified_dt: now,
        is_active: true
      });
      // Reset form
      selectedPlantStage = '';
      selectedWorkType = '';
      workDetails = '';
      workCode = '';
      seqNo = 0;
      onItemAdded();
    } catch (e: any) {
      errorMsg = 'Error saving work detail: ' + (e.message || e);
    } finally {
      submitting = false;
    }
  }

  function handleClose() {
    selectedPlantStage = '';
    selectedWorkType = '';
    workDetails = '';
    workCode = '';
    seqNo = 0;
    errorMsg = '';
    onClose();
  }
</script>

{#if showAddModal}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[32rem] animate-fade-in">
      <div class="flex items-center justify-between mb-6">
        <div class="font-bold text-lg theme-text-accent flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add New Work
        </div>
        <button class="theme-text-secondary hover:theme-text-accent transition-colors" on:click={handleClose} aria-label="Close modal">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {#if errorMsg}
        <div class="theme-text-danger mb-2">{errorMsg}</div>
      {/if}
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div>
          <label for="plantStage" class="block text-sm font-medium theme-text-primary mb-1">Plant - Stage *</label>
          <select id="plantStage" bind:value={selectedPlantStage} class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary" required>
            <option value="">Select Plant - Stage</option>
            {#each plantStages as stage}
              <option value={stage}>{stage}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="workType" class="block text-sm font-medium theme-text-primary mb-1">Type of Work *</label>
          <select id="workType" bind:value={selectedWorkType} class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary" required>
            <option value="">Select Type</option>
            {#each workTypes as type}
              <option value={type}>{type}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="workDetails" class="block text-sm font-medium theme-text-primary mb-1">Work Details *</label>
          <input id="workDetails" type="text" bind:value={workDetails} maxlength="200" class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary" placeholder="Enter work details (max 200 chars)" required />
        </div>
        <div>
          <label for="workCode" class="block text-sm font-medium theme-text-primary mb-1">Work Code</label>
          <input id="workCode" type="text" value={workCode} class="w-full border theme-border rounded px-3 py-2 theme-bg-tertiary theme-text-secondary" readonly />
        </div>
        <div class="flex justify-between gap-3 pt-4">
          <Button type="submit" variant="success" size="md" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Work'}
          </Button>
          <Button type="button" variant="secondary" size="md" on:click={handleClose}>Cancel</Button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.2s ease;
  }
</style> 