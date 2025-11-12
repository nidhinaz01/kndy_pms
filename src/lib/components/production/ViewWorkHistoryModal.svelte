<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X, Clock, User, Calendar } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';
  import { formatDateTimeLocal } from '$lib/utils/formatDate';

  export let isOpen: boolean = false;
  export let work: any = null;
  export let stageCode: string = 'P1S2';

  const dispatch = createEventDispatcher();

  let isLoading = false;
  let workHistory: any[] = [];
  let totalTimeTaken = 0;
  let skillBreakdown: { [key: string]: number } = {};

  // Watch for work changes
  $: if (work && isOpen) {
    loadWorkHistory();
  }

  async function loadWorkHistory() {
    if (!work) return;

    isLoading = true;
    try {
      const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
      
      // Fetch all planning records for this work
      const { data: planningData, error: planningError } = await supabase
        .from('prdn_work_planning')
        .select('id, from_date, from_time, to_time, stage_code')
        .eq('derived_sw_code', derivedSwCode)
        .eq('stage_code', stageCode)
        .eq('is_deleted', false)
        .order('from_date', { ascending: true })
        .order('from_time', { ascending: true });

      if (planningError) {
        console.error('Error loading planning data:', planningError);
        alert('Error loading work history. Please try again.');
        return;
      }

      if (!planningData || planningData.length === 0) {
        workHistory = [];
        totalTimeTaken = 0;
        skillBreakdown = {};
        isLoading = false;
        return;
      }

      // Fetch all reporting records for these planning records
      const { data: reportingData, error: reportingError } = await supabase
        .from('prdn_work_reporting')
        .select(`
          *,
          prdn_work_planning!inner(
            id,
            from_date,
            from_time,
            to_time,
            derived_sw_code,
            stage_code
          ),
          hr_emp!inner(
            emp_name,
            skill_short
          )
        `)
        .in('planning_id', planningData.map(p => p.id))
        .eq('is_deleted', false)
        .order('created_dt', { ascending: true });

      if (reportingError) {
        console.error('Error loading reporting data:', reportingError);
        alert('Error loading work history. Please try again.');
        return;
      }

      // Process and organize history
      workHistory = (reportingData || []).map(report => {
        const planning = report.prdn_work_planning;
        const worker = report.hr_emp;
        
        // Calculate time worked
        const hoursWorked = report.hours_worked_today || 0;
        
        return {
          id: report.id,
          planningId: planning.id,
          date: planning.from_date,
          fromTime: planning.from_time,
          toTime: planning.to_time,
          workerName: worker?.emp_name || 'Unknown',
          skill: worker?.skill_short || 'Unknown',
          hoursWorkedToday: hoursWorked,
          hoursWorkedTillDate: report.hours_worked_till_date || 0,
          completionStatus: report.completion_status,
          lostTimeMinutes: report.lt_minutes_total || 0,
          lostTimeDetails: report.lt_details || [],
          createdDt: report.created_dt,
          comments: report.lt_comments || ''
        };
      });

      // Calculate totals
      totalTimeTaken = workHistory.reduce((sum, record) => sum + record.hoursWorkedToday, 0);
      
      // Calculate skill breakdown
      skillBreakdown = workHistory.reduce((breakdown, record) => {
        const skill = record.skill;
        breakdown[skill] = (breakdown[skill] || 0) + record.hoursWorkedToday;
        return breakdown;
      }, {} as { [key: string]: number });

    } catch (error) {
      console.error('Error loading work history:', error);
      alert('Error loading work history. Please try again.');
    } finally {
      isLoading = false;
    }
  }

  function handleClose() {
    dispatch('close');
  }

  function formatTime(hours: number): string {
    if (!hours) return '0h 0m';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
    } catch {
      return dateStr;
    }
  }

  function formatDateTime(dateTimeStr: string): string {
    if (!dateTimeStr) return 'N/A';
    // Use formatDateTimeLocal which handles UTC conversion properly
    return formatDateTimeLocal(dateTimeStr);
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <!-- Backdrop -->
    <div
      role="button"
      tabindex="0"
      aria-label="Close modal"
      class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
      on:click={handleClose}
      on:keydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClose();
        }
      }}
    ></div>
    
    <!-- Modal -->
    <div class="flex min-h-full items-center justify-center p-4">
      <div class="relative w-full max-w-6xl theme-bg-primary rounded-lg shadow-xl border theme-border">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b theme-border">
          <div>
            <h2 class="text-2xl font-semibold theme-text-primary">
              Work History - {work?.std_work_type_details?.derived_sw_code || work?.sw_code || 'Unknown'}
            </h2>
            <p class="text-sm theme-text-secondary mt-1">
              {work?.sw_name || work?.std_work_type_details?.std_work_details?.sw_name || 'Work details'}
            </p>
          </div>
          <button
            on:click={handleClose}
            class="p-2 rounded-lg hover:theme-bg-secondary transition-colors"
            aria-label="Close"
          >
            <X class="w-6 h-6 theme-text-secondary" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {#if isLoading}
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
              <span class="theme-text-secondary">Loading work history...</span>
            </div>
          {:else if workHistory.length === 0}
            <div class="text-center py-12">
              <div class="text-4xl mb-4">📋</div>
              <p class="theme-text-secondary text-lg">No work history found</p>
              <p class="theme-text-secondary text-sm mt-2">
                This work has not been reported yet.
              </p>
            </div>
          {:else}
            <!-- Summary -->
            <div class="mb-6 p-4 theme-bg-secondary rounded-lg border theme-border">
              <h3 class="text-lg font-semibold theme-text-primary mb-4">Summary</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div class="text-sm theme-text-secondary">Total Time Taken</div>
                  <div class="text-2xl font-bold theme-text-primary">{formatTime(totalTimeTaken)}</div>
                </div>
                <div>
                  <div class="text-sm theme-text-secondary">Total Records</div>
                  <div class="text-2xl font-bold theme-text-primary">{workHistory.length}</div>
                </div>
              </div>
              
              {#if Object.keys(skillBreakdown).length > 0}
                <div class="mt-4">
                  <div class="text-sm theme-text-secondary mb-2">Time Breakdown by Skill</div>
                  <div class="flex flex-wrap gap-2">
                    {#each Object.entries(skillBreakdown) as [skill, hours]}
                      <div class="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded-full text-sm">
                        {skill}: {formatTime(hours)}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>

            <!-- History Table -->
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="theme-bg-secondary">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                      Date
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                      Time Slot
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                      Worker
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                      Skill
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                      Hours Worked
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                      Cumulative Till Date
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                      Lost Time
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                      Reported At
                    </th>
                  </tr>
                </thead>
                <tbody class="theme-bg-primary divide-y divide-gray-200 dark:divide-gray-700">
                  {#each workHistory as record}
                    <tr class="hover:theme-bg-secondary transition-colors">
                      <td class="px-4 py-3 whitespace-nowrap text-sm theme-text-primary">
                        {formatDate(record.date)}
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm theme-text-primary">
                        {record.fromTime} - {record.toTime}
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm theme-text-primary">
                        {record.workerName}
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm">
                        <span class="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                          {record.skill}
                        </span>
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm font-medium theme-text-primary">
                        {formatTime(record.hoursWorkedToday)}
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm theme-text-primary">
                        {formatTime(record.hoursWorkedTillDate)}
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm">
                        {#if record.completionStatus === 'C'}
                          <span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                            Completed
                          </span>
                        {:else}
                          <span class="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                            Not Completed
                          </span>
                        {/if}
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm theme-text-primary">
                        {#if record.lostTimeMinutes > 0}
                          <div class="text-red-600 dark:text-red-400">
                            {Math.floor(record.lostTimeMinutes / 60)}h {record.lostTimeMinutes % 60}m
                          </div>
                          {#if record.lostTimeDetails && record.lostTimeDetails.length > 0}
                            <div class="text-xs theme-text-secondary mt-1">
                              {record.lostTimeDetails.length} reason(s)
                            </div>
                          {/if}
                        {:else}
                          <span class="text-gray-400">None</span>
                        {/if}
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm theme-text-secondary">
                        {formatDateTime(record.createdDt)}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 p-6 border-t theme-border">
          <Button variant="secondary" size="sm" on:click={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}

