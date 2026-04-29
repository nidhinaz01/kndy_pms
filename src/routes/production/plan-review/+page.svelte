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
  import { exportPlanReviewExcel } from './utils/exportPlanReviewExcel';
  import PDFViewer from './components/PDFViewer.svelte';
  import { X } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import {
    attendanceIsAbsentUninformed,
    formatManpowerAttendanceShort
  } from '$lib/utils/manpowerAttendanceStatus';
  import { prefersExternalPdfOpen } from '$lib/utils/pdfViewerDevice';

  let showSidebar = false;
  let menus: any[] = [];
  let selectedDate = new Date().toISOString().split('T')[0];
  let selectedStage: string = '';
  
  let activeTab = 'works-plan';
  const tabs = [
    { id: 'manpower-plan', label: 'Manpower Plan', icon: '👥' },
    { id: 'works-plan', label: 'Works Plan', icon: '🔧' }
  ];

  // Submissions data
  let submissions: any[] = [];
  let submissionSearch = '';
  let selectedSubmission: any = null;
  let isLoading = false;
  let isSubmissionsLoading = false;

  // Works plan data
  let worksPlanData: any[] = [];
  let isWorksPlanLoading = false;
  let expandedGroups: string[] = [];
  let shiftBreakTimes: Array<{ start_time: string; end_time: string }> = [];
  let pdfBlob: Blob | null = null;
  let isGeneratingPDF = false;
  let pdfErrorMessage = '';
  let showWorksPlanFullscreen = false;
  let hasManuallyClosedFullscreen = false;
  
  $: groupedPlannedWorks = groupPlannedWorks(worksPlanData || []);
  
  // Generate PDF when data changes (only after loading is complete)
  $: if (worksPlanData.length > 0 && selectedStage && selectedDate && !isWorksPlanLoading) {
    generatePDF();
  }
  
  // Open fullscreen when PDF is ready (desktop only — mobile uses Open PDF link in viewer)
  $: if (
    pdfBlob &&
    activeTab === 'works-plan' &&
    !isGeneratingPDF &&
    !showWorksPlanFullscreen &&
    !hasManuallyClosedFullscreen &&
    typeof window !== 'undefined' &&
    !prefersExternalPdfOpen()
  ) {
    setTimeout(() => {
      if (!hasManuallyClosedFullscreen) {
        showWorksPlanFullscreen = true;
      }
    }, 100);
  }

  function worksPlanPdfDownloadName(): string {
    const stage = (selectedSubmission?.stage_code || selectedStage || 'plan').replace(/[^\w.-]+/g, '_');
    const date = (selectedSubmission?.planning_date || selectedDate || '').replace(/[^\w.-]+/g, '_');
    return `Works-Plan_${stage}_${date}.pdf`;
  }
  
  async function generatePDF() {
    if (worksPlanData.length === 0 || !selectedStage || !selectedDate) {
      pdfBlob = null;
      return;
    }
    
    isGeneratingPDF = true;
    pdfErrorMessage = '';
    try {
      const doc = generateWorksPlanPDF(
        worksPlanData,
        selectedStage,
        selectedDate,
        shiftBreakTimes,
        { compact: false }
      );
      pdfBlob = doc.output('blob');
    } catch (error) {
      console.error('Error generating PDF:', error);
      pdfBlob = null;
      pdfErrorMessage = 'Unable to build PDF on this device. Please try again.';
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
    if (!selectedSubmission) {
      alert('Select a submission to review first.');
      return;
    }
    if (worksPlanData.length === 0 && manpowerPlanData.length === 0) {
      alert('No plan or manpower data loaded for this submission.');
      return;
    }
    exportPlanReviewExcel(worksPlanData, manpowerPlanData, {
      planningDate: selectedSubmission.planning_date || selectedDate,
      stageCode: selectedSubmission.stage_code || selectedStage,
      shiftCode: (selectedSubmission.shift_code || '').trim(),
      submission: selectedSubmission,
      shiftBreakTimes
    });
  }
  
  function handleGeneratePDF() {
    // Trigger PDF regeneration
    generatePDF();
  }

  function statusLabel(status: string): string {
    if (status === 'pending_approval') return 'Pending';
    if (status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    if (status === 'reverted') return 'Reverted';
    return status || 'Unknown';
  }

  function statusBadgeClass(status: string): string {
    if (status === 'approved') {
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    }
    if (status === 'pending_approval') {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/25 dark:text-yellow-300';
    }
    if (status === 'rejected') {
      return 'bg-red-100 text-red-800 dark:bg-red-900/25 dark:text-red-300';
    }
    if (status === 'reverted') {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/25 dark:text-purple-300';
    }
    return 'theme-bg-secondary theme-text-secondary';
  }

  function submissionRowClass(submission: any): string {
    const status = submission?.status;
    const isSelected = selectedSubmission?.id === submission?.id;
    if (status === 'approved') {
      return isSelected
        ? 'bg-green-100 dark:bg-green-900/35 border-green-500'
        : 'bg-green-50 dark:bg-green-900/15 border-green-200 dark:border-green-900/40 hover:bg-green-100 dark:hover:bg-green-900/25';
    }
    if (status === 'pending_approval') {
      return isSelected
        ? 'bg-yellow-100 dark:bg-yellow-900/35 border-yellow-500'
        : 'bg-yellow-50 dark:bg-yellow-900/15 border-yellow-200 dark:border-yellow-900/40 hover:bg-yellow-100 dark:hover:bg-yellow-900/25';
    }
    if (status === 'rejected') {
      return isSelected
        ? 'bg-red-100 dark:bg-red-900/35 border-red-500'
        : 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/25';
    }
    if (status === 'reverted') {
      return isSelected
        ? 'bg-purple-100 dark:bg-purple-900/35 border-purple-500'
        : 'bg-purple-50 dark:bg-purple-900/15 border-purple-200 dark:border-purple-900/40 hover:bg-purple-100 dark:hover:bg-purple-900/25';
    }
    return isSelected
      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300'
      : 'theme-bg-secondary hover:theme-bg-secondary';
  }

  $: filteredSubmissions = [...(submissions || [])]
    .filter((submission) => {
      const q = submissionSearch.trim().toLowerCase();
      if (!q) return true;
      const searchable = [
        submission?.stage_code || '',
        submission?.shift_code || '',
        submission?.planning_date || '',
        submission?.submitted_by || '',
        submission?.reviewed_by || '',
        statusLabel(submission?.status)
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(q);
    })
    .sort((a, b) => {
      const stageCmp = String(a?.stage_code || '').localeCompare(String(b?.stage_code || ''), undefined, {
        sensitivity: 'base'
      });
      if (stageCmp !== 0) return stageCmp;
      const shiftCmp = String(a?.shift_code || '').localeCompare(String(b?.shift_code || ''), undefined, {
        sensitivity: 'base'
      });
      if (shiftCmp !== 0) return shiftCmp;
      const dateCmp = String(b?.planning_date || '').localeCompare(String(a?.planning_date || ''));
      if (dateCmp !== 0) return dateCmp;
      return Number(b?.version || 0) - Number(a?.version || 0);
    });

  // Manpower plan data
  let manpowerPlanData: any[] = [];
  let isManpowerPlanLoading = false;

  function isManpowerReassignmentRow(plan: any): boolean {
    return !!(plan?.from_stage_code && plan?.to_stage_code);
  }

  function manpowerShiftCode(plan: any): string {
    return (plan?.shift_code || selectedSubmission?.shift_code || '').trim();
  }

  function stageShiftLabel(plan: any): string {
    const sh = manpowerShiftCode(plan);
    const seg = (stage: string) => (stage && sh ? `${stage}-${sh}` : stage || sh || '—');
    if (isManpowerReassignmentRow(plan)) {
      return `${seg(plan.from_stage_code)} → ${seg(plan.to_stage_code)}`;
    }
    return seg(plan?.stage_code || selectedSubmission?.stage_code || '');
  }

  function attendanceLetterDisplay(plan: any): string {
    if (isManpowerReassignmentRow(plan)) return '';
    return formatManpowerAttendanceShort(plan?.attendance_status);
  }

  function attendanceBadgeClass(plan: any): string {
    if (isManpowerReassignmentRow(plan)) return '';
    const t = formatManpowerAttendanceShort(plan?.attendance_status);
    if (t === 'P') {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    }
    if (t === 'A(I)') {
      return 'bg-amber-100 text-amber-900 dark:bg-amber-900/35 dark:text-amber-200';
    }
    if (t === 'A(U)') {
      return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200 ring-1 ring-red-300 dark:ring-red-800';
    }
    return 'theme-text-secondary';
  }

  function formatHoursCell(value: unknown): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toFixed(2);
  }

  $: manpowerPlanRowsSorted = [...(manpowerPlanData || [])].sort((a, b) => {
    const na = (a?.hr_emp?.emp_name || a?.emp_id || '').toString().toLowerCase();
    const nb = (b?.hr_emp?.emp_name || b?.emp_id || '').toString().toLowerCase();
    const c = na.localeCompare(nb, undefined, { sensitivity: 'base' });
    if (c !== 0) return c;
    return String(a?.emp_id || '').localeCompare(String(b?.emp_id || ''));
  });

  function manpowerRowKey(plan: any, index: number): string {
    if (plan?.id != null) return `p-${plan.id}`;
    if (plan?.reassignment_id != null) return `r-${plan.reassignment_id}`;
    return `x-${plan?.emp_id || index}-${plan?.from_stage_code || ''}-${plan?.to_stage_code || ''}-${index}`;
  }

  // Approval state
  let showApprovalModal = false;
  let approvalAction: 'approve' | 'reject' = 'approve';
  let rejectionReason = '';
  let showRevertModal = false;
  let revertReason = '';

  /** Pending/approved submission card title in sidebar, e.g. P1S1 - GEN */
  function submissionStageShiftLabel(submission: { stage_code?: string; shift_code?: string } | null | undefined): string {
    const stage = (submission?.stage_code || '').trim();
    const shift = (submission?.shift_code || '').trim();
    if (stage && shift) return `${stage} - ${shift}`;
    return stage || shift || '—';
  }

  onMount(async () => {
    const username = localStorage.getItem('username');
    if (username) {
      menus = await fetchUserMenus(username);
    }
    await loadSubmissions();
  });
  
  // Reload submissions when date changes
  $: if (selectedDate) {
    // Clear selected submission if it doesn't match the new date
    if (selectedSubmission && selectedSubmission.planning_date !== selectedDate) {
      selectedSubmission = null;
      worksPlanData = [];
      manpowerPlanData = [];
    }
    loadSubmissions();
  }

  async function loadSubmissions() {
    isSubmissionsLoading = true;
    try {
      let query = supabase
        .from('prdn_planning_submissions')
        .select('*, version')
        .eq('is_deleted', false);
      
      // Filter by date if selected
      if (selectedDate) {
        query = query.eq('planning_date', selectedDate);
      }
      
      const { data, error } = await query
        .in('status', ['pending_approval', 'approved', 'rejected', 'reverted'])
        .order('stage_code', { ascending: true })
        .order('shift_code', { ascending: true })
        .order('planning_date', { ascending: false })
        .order('version', { ascending: false })
        .order('submitted_dt', { ascending: false });

      if (error) throw error;
      submissions = data || [];
    } catch (error) {
      console.error('Error loading submissions:', error);
      submissions = [];
    } finally {
      isSubmissionsLoading = false;
    }
  }

  async function handleSubmissionSelect(submission: any) {
    selectedSubmission = submission;
    selectedStage = submission.stage_code;
    // Don't change selectedDate when selecting a submission - use the date from the submission
    // But keep the date selector independent
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
        // If rejected, keep prdn_work_status unchanged; only reopen submission-linked rows
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

      alert(approvalAction === 'approve' 
        ? 'Planning approved successfully!' 
        : 'Planning rejected. Engineer can now modify and resubmit.');
      
      showApprovalModal = false;
      rejectionReason = '';
      selectedSubmission = null;
      await loadSubmissions();
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

  function handleOpenRevertModal() {
    showRevertModal = true;
  }

  function handleRevertCancel() {
    showRevertModal = false;
    revertReason = '';
  }

  async function handleRevertConfirm() {
    if (!selectedSubmission || selectedSubmission.status !== 'approved') return;
    if (!revertReason.trim()) {
      alert('Please provide a reason for reverting to draft');
      return;
    }

    isLoading = true;
    try {
      const currentUser = getCurrentUsername();
      const { data, error } = await supabase.rpc('revert_planning_submission_to_draft', {
        p_submission_id: selectedSubmission.id,
        p_reverted_by: currentUser,
        p_revert_reason: revertReason.trim()
      });

      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || 'Unable to revert submission');
      }

      alert('Approved plan reverted to draft successfully.');
      showRevertModal = false;
      revertReason = '';
      selectedSubmission = null;
      worksPlanData = [];
      manpowerPlanData = [];
      await loadSubmissions();
    } catch (error) {
      console.error('Error reverting approved plan:', error);
      alert('Error reverting approved plan: ' + ((error as Error).message || 'Unknown error'));
    } finally {
      isLoading = false;
    }
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
  <title>PMS - Plan Review</title>
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
    <!-- Left Sidebar - Unified Submissions Section -->
    <div class="w-1/3 flex flex-col gap-4">
      <div class="flex-1 theme-bg-primary rounded-lg shadow border theme-border p-4 flex flex-col">
        <div class="mb-4">
          <h3 class="text-lg font-semibold theme-text-primary mb-2">Submissions</h3>
          <input
            type="text"
            bind:value={submissionSearch}
            placeholder="Quick search: stage, shift, date, status..."
            class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg text-sm"
          />
        </div>

        {#if isSubmissionsLoading}
          <div class="flex items-center justify-center py-8 flex-1">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        {:else if filteredSubmissions.length === 0}
          <div class="text-center py-8 flex-1">
            <p class="theme-text-secondary">
              {submissionSearch.trim() ? 'No matching submissions' : 'No submissions'}
            </p>
          </div>
        {:else}
          <div class="space-y-2 overflow-y-auto flex-1">
            {#each filteredSubmissions as submission}
              <button
                on:click={() => handleSubmissionSelect(submission)}
                class="w-full text-left p-3 rounded-lg border theme-border transition-colors {submissionRowClass(submission)}"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="font-medium theme-text-primary">
                    {submissionStageShiftLabel(submission)}
                    {#if submission.version && submission.version > 1}
                      <span class="text-xs font-normal theme-text-secondary"> (v{submission.version})</span>
                    {/if}
                  </div>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold {statusBadgeClass(submission.status)}">
                    {statusLabel(submission.status)}
                  </span>
                </div>
                <div class="text-sm theme-text-secondary mt-1">{submission.planning_date}</div>
                <div class="text-xs theme-text-secondary mt-1">
                  {#if submission.status === 'approved'}
                    Reviewed: {submission.reviewed_by || '—'} | {submission.reviewed_dt ? formatDateTimeLocal(submission.reviewed_dt) : '—'}
                  {:else}
                    By: {submission.submitted_by} | {formatDateTimeLocal(submission.submitted_dt)}
                  {/if}
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
              {selectedSubmission.status === 'approved'
                ? 'Approved Plan'
                : selectedSubmission.status === 'reverted'
                ? 'Reverted Plan'
                : 'Review'}: {selectedSubmission.stage_code} - {selectedSubmission.planning_date}
              {#if selectedSubmission.version && selectedSubmission.version > 1}
                <span class="text-sm font-normal theme-text-secondary">(v{selectedSubmission.version})</span>
              {/if}
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
              <Button variant="secondary" size="sm" on:click={handleOpenRevertModal} disabled={isLoading}>
                Revert to Draft
              </Button>
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
                <Button
                  variant="primary"
                  size="sm"
                  on:click={handleGenerateExcel}
                  disabled={!selectedSubmission || (worksPlanData.length === 0 && manpowerPlanData.length === 0)}
                >
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
              <PDFViewer
                {pdfBlob}
                isLoading={isGeneratingPDF}
                errorMessage={pdfErrorMessage}
                downloadFileName={worksPlanPdfDownloadName()}
              />
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
            <div class="px-6 py-4 border-b theme-border flex justify-end">
              <Button
                variant="primary"
                size="sm"
                on:click={handleGenerateExcel}
                disabled={!selectedSubmission || (worksPlanData.length === 0 && manpowerPlanData.length === 0)}
              >
                Generate Excel
              </Button>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="theme-bg-secondary">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Employee</th>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Stage</th>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Attendance</th>
                    <th class="px-4 py-2 text-right text-xs font-medium theme-text-secondary uppercase">PLANNED HOURS</th>
                    <th class="px-4 py-2 text-right text-xs font-medium theme-text-secondary uppercase">OT Hours</th>
                    <th class="px-4 py-2 text-right text-xs font-medium theme-text-secondary uppercase">C-Off Hours</th>
                  </tr>
                </thead>
                <tbody class="divide-y theme-border">
                  {#each manpowerPlanRowsSorted as plan, i (manpowerRowKey(plan, i))}
                    <tr class="hover:theme-bg-secondary transition-colors {attendanceIsAbsentUninformed(plan?.attendance_status) ? 'bg-red-50 dark:bg-red-950/30' : ''}">
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {plan.hr_emp?.emp_name || 'N/A'}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary whitespace-nowrap">
                        {stageShiftLabel(plan)}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {#if isManpowerReassignmentRow(plan)}
                          <span class="text-xs theme-text-secondary">Reassigned · {plan.from_time || ''}-{plan.to_time || ''}</span>
                        {:else}
                          <span
                            class="inline-flex min-h-7 min-w-7 items-center justify-center rounded-md border border-transparent px-1.5 py-0.5 text-xs font-bold leading-tight {attendanceBadgeClass(plan)}"
                          >
                            {attendanceLetterDisplay(plan)}
                          </span>
                        {/if}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary text-right tabular-nums">
                        {isManpowerReassignmentRow(plan) ? '—' : formatHoursCell(plan.actual_hours ?? plan.planned_hours)}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary text-right tabular-nums">
                        {isManpowerReassignmentRow(plan) ? '—' : formatHoursCell(plan.ot_hours)}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary text-right tabular-nums">
                        {isManpowerReassignmentRow(plan) ? '—' : formatHoursCell(plan.c_off_value)}
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
          <label for="plan-review-rejection-reason" class="block text-sm font-medium theme-text-primary mb-2">
            Reason for Rejection <span class="text-red-500">*</span>
          </label>
          <textarea
            id="plan-review-rejection-reason"
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

<!-- Revert Modal -->
{#if showRevertModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div class="theme-bg-primary rounded-lg shadow-xl border theme-border p-6 max-w-md w-full mx-4">
      <h3 class="text-lg font-semibold theme-text-primary mb-4">Revert Approved Plan</h3>

      <div class="mb-4">
        <label for="plan-review-revert-reason" class="block text-sm font-medium theme-text-primary mb-2">
          Reason for Revert <span class="text-red-500">*</span>
        </label>
        <textarea
          id="plan-review-revert-reason"
          bind:value={revertReason}
          rows="4"
          placeholder="Enter reason for reverting this approved plan..."
          class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg"
        ></textarea>
      </div>

      <div class="flex justify-end gap-2">
        <Button variant="secondary" size="sm" on:click={handleRevertCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="danger"
          size="sm"
          on:click={handleRevertConfirm}
          disabled={isLoading || !revertReason.trim()}
        >
          {isLoading ? 'Processing...' : 'Revert to Draft'}
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
      <PDFViewer
        {pdfBlob}
        isLoading={isGeneratingPDF}
        errorMessage={pdfErrorMessage}
        downloadFileName={worksPlanPdfDownloadName()}
      />
    </div>
  </div>
{/if}

<FloatingThemeToggle />

