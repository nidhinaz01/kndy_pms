<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchSkillHistory, bulkUpdateSkillVersions, addNewSkillVersion, validateSkillDateRanges, type SkillMaster } from '$lib/api/skillMaster';
  import { X, History, Plus, Save, Trash2, CheckCircle } from 'lucide-svelte';

  // Lazy load Chart component to avoid SSR issues
  let Chart: any = null;
  if (browser) {
    import('svelte-apexcharts').then(module => {
      Chart = module.default;
    });
  }

  export let showModal = false;
  export let skillName: string = '';
  export let skillShort: string = '';
  export let onClose: () => void;
  export let onSave: () => void;

  let versions: SkillMaster[] = [];
  let selectedVersion: SkillMaster | null = null;
  let isLoading = false;
  let isSaving = false;
  let errorMessage = '';
  let successMessage = '';

  // Form state for editing
  let editingVersion: Partial<SkillMaster> = {};
  let showAddNewVersion = false;
  let newVersionData = {
    wef_date: '',
    wef_time: '00:00:00',
    rate_per_hour: '',
    min_salary: '',
    max_salary: ''
  };

  // Chart data
  let chartOptions: any = {};
  let chartSeries: any[] = [];

  // Load skill history
  async function loadHistory() {
    if (!skillName) return;
    
    isLoading = true;
    errorMessage = '';
    try {
      versions = await fetchSkillHistory(skillName);
      
      // Ensure all versions have required fields with defaults
      versions = versions.map(v => ({
        ...v,
        wef_date: v.wef_date || v.wef || new Date().toISOString().split('T')[0],
        wef_time: v.wef_time || '00:00:00',
        wet_date: v.wet_date || null,
        wet_time: v.wet_time || null
      }));
      
      // Sort by date (oldest first)
      versions.sort((a, b) => {
        const dateCompare = (a.wef_date || '').localeCompare(b.wef_date || '');
        if (dateCompare !== 0) return dateCompare;
        return (a.wef_time || '00:00:00').localeCompare(b.wef_time || '00:00:00');
      });

      // Select first version if none selected
      if (versions.length > 0 && !selectedVersion) {
        selectedVersion = versions[0];
        editingVersion = { ...selectedVersion };
      }

      updateChart();
    } catch (error) {
      console.error('Error loading skill history:', error);
      errorMessage = `Failed to load skill history: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      isLoading = false;
    }
  }

  // Update chart data
  function updateChart() {
    if (versions.length === 0) {
      chartSeries = [];
      return;
    }

    // Prepare data for chart
    const chartData: Array<{ x: string; y: number }> = [];
    
    versions.forEach((version, index) => {
      if (!version.wef_date) return;
      const dateStr = `${version.wef_date}`;
      chartData.push({
        x: dateStr,
        y: version.rate_per_hour || 0
      });

      // If this version has an end date, add a point at the end date too
      if (version.wet_date) {
        chartData.push({
          x: `${version.wet_date}`,
          y: version.rate_per_hour || 0
        });
      }
    });

    chartSeries = [{
      name: 'Rate per Hour',
      data: chartData.map(d => d.y)
    }];

    chartOptions = {
      chart: {
        type: 'line',
        height: 300,
        toolbar: { show: false }
      },
      xaxis: {
        type: 'datetime',
        categories: chartData.map(d => d.x),
        labels: {
          format: 'MMM yyyy'
        }
      },
      yaxis: {
        title: {
          text: 'Rate per Hour (₹)'
        }
      },
      stroke: {
        curve: 'stepline'
      },
      markers: {
        size: 6
      },
      tooltip: {
        y: {
          formatter: (val: number) => `₹${val}/hour`
        }
      },
      theme: {
        mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
      }
    };
  }

  // Select version to edit
  function selectVersion(version: SkillMaster) {
    selectedVersion = version;
    editingVersion = { ...version };
    showAddNewVersion = false;
  }

  // Handle form field changes
  function handleFieldChange(field: string, value: any) {
    if (!editingVersion) return;
    editingVersion[field] = value;
  }

  // Auto-adjust adjacent versions when dates change
  async function handleDateChange(field: 'wef_date' | 'wef_time' | 'wet_date' | 'wet_time', value: string) {
    if (!editingVersion || !selectedVersion) return;

    const oldValue = editingVersion[field];
    editingVersion[field] = value;

    // Check if we need to auto-adjust
    const currentIndex = versions.findIndex(v => v.id === selectedVersion?.id);
    if (currentIndex === -1) return;

    const current = versions[currentIndex];
    const previous = currentIndex > 0 ? versions[currentIndex - 1] : null;
    const next = currentIndex < versions.length - 1 ? versions[currentIndex + 1] : null;

    let needsConfirmation = false;
    let confirmationMessage = '';

    // If changing wef_date or wef_time, adjust previous version's wet
    if ((field === 'wef_date' || field === 'wef_time') && previous) {
      const newWefDateTime = new Date(`${editingVersion.wef_date}T${editingVersion.wef_time || '00:00:00'}`);
      const prevEndDateTime = new Date(newWefDateTime);
      prevEndDateTime.setDate(prevEndDateTime.getDate() - 1);
      prevEndDateTime.setHours(23, 59, 59, 0);

      const prevWetDate = prevEndDateTime.toISOString().split('T')[0];
      const prevWetTime = '23:59:59';

      needsConfirmation = true;
      confirmationMessage = `This will adjust the previous version's end date/time to ${prevWetDate} ${prevWetTime}. Continue?`;

      if (confirm(confirmationMessage)) {
        // Update previous version in versions array
        const prevIndex = versions.findIndex(v => v.id === previous.id);
        if (prevIndex !== -1) {
          versions[prevIndex] = {
            ...versions[prevIndex],
            wet_date: prevWetDate,
            wet_time: prevWetTime
          };
        }
      } else {
        // Revert change
        editingVersion[field] = oldValue;
        return;
      }
    }

    // If changing wet_date or wet_time, adjust next version's wef
    if ((field === 'wet_date' || field === 'wet_time') && next) {
      const newWetDateTime = new Date(`${editingVersion.wet_date}T${editingVersion.wet_time || '23:59:59'}`);
      const nextStartDateTime = new Date(newWetDateTime);
      nextStartDateTime.setDate(nextStartDateTime.getDate() + 1);
      nextStartDateTime.setHours(0, 0, 0, 0);

      const nextWefDate = nextStartDateTime.toISOString().split('T')[0];
      const nextWefTime = '00:00:00';

      needsConfirmation = true;
      confirmationMessage = `This will adjust the next version's start date/time to ${nextWefDate} ${nextWefTime}. Continue?`;

      if (confirm(confirmationMessage)) {
        // Update next version in versions array
        const nextIndex = versions.findIndex(v => v.id === next.id);
        if (nextIndex !== -1) {
          versions[nextIndex] = {
            ...versions[nextIndex],
            wef_date: nextWefDate,
            wef_time: nextWefTime
          };
        }
      } else {
        // Revert change
        editingVersion[field] = oldValue;
        return;
      }
    }
  }

  // Save changes
  async function saveChanges() {
    if (!skillName) return;

    isSaving = true;
    errorMessage = '';
    successMessage = '';

    try {
      // Validate all versions
      const versionsToValidate = versions.map(v => ({
        id: v.id,
        wef_date: editingVersion.id === v.id ? (editingVersion.wef_date || v.wef_date) : v.wef_date,
        wef_time: editingVersion.id === v.id ? (editingVersion.wef_time || v.wef_time) : v.wef_time,
        wet_date: editingVersion.id === v.id ? (editingVersion.wet_date || v.wet_date) : v.wet_date,
        wet_time: editingVersion.id === v.id ? (editingVersion.wet_time || v.wet_time) : v.wet_time
      }));

      const validation = validateSkillDateRanges(versionsToValidate);
      if (!validation.isValid) {
        errorMessage = validation.errors.join('; ');
        return;
      }

      // Prepare versions for bulk update
      const versionsToUpdate = versions.map(v => {
        if (editingVersion.id === v.id) {
          return {
            id: v.id,
            rate_per_hour: Number(editingVersion.rate_per_hour) || v.rate_per_hour,
            min_salary: Number(editingVersion.min_salary) || v.min_salary,
            max_salary: Number(editingVersion.max_salary) || v.max_salary,
            wef_date: editingVersion.wef_date || v.wef_date,
            wef_time: editingVersion.wef_time || v.wef_time,
            wet_date: editingVersion.wet_date !== undefined ? editingVersion.wet_date : v.wet_date,
            wet_time: editingVersion.wet_time !== undefined ? editingVersion.wet_time : v.wet_time,
            is_active: !editingVersion.wet_date
          };
        }
        return {
          id: v.id,
          rate_per_hour: v.rate_per_hour,
          min_salary: v.min_salary,
          max_salary: v.max_salary,
          wef_date: v.wef_date,
          wef_time: v.wef_time,
          wet_date: v.wet_date,
          wet_time: v.wet_time,
          is_active: !v.wet_date
        };
      });

      const username = localStorage.getItem('username');
      if (!username) {
        errorMessage = 'User session not found';
        return;
      }

      await bulkUpdateSkillVersions(skillName, versionsToUpdate, username);
      
      successMessage = 'Changes saved successfully!';
      await loadHistory();
      onSave();
      
      setTimeout(() => {
        successMessage = '';
      }, 3000);
    } catch (error) {
      console.error('Error saving changes:', error);
      errorMessage = error instanceof Error ? error.message : 'Failed to save changes';
    } finally {
      isSaving = false;
    }
  }

  // Add new version
  async function handleAddNewVersion() {
    if (!newVersionData.wef_date || !newVersionData.wef_time) {
      errorMessage = 'Please select start date and time';
      return;
    }

    if (!newVersionData.rate_per_hour || !newVersionData.min_salary || !newVersionData.max_salary) {
      errorMessage = 'Please fill all required fields';
      return;
    }

    isSaving = true;
    errorMessage = '';
    successMessage = '';

    try {
      const username = localStorage.getItem('username');
      if (!username) {
        errorMessage = 'User session not found';
        return;
      }

      await addNewSkillVersion(
        skillName,
        newVersionData.wef_date,
        newVersionData.wef_time,
        {
          rate_per_hour: Number(newVersionData.rate_per_hour),
          min_salary: Number(newVersionData.min_salary),
          max_salary: Number(newVersionData.max_salary),
          is_active: true
        },
        username
      );

      successMessage = 'New version added successfully!';
      showAddNewVersion = false;
      newVersionData = {
        wef_date: '',
        wef_time: '00:00:00',
        rate_per_hour: '',
        min_salary: '',
        max_salary: ''
      };

      await loadHistory();
      onSave();
      
      setTimeout(() => {
        successMessage = '';
      }, 3000);
    } catch (error) {
      console.error('Error adding new version:', error);
      errorMessage = error instanceof Error ? error.message : 'Failed to add new version';
    } finally {
      isSaving = false;
    }
  }

  // Set version as active
  async function setAsActive(version: SkillMaster) {
    if (!version.wet_date) {
      // Already active
      return;
    }

    if (!confirm(`Set this version as active? This will end the current active version.`)) {
      return;
    }

    isSaving = true;
    errorMessage = '';
    successMessage = '';

    try {
      // Find current active version
      const currentActive = versions.find(v => !v.wet_date);
      
      if (currentActive) {
        // End current active version
        const wefDateTime = new Date(`${version.wef_date}T${version.wef_time || '00:00:00'}`);
        const prevEndDateTime = new Date(wefDateTime);
        prevEndDateTime.setDate(prevEndDateTime.getDate() - 1);
        prevEndDateTime.setHours(23, 59, 59, 0);

        const prevWetDate = prevEndDateTime.toISOString().split('T')[0];
        const prevWetTime = '23:59:59';

        // Update versions array
        const activeIndex = versions.findIndex(v => v.id === currentActive.id);
        if (activeIndex !== -1) {
          versions[activeIndex] = {
            ...versions[activeIndex],
            wet_date: prevWetDate,
            wet_time: prevWetTime
          };
        }
      }

      // Set selected version as active
      const versionIndex = versions.findIndex(v => v.id === version.id);
      if (versionIndex !== -1) {
        versions[versionIndex] = {
          ...versions[versionIndex],
          wet_date: null,
          wet_time: null
        };
        editingVersion = { ...versions[versionIndex] };
        selectedVersion = versions[versionIndex];
      }

      await saveChanges();
    } catch (error) {
      console.error('Error setting version as active:', error);
      errorMessage = error instanceof Error ? error.message : 'Failed to set version as active';
    } finally {
      isSaving = false;
    }
  }

  // Delete version (soft delete, but prevent if only one)
  async function deleteVersion(version: SkillMaster) {
    if (versions.length <= 1) {
      errorMessage = 'Cannot delete the only remaining version';
      return;
    }

    if (!confirm(`Delete this version? This action cannot be undone.`)) {
      return;
    }

    // Soft delete by setting is_deleted
    const versionIndex = versions.findIndex(v => v.id === version.id);
    if (versionIndex !== -1) {
      versions.splice(versionIndex, 1);
      
      if (selectedVersion?.id === version.id) {
        selectedVersion = versions.length > 0 ? versions[0] : null;
        editingVersion = selectedVersion ? { ...selectedVersion } : {};
      }
      
      await saveChanges();
    }
  }

  // Format date for display
  function formatDateRange(version: SkillMaster): string {
    const start = `${version.wef_date} ${version.wef_time || '00:00:00'}`;
    if (!version.wet_date) {
      return `${start} - Active`;
    }
    return `${start} - ${version.wet_date} ${version.wet_time || '23:59:59'}`;
  }

  // Watch for modal open
  $: if (showModal && skillName) {
    loadHistory();
  }

  // Watch for theme changes to update chart
  $: if (chartOptions.chart) {
    chartOptions = {
      ...chartOptions,
      theme: {
        mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
      }
    };
  }
