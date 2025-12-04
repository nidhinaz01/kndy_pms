<script lang="ts">
  import { onMount } from 'svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { supabase } from '$lib/supabaseClient';
  import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';
  import { formatDateTimeLocal } from '$lib/utils/formatDate';
  import { groupPlannedWorks } from '../[stage_Shift]/utils/planTabUtils';
  import { formatTime, calculateBreakTimeInRange } from '../[stage_Shift]/utils/timeUtils';
  import { generateWorksPlanPDF } from './utils/generateWorksPlanPDF';
  import PDFViewer from './components/PDFViewer.svelte';
  import { X } from 'lucide-svelte';
  import { goto } from '$app/navigation';

  let showSidebar = false;
  let menus: any[] = [];
  let selectedDate = new Date().toISOString().split('T')[0];
  let selectedStage: string = '';
  let availableStages: string[] = ['P1S1', 'P1S2', 'P1S3', 'P2S1', 'P2S2', 'P2S3', 'P3S1'];
  
  let activeTab = 'works-plan';
  const tabs = [
    { id: 'manpower-plan', label: 'Manpower Plan', icon: '👥' },
    { id: 'works-plan', label: 'Works Plan', icon: '🔧' }
  ];

  // Submissions data
  let pendingSubmissions: any[] = [];
  let approvedSubmissions: any[] = [];
  let selectedSubmission: any = null;
  let isLoading = false;
  let isSubmissionsLoading = false;
  let isApprovedSubmissionsLoading = false;

  // Works plan data
  let worksPlanData: any[] = [];
  let isWorksPlanLoading = false;
  let expandedGroups: string[] = [];
  let shiftBreakTimes: Array<{ start_time: string; end_time: string }> = [];
  let pdfBlob: Blob | null = null;
  let isGeneratingPDF = false;
  let showWorksPlanFullscreen = false;
  let hasManuallyClosedFullscreen = false;
  
  $: groupedPlannedWorks = groupPlannedWorks(worksPlanData || []);
  
  // Generate PDF when data changes (only after loading is complete)
  $: if (worksPlanData.length > 0 && selectedStage && selectedDate && !isWorksPlanLoading) {
    generatePDF();
  }
  
  // Open fullscreen when PDF is ready and user is on Works Plan tab (only if not manually closed)
  $: if (pdfBlob && activeTab === 'works-plan' && !isGeneratingPDF && !showWorksPlanFullscreen && !hasManuallyClosedFullscreen) {
    // Small delay to ensure UI is ready
    setTimeout(() => {
      if (!hasManuallyClosedFullscreen) {
        showWorksPlanFullscreen = true;
      }
    }, 100);
  }
  
  async function generatePDF() {
    if (worksPlanData.length === 0 || !selectedStage || !selectedDate) {
      pdfBlob = null;
      return;
    }
    
    isGeneratingPDF = true;
    try {
      const doc = generateWorksPlanPDF(worksPlanData, selectedStage, selectedDate, shiftBreakTimes);
      pdfBlob = doc.output('blob');
    } catch (error) {
      console.error('Error generating PDF:', error);
      pdfBlob = null;
    } finally {
      isGeneratingPDF = false;
    }
  }
  
  function toggleGroup(workCode: string) {
    if (expandedGroups.includes(workCode)) {
      expandedGroups = expandedGroups.filter(code => code !== workCode);
    } else {
      expandedGroups = [...expandedGroups, workCode];
    }
  }
  
  function isGroupExpanded(workCode: string): boolean {
    return expandedGroups.includes(workCode);
  }
  
  function handleGenerateExcel() {
    alert('Excel generation - to be implemented');
  }
  
  function handleGeneratePDF() {
    // Trigger PDF regeneration
    generatePDF();
  }

  // Manpower plan data
  let manpowerPlanData: any[] = [];
  let isManpowerPlanLoading = false;

  // Approval state
  let showApprovalModal = false;
  let approvalAction: 'approve' | 'reject' = 'approve';
  let rejectionReason = '';

  onMount(async () => {
    const username = localStorage.getItem('username');
    if (username) {
      menus = await fetchUserMenus(username);
    }
    await loadPendingSubmissions();
    await loadApprovedSubmissions();
  });
  
  // Reload submissions when date changes
  $: if (selectedDate) {
    // Clear selected submission if it doesn't match the new date
    if (selectedSubmission && selectedSubmission.planning_date !== selectedDate) {
      selectedSubmission = null;
      worksPlanData = [];
      manpowerPlanData = [];
    }
    loadPendingSubmissions();
    loadApprovedSubmissions();
  }

  async function loadPendingSubmissions() {
    isSubmissionsLoading = true;
    try {
      let query = supabase
        .from('prdn_planning_submissions')
        .select('*')
        .eq('status', 'pending_approval')
        .eq('is_deleted', false);
      
      // Filter by date if selected
      if (selectedDate) {
        query = query.eq('planning_date', selectedDate);
      }
      
      const { data, error } = await query.order('submitted_dt', { ascending: false });

      if (error) throw error;
      pendingSubmissions = data || [];
    } catch (error) {
      console.error('Error loading pending submissions:', error);
      pendingSubmissions = [];
    } finally {
      isSubmissionsLoading = false;
    }
  }
  
  async function loadApprovedSubmissions() {
    isApprovedSubmissionsLoading = true;
    try {
      let query = supabase
        .from('prdn_planning_submissions')
        .select('*')
        .eq('status', 'approved')
        .eq('is_deleted', false);
      
      // Filter by date if selected
      if (selectedDate) {
        query = query.eq('planning_date', selectedDate);
      }
      
      const { data, error } = await query.order('reviewed_dt', { ascending: false });

      if (error) throw error;
      approvedSubmissions = data || [];
    } catch (error) {
      console.error('Error loading approved submissions:', error);
      approvedSubmissions = [];
    } finally {
      isApprovedSubmissionsLoading = false;
    }
  }

  async function handleSubmissionSelect(submission: any) {
    selectedSubmission = submission;
    selectedStage = submission.stage_code;
    // Don't change selectedDate when selecting a submission - use the date from the submission
    // But keep the date selector independent
    await loadSubmissionDetails();
  }
  
  async function handleApprovedSubmissionSelect(submission: any) {
    selectedSubmission = submission;
    selectedStage = submission.stage_code;
    await loadSubmissionDetails();
  }

  async function loadSubmissionDetails() {
    if (!selectedSubmission) return;

    isLoading = true;
    try {
      // Load works plan
      const { data: worksData, error: worksError } = await supabase
        .from('prdn_work_planning')
        .select(`
          *,
          hr_emp!inner(emp_id, emp_name, skill_short),
          std_work_type_details(derived_sw_code, sw_code, type_description, std_work_details(sw_name)),
          prdn_wo_details!inner(wo_no, pwo_no, wo_model, customer_name),
          std_work_skill_mapping(wsm_id, sc_name)
        `)
        .eq('planning_submission_id', selectedSubmission.id)
        .eq('is_deleted', false)
        .order('from_time', { ascending: true });

      if (worksError) throw worksError;
      
      // Enrich with vehicle work flow data for standard time display
      const enrichedWorksData = await Promise.all(
        (worksData || []).map(async (plannedWork) => {
          const derivedSwCode = plannedWork.std_work_type_details?.derived_sw_code;
          
          // Fetch vehicle work flow
          let vehicleWorkFlow = null;
          if (derivedSwCode) {
            try {
              const { data: vwfData } = await supabase
                .from('std_vehicle_work_flow')
                .select('estimated_duration_minutes')
                .eq('derived_sw_code', derivedSwCode)
                .eq('is_deleted', false)
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();
              vehicleWorkFlow = vwfData;
            } catch (error) {
              console.error('Error fetching vehicle work flow:', error);
            }
          }
          
          return { ...plannedWork, vehicleWorkFlow };
        })
      );
      
      worksPlanData = enrichedWorksData;

      // Load manpower plan
      const { data: manpowerData, error: manpowerError } = await supabase
        .from('prdn_planning_manpower')
        .select(`
          *,
          hr_emp!inner(emp_id, emp_name, skill_short)
        `)
        .eq('planning_submission_id', selectedSubmission.id)
        .eq('is_deleted', false);

      if (manpowerError) throw manpowerError;
      manpowerPlanData = manpowerData || [];

      // Load stage reassignments
      const { data: reassignmentsData, error: reassignmentsError } = await supabase
        .from('prdn_planning_stage_reassignment')
        .select(`
          *,
          hr_emp!inner(emp_id, emp_name, skill_short)
        `)
        .eq('planning_submission_id', selectedSubmission.id)
        .eq('is_deleted', false);

      if (reassignmentsError) throw reassignmentsError;
      // Combine with manpower plan data
      manpowerPlanData = [...manpowerPlanData, ...(reassignmentsData || [])];
      
      // Load shift break times
      const { loadShiftBreakTimes } = await import('../services/stageProductionService');
      shiftBreakTimes = await loadShiftBreakTimes(selectedDate);
    } catch (error) {
      console.error('Error loading submission details:', error);
    } finally {
      isLoading = false;
    }
  }

  function handleApprove() {
    approvalAction = 'approve';
    showApprovalModal = true;
  }

  function handleReject() {
    approvalAction = 'reject';
    showApprovalModal = true;
  }

  async function handleApprovalConfirm() {
    if (!selectedSubmission) return;

    if (approvalAction === 'reject' && !rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    isLoading = true;
    try {
      const currentUser = getCurrentUsername();
      const now = getCurrentTimestamp();

      const updateData: any = {
        status: approvalAction === 'approve' ? 'approved' : 'rejected',
        reviewed_by: currentUser,
        reviewed_dt: now,
        modified_by: currentUser,
        modified_dt: now
      };

      if (approvalAction === 'reject') {
        updateData.rejection_reason = rejectionReason.trim();
      }

      // Update submission
      const { error: submissionError } = await supabase
        .from('prdn_planning_submissions')
        .update(updateData)
        .eq('id', selectedSubmission.id);

      if (submissionError) throw submissionError;

      // Update all linked records
      const newStatus = approvalAction === 'approve' ? 'approved' : 'rejected';
      
      // Update work plans
      const { error: worksError } = await supabase
        .from('prdn_work_planning')
        .update({
          status: newStatus,
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('planning_submission_id', selectedSubmission.id);

      if (worksError) throw worksError;

      // Update manpower plans
      const { error: manpowerError } = await supabase
        .from('prdn_planning_manpower')
        .update({
          status: newStatus,
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('planning_submission_id', selectedSubmission.id);

      if (manpowerError) throw manpowerError;

      // Update stage reassignments
      const { error: reassignmentsError } = await supabase
        .from('prdn_planning_stage_reassignment')
        .update({
          status: newStatus,
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('planning_submission_id', selectedSubmission.id);

      if (reassignmentsError) throw reassignmentsError;

      // If approved, update work status from 'Draft Plan' to 'Planned'
      if (approvalAction === 'approve') {
        // Get all work plans in this submission
        const { data: approvedPlans } = await supabase
          .from('prdn_work_planning')
          .select('stage_code, wo_details_id, derived_sw_code, other_work_code')
          .eq('planning_submission_id', selectedSubmission.id)
          .eq('is_deleted', false);

        if (approvedPlans) {
          for (const plan of approvedPlans) {
            let statusQuery = supabase
              .from('prdn_work_status')
              .update({
                current_status: 'Planned',
                modified_by: currentUser,
                modified_dt: now
              })
              .eq('stage_code', plan.stage_code)
              .eq('wo_details_id', plan.wo_details_id);

            if (plan.derived_sw_code) {
              statusQuery = statusQuery.eq('derived_sw_code', plan.derived_sw_code);
            } else if (plan.other_work_code) {
              statusQuery = statusQuery.eq('other_work_code', plan.other_work_code);
            }

            await statusQuery;
          }
        }
      } else {
        // If rejected, revert work status from 'Draft Plan' to 'To be Planned'
        const { data: rejectedPlans } = await supabase
          .from('prdn_work_planning')
          .select('stage_code, wo_details_id, derived_sw_code, other_work_code')
          .eq('planning_submission_id', selectedSubmission.id)
          .eq('is_deleted', false);

        if (rejectedPlans) {
          for (const plan of rejectedPlans) {
            let statusQuery = supabase
              .from('prdn_work_status')
              .update({
                current_status: 'To be Planned',
                modified_by: currentUser,
                modified_dt: now
              })
              .eq('stage_code', plan.stage_code)
              .eq('wo_details_id', plan.wo_details_id);

            if (plan.derived_sw_code) {
              statusQuery = statusQuery.eq('derived_sw_code', plan.derived_sw_code);
            } else if (plan.other_work_code) {
              statusQuery = statusQuery.eq('other_work_code', plan.other_work_code);
            }

            await statusQuery;
          }

          // Also revert all plans to 'draft' status and remove submission_id
          await supabase
            .from('prdn_work_planning')
            .update({
              status: 'draft',
              planning_submission_id: null,
              modified_by: currentUser,
              modified_dt: now
            })
            .eq('planning_submission_id', selectedSubmission.id);

          await supabase
            .from('prdn_planning_manpower')
            .update({
              status: 'draft',
              planning_submission_id: null,
              modified_by: currentUser,
              modified_dt: now
            })
            .eq('planning_submission_id', selectedSubmission.id);

          await supabase
            .from('prdn_planning_stage_reassignment')
            .update({
              status: 'draft',
              planning_submission_id: null,
              modified_by: currentUser,
              modified_dt: now
            })
            .eq('planning_submission_id', selectedSubmission.id);
        }
      }

      alert(approvalAction === 'approve' 
        ? 'Planning approved successfully!' 
        : 'Planning rejected. Engineer can now modify and resubmit.');
      
      showApprovalModal = false;
      rejectionReason = '';
      selectedSubmission = null;
      await loadPendingSubmissions();
      await loadApprovedSubmissions();
    } catch (error) {
      console.error('Error processing approval:', error);
      alert('Error processing approval: ' + ((error as Error).message || 'Unknown error'));
    } finally {
      isLoading = false;
    }
  }

  function handleApprovalCancel() {
    showApprovalModal = false;
    rejectionReason = '';
  }

  async function handleTabChange(tabId: string) {
    activeTab = tabId;
    if (selectedSubmission) {
      await loadSubmissionDetails();
    }
    
    // Reset manual close flag when switching to Works Plan tab (to allow auto-open again)
    if (tabId === 'works-plan') {
      hasManuallyClosedFullscreen = false;
    } else {
      // Close fullscreen when switching away from Works Plan tab
      showWorksPlanFullscreen = false;
      hasManuallyClosedFullscreen = false;
    }
  }
  
  function closeWorksPlanFullscreen() {
    showWorksPlanFullscreen = false;
    hasManuallyClosedFullscreen = true; // Mark that user manually closed it
  }
  
  function openWorksPlanFullscreen() {
    showWorksPlanFullscreen = true;
    hasManuallyClosedFullscreen = false; // Reset flag when manually opening
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }
</script>

<svelte:head>
  <title>Planning Review</title>
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
  <!-- Header with Date Selector -->
  <div class="theme-bg-primary border-b theme-border">
    <div class="flex items-center justify-between px-6 py-4">
      <div class="flex items-center gap-4">
        <button 
          class="p-2 theme-bg-secondary hover:theme-bg-secondary rounded-lg transition-colors" 
          on:click={handleSidebarToggle} 
          aria-label="Show sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 class="text-2xl font-semibold theme-text-primary">Planning Review</h1>
      </div>
      <div class="flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
        <label for="date-selector" class="text-sm font-medium theme-text-secondary">Date:</label>
        <input
          id="date-selector"
          type="date"
          bind:value={selectedDate}
          class="px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg text-sm border"
        />
      </div>
      <div class="flex items-center">
        <button
          on:click={() => goto('/dashboard')}
          class="flex items-center hover:opacity-80 transition-opacity cursor-pointer"
          aria-label="Go to dashboard"
        >
          <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
        </button>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex flex-1 p-4 gap-6">
    <!-- Left Sidebar - Split into Pending and Approved Submissions (stacked vertically) -->
    <div class="w-1/3 flex flex-col gap-4">
      <!-- Pending Submissions Section (Above) -->
      <div class="flex-1 theme-bg-primary rounded-lg shadow border theme-border p-4 flex flex-col">
        <div class="mb-4">
          <h3 class="text-lg font-semibold theme-text-primary mb-2">Pending Submissions</h3>
          <select
            bind:value={selectedStage}
            on:change={() => { loadPendingSubmissions(); loadApprovedSubmissions(); }}
            class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg text-sm"
          >
            <option value="">All Stages</option>
            {#each availableStages as stage}
              <option value={stage}>{stage}</option>
            {/each}
          </select>
        </div>

        {#if isSubmissionsLoading}
          <div class="flex items-center justify-center py-8 flex-1">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        {:else if pendingSubmissions.length === 0}
          <div class="text-center py-8 flex-1">
            <p class="theme-text-secondary">No pending submissions</p>
          </div>
        {:else}
          <div class="space-y-2 overflow-y-auto flex-1">
            {#each pendingSubmissions.filter(s => !selectedStage || s.stage_code === selectedStage) as submission}
              <button
                on:click={() => handleSubmissionSelect(submission)}
                class="w-full text-left p-3 rounded-lg border theme-border transition-colors {selectedSubmission?.id === submission.id && selectedSubmission?.status === 'pending_approval' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300' : 'theme-bg-secondary hover:theme-bg-secondary'}"
              >
                <div class="font-medium theme-text-primary">{submission.stage_code}</div>
                <div class="text-sm theme-text-secondary">{submission.planning_date}</div>
                <div class="text-xs theme-text-secondary mt-1">
                  By: {submission.submitted_by} | {formatDateTimeLocal(submission.submitted_dt)}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
      
      <!-- Approved Submissions Section (Below) -->
      <div class="flex-1 theme-bg-primary rounded-lg shadow border theme-border p-4 flex flex-col">
        <div class="mb-4">
          <h3 class="text-lg font-semibold theme-text-primary mb-2">Approved Submissions</h3>
        </div>

        {#if isApprovedSubmissionsLoading}
          <div class="flex items-center justify-center py-8 flex-1">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
          </div>
        {:else if approvedSubmissions.length === 0}
          <div class="text-center py-8 flex-1">
            <p class="theme-text-secondary">No approved submissions</p>
          </div>
        {:else}
          <div class="space-y-2 overflow-y-auto flex-1">
            {#each approvedSubmissions.filter(s => !selectedStage || s.stage_code === selectedStage) as submission}
              <button
                on:click={() => handleApprovedSubmissionSelect(submission)}
                class="w-full text-left p-3 rounded-lg border theme-border transition-colors {selectedSubmission?.id === submission.id && selectedSubmission?.status === 'approved' ? 'bg-green-50 dark:bg-green-900/20 border-green-300' : 'theme-bg-secondary hover:theme-bg-secondary'}"
              >
                <div class="font-medium theme-text-primary">{submission.stage_code}</div>
                <div class="text-sm theme-text-secondary">{submission.planning_date}</div>
                <div class="text-xs theme-text-secondary mt-1">
                  Reviewed: {submission.reviewed_by} | {formatDateTimeLocal(submission.reviewed_dt)}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Right Content - Submission Details -->
    <div class="flex-1 theme-bg-primary rounded-lg shadow border theme-border p-6">
      {#if !selectedSubmission}
        <div class="text-center py-12">
          <div class="text-6xl mb-4">📋</div>
          <p class="theme-text-secondary text-lg">Select a submission to review</p>
        </div>
      {:else}
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h2 class="text-xl font-semibold theme-text-primary">
              {selectedSubmission.status === 'approved' ? 'Approved Plan' : 'Review'}: {selectedSubmission.stage_code} - {selectedSubmission.planning_date}
            </h2>
            <p class="text-sm theme-text-secondary mt-1">
              {selectedSubmission.status === 'approved' 
                ? `Approved by ${selectedSubmission.reviewed_by} on ${formatDateTimeLocal(selectedSubmission.reviewed_dt)}`
                : `Submitted by ${selectedSubmission.submitted_by} on ${formatDateTimeLocal(selectedSubmission.submitted_dt)}`}
            </p>
          </div>
          {#if selectedSubmission.status === 'pending_approval'}
            <div class="flex gap-2">
              <Button variant="danger" size="sm" on:click={handleReject} disabled={isLoading}>
                Reject
              </Button>
              <Button variant="primary" size="sm" on:click={handleApprove} disabled={isLoading}>
                Approve
              </Button>
            </div>
          {:else if selectedSubmission.status === 'approved'}
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                ✓ Approved
              </span>
            </div>
          {/if}
        </div>

        <!-- Tabs -->
        <div class="border-b theme-border mb-4">
          <nav class="flex space-x-4">
            {#each tabs as tab}
              <button
                on:click={() => handleTabChange(tab.id)}
                class="px-4 py-2 border-b-2 transition-colors {activeTab === tab.id 
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-medium' 
                  : 'border-transparent theme-text-secondary hover:theme-text-primary'}"
              >
                <span class="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            {/each}
          </nav>
        </div>

        <!-- Tab Content -->
        {#if activeTab === 'works-plan'}
          <div class="px-6 py-4 border-b theme-border">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-xl font-semibold theme-text-primary">📋 Works Plan</h2>
                <p class="theme-text-secondary mt-1">
                  Planned works for {selectedStage} stage on {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                </p>
              </div>
              <div class="flex items-center space-x-3">
                <Button variant="primary" size="sm" on:click={handleGenerateExcel} disabled={worksPlanData.length === 0}>
                  Generate Excel
                </Button>
                <Button variant="primary" size="sm" on:click={handleGeneratePDF} disabled={worksPlanData.length === 0 || isGeneratingPDF}>
                  {isGeneratingPDF ? 'Generating...' : 'Regenerate PDF'}
                </Button>
                {#if worksPlanData.length > 0 && pdfBlob}
                  <Button variant="secondary" size="sm" on:click={openWorksPlanFullscreen}>
                    View Fullscreen
                  </Button>
                {/if}
              </div>
            </div>
          </div>
          
          {#if isWorksPlanLoading}
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
              <span class="theme-text-secondary">Loading works plan...</span>
            </div>
          {:else if worksPlanData.length === 0}
            <div class="text-center py-12">
              <div class="text-6xl mb-4">📋</div>
              <p class="theme-text-secondary text-lg">No work plans in this submission</p>
            </div>
          {:else}
            <!-- PDF Viewer - Full Width -->
            <div class="w-full" style="padding: 0;">
              <PDFViewer {pdfBlob} isLoading={isGeneratingPDF} />
            </div>
          {/if}
        {:else if activeTab === 'manpower-plan'}
          {#if isManpowerPlanLoading}
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
              <span class="theme-text-secondary">Loading manpower plan...</span>
            </div>
          {:else if manpowerPlanData.length === 0}
            <div class="text-center py-12">
              <p class="theme-text-secondary">No manpower plans in this submission</p>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="theme-bg-secondary">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Employee</th>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Type</th>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Details</th>
                  </tr>
                </thead>
                <tbody class="divide-y theme-border">
                  {#each manpowerPlanData as plan}
                    <tr class="hover:theme-bg-secondary">
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {plan.hr_emp?.emp_name || 'N/A'}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {plan.from_stage_code ? 'Reassignment' : 'Attendance'}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {#if plan.from_stage_code}
                          {plan.from_stage_code} → {plan.to_stage_code} ({plan.from_time} - {plan.to_time})
                        {:else}
                          {plan.attendance_status}
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        {/if}
      {/if}
    </div>
  </div>
</div>

<!-- Approval Modal -->
{#if showApprovalModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div class="theme-bg-primary rounded-lg shadow-xl border theme-border p-6 max-w-md w-full mx-4">
      <h3 class="text-lg font-semibold theme-text-primary mb-4">
        {approvalAction === 'approve' ? 'Approve Planning' : 'Reject Planning'}
      </h3>
      
      {#if approvalAction === 'reject'}
        <div class="mb-4">
          <label class="block text-sm font-medium theme-text-primary mb-2">
            Reason for Rejection <span class="text-red-500">*</span>
          </label>
          <textarea
            bind:value={rejectionReason}
            rows="4"
            placeholder="Enter reason for rejection..."
            class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg"
          ></textarea>
        </div>
      {:else}
        <p class="theme-text-secondary mb-4">
          Are you sure you want to approve this planning submission?
        </p>
      {/if}

      <div class="flex justify-end gap-2">
        <Button variant="secondary" size="sm" on:click={handleApprovalCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button 
          variant={approvalAction === 'approve' ? 'primary' : 'danger'} 
          size="sm" 
          on:click={handleApprovalConfirm}
          disabled={isLoading || (approvalAction === 'reject' && !rejectionReason.trim())}
        >
          {isLoading ? 'Processing...' : (approvalAction === 'approve' ? 'Approve' : 'Reject')}
        </Button>
      </div>
    </div>
  </div>
{/if}

<!-- Fullscreen Works Plan PDF Viewer -->
{#if showWorksPlanFullscreen && pdfBlob}
  <div class="fixed inset-0 z-[10000] theme-bg-primary flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b theme-border">
      <div>
        <h2 class="text-xl font-semibold theme-text-primary">📋 Works Plan - Fullscreen</h2>
        <p class="text-sm theme-text-secondary mt-1">
          {selectedStage} - {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
        </p>
      </div>
      <div class="flex items-center space-x-3">
        <Button variant="primary" size="sm" on:click={handleGeneratePDF} disabled={isGeneratingPDF}>
          {isGeneratingPDF ? 'Generating...' : 'Regenerate PDF'}
        </Button>
        <button
          on:click={closeWorksPlanFullscreen}
          class="p-2 theme-bg-secondary hover:theme-bg-secondary rounded-lg transition-colors"
          title="Close fullscreen"
        >
          <X class="w-6 h-6 theme-text-primary" />
        </button>
      </div>
    </div>
    
    <!-- PDF Viewer - Fullscreen -->
    <div class="flex-1 overflow-hidden" style="height: calc(100vh - 80px);">
      <PDFViewer {pdfBlob} isLoading={isGeneratingPDF} />
    </div>
  </div>
{/if}

<FloatingThemeToggle />