</script>

{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" tabindex="0">
    <div class="fixed inset-0 bg-black bg-opacity-50" on:click={onClose} on:keydown={(e) => e.key === 'Escape' && onClose()} role="button" tabindex="0" aria-label="Close modal"></div>
    <div class="theme-bg-primary border theme-border rounded-lg w-[95vw] max-w-7xl max-h-[90vh] overflow-hidden relative z-10 shadow-xl flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b theme-border">
        <div class="flex items-center space-x-3">
          <History class="w-6 h-6 theme-text-primary" />
          <div>
            <h3 class="text-xl font-semibold theme-text-primary">Skill History: {skillName}</h3>
            <p class="text-sm theme-text-secondary">Code: {skillShort}</p>
          </div>
        </div>
        <button
          on:click={onClose}
          class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Close modal"
        >
          <X class="w-5 h-5 theme-text-primary" />
        </button>
      </div>

      <!-- Messages -->
      {#if errorMessage}
        <div class="mx-6 mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">
          {errorMessage}
        </div>
      {/if}
      {#if successMessage}
        <div class="mx-6 mt-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-lg text-sm">
          {successMessage}
        </div>
      {/if}

      <!-- Main Content - Split View -->
      <div class="flex flex-1 overflow-hidden">
        <!-- Left Panel - Timeline List -->
        <div class="w-1/3 border-r theme-border overflow-y-auto p-4">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-lg font-semibold theme-text-primary">Versions</h4>
            <Button
              variant="primary"
              size="sm"
              on:click={() => {
                showAddNewVersion = true;
                selectedVersion = null;
                editingVersion = {};
              }}
            >
              <Plus class="w-4 h-4 mr-1" />
              Add Version
            </Button>
          </div>

          {#if isLoading}
            <div class="text-center py-8 theme-text-secondary">Loading...</div>
          {:else if versions.length === 0}
            <div class="text-center py-8 theme-text-secondary">No versions found</div>
          {:else}
            <div class="space-y-2">
              {#each versions as version (version.id)}
                <div
                  class="p-3 rounded-lg border theme-border cursor-pointer transition-colors {selectedVersion?.id === version.id ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}"
                  on:click={() => selectVersion(version)}
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center space-x-2 mb-1">
                        <span class="text-sm font-medium theme-text-primary">
                          ₹{version.rate_per_hour}/hour
                        </span>
                        {#if !version.wet_date}
                          <span class="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                            Active
                          </span>
                        {/if}
                      </div>
                      <div class="text-xs theme-text-secondary">
                        {formatDateRange(version)}
                      </div>
                    </div>
                    <div class="flex space-x-1 ml-2">
                      {#if version.wet_date}
                        <button
                          on:click|stopPropagation={() => setAsActive(version)}
                          class="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                          title="Set as Active"
                        >
                          <CheckCircle class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </button>
                      {/if}
                      {#if versions.length > 1}
                        <button
                          on:click|stopPropagation={() => deleteVersion(version)}
                          class="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                          title="Delete"
                        >
                          <Trash2 class="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Right Panel - Form and Chart -->
        <div class="flex-1 overflow-y-auto p-6">
          {#if showAddNewVersion}
            <!-- Add New Version Form -->
            <div class="space-y-4">
              <h4 class="text-lg font-semibold theme-text-primary mb-4">Add New Version</h4>
              
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium theme-text-primary mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    bind:value={newVersionData.wef_date}
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium theme-text-primary mb-2">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    step="1"
                    bind:value={newVersionData.wef_time}
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium theme-text-primary mb-2">
                    Rate per Hour (₹) *
                  </label>
                  <input
                    type="number"
                    bind:value={newVersionData.rate_per_hour}
                    min="0"
                    step="0.01"
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium theme-text-primary mb-2">
                    Min Salary (₹) *
                  </label>
                  <input
                    type="number"
                    bind:value={newVersionData.min_salary}
                    min="0"
                    step="0.01"
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium theme-text-primary mb-2">
                    Max Salary (₹) *
                  </label>
                  <input
                    type="number"
                    bind:value={newVersionData.max_salary}
                    min="0"
                    step="0.01"
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary"
                  />
                </div>
              </div>

              <div class="flex justify-end space-x-3 mt-6">
                <Button variant="secondary" on:click={() => {
                  showAddNewVersion = false;
                  newVersionData = {
                    wef_date: '',
                    wef_time: '00:00:00',
                    rate_per_hour: '',
                    min_salary: '',
                    max_salary: ''
                  };
                }}>
                  Cancel
                </Button>
                <Button variant="primary" on:click={handleAddNewVersion} disabled={isSaving}>
                  {isSaving ? 'Adding...' : 'Add Version'}
                </Button>
              </div>
            </div>
          {:else if selectedVersion && editingVersion}
            <!-- Edit Version Form -->
            <div class="space-y-6">
              <h4 class="text-lg font-semibold theme-text-primary mb-4">Edit Version</h4>
              
              <!-- Read-only fields -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium theme-text-primary mb-2">
                    Skill Name
                  </label>
                  <input
                    type="text"
                    value={skillName}
                    disabled
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-gray-100 dark:theme-bg-gray-800 theme-text-secondary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium theme-text-primary mb-2">
                    Skill Code
                  </label>
                  <input
                    type="text"
                    value={skillShort}
                    disabled
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-gray-100 dark:theme-bg-gray-800 theme-text-secondary"
                  />
                </div>
              </div>

              <!-- Date/Time fields -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium theme-text-primary mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={editingVersion.wef_date || ''}
                    on:change={(e) => handleDateChange('wef_date', e.target.value)}
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium theme-text-primary mb-2">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    step="1"
                    value={editingVersion.wef_time || '00:00:00'}
                    on:change={(e) => handleDateChange('wef_time', e.target.value)}
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium theme-text-primary mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editingVersion.wet_date || ''}
                    on:change={(e) => handleDateChange('wet_date', e.target.value || null)}
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary"
                  />
                  <p class="text-xs theme-text-secondary mt-1">Leave empty for active version</p>
                </div>
                <div>
                  <label class="block text-sm font-medium theme-text-primary mb-2">
                    End Time
                  </label>
                  <input
                    type="time"
                    step="1"
                    value={editingVersion.wet_time || '23:59:59'}
                    on:change={(e) => handleDateChange('wet_time', e.target.value || null)}
                    disabled={!editingVersion.wet_date}
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary disabled:opacity-50"
                  />
                </div>
              </div>

              <!-- Rate and Salary fields -->
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium theme-text-primary mb-2">
                    Rate per Hour (₹) *
                  </label>
                  <input
                    type="number"
                    value={editingVersion.rate_per_hour || ''}
                    on:input={(e) => handleFieldChange('rate_per_hour', Number(e.target.value))}
                    min="0"
                    step="0.01"
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium theme-text-primary mb-2">
                    Min Salary (₹) *
                  </label>
                  <input
                    type="number"
                    value={editingVersion.min_salary || ''}
                    on:input={(e) => handleFieldChange('min_salary', Number(e.target.value))}
                    min="0"
                    step="0.01"
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium theme-text-primary mb-2">
                    Max Salary (₹) *
                  </label>
                  <input
                    type="number"
                    value={editingVersion.max_salary || ''}
                    on:input={(e) => handleFieldChange('max_salary', Number(e.target.value))}
                    min="0"
                    step="0.01"
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary"
                  />
                </div>
              </div>

              <!-- Chart -->
              {#if chartSeries.length > 0 && Chart && browser}
                <div class="mt-6">
                  <h4 class="text-lg font-semibold theme-text-primary mb-4">Rate History Chart</h4>
                  <svelte:component this={Chart} options={chartOptions} series={chartSeries} />
                </div>
              {/if}

              <!-- Save Button -->
              <div class="flex justify-end space-x-3 mt-6">
                <Button variant="secondary" on:click={onClose}>
                  Cancel
                </Button>
                <Button variant="primary" on:click={saveChanges} disabled={isSaving}>
                  <Save class="w-4 h-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          {:else}
            <div class="text-center py-8 theme-text-secondary">
              Select a version to edit or add a new version
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
