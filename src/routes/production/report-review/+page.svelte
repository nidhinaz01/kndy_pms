<script lang="ts">
  import { onMount } from 'svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { supabase } from '$lib/supabaseClient';
  import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';
  import { formatDateTimeLocal } from '$lib/utils/formatDate';
  import { goto } from '$app/navigation';
  import PDFViewer from '../plan-review/components/PDFViewer.svelte';
  import { X } from 'lucide-svelte';
  import { formatTime, formatLostTimeDetails, formatDeviationTypeLabel } from '../[stage_Shift]/utils/timeUtils';
  import {
    attendanceIsAbsentUninformed,
    formatManpowerAttendanceShort
  } from '$lib/utils/manpowerAttendanceStatus';
  import { groupReportWorks } from '../[stage_Shift]/utils/planTabUtils';
  import { prefersExternalPdfOpen } from '$lib/utils/pdfViewerDevice';
  import { exportReportReviewExcel } from './utils/exportReportReviewExcel';

  let showSidebar = false;
  let menus: any[] = [];
  let selectedDate = new Date().toISOString().split('T')[0];
  let selectedStage: string = '';
  let availableStages: string[] = [];
  
  let activeTab = 'works-report';
  const tabs = [
    { id: 'manpower-report', label: 'Manpower Report', icon: '👥' },
    { id: 'works-report', label: 'Works Report', icon: '🔧' }
  ];

  // Submissions data
  let submissions: any[] = [];
  let submissionSearch = '';
  let selectedSubmission: any = null;
  let isLoading = false;
  let isSubmissionsLoading = false;
  
  // PDF viewing
  let pdfBlob: Blob | null = null;
  let isGeneratingPDF = false;
  let pdfErrorMessage = '';
  let showWorksReportFullscreen = false;
  let hasManuallyClosedFullscreen = false;
  
  // Generate PDF when works data is ready (matches plan-review: wait until works load finishes)
  $: if (
    worksReportData.length > 0 &&
    selectedSubmission &&
    !isLoading &&
    !isWorksReportLoading &&
    activeTab === 'works-report'
  ) {
    generateWorksReportPDF();
  }
  
  // Open fullscreen when PDF is ready (desktop only — mobile uses Open PDF link in viewer)
  $: if (
    pdfBlob &&
    activeTab === 'works-report' &&
    !isGeneratingPDF &&
    !showWorksReportFullscreen &&
    !hasManuallyClosedFullscreen &&
    typeof window !== 'undefined' &&
    !prefersExternalPdfOpen()
  ) {
    setTimeout(() => {
      if (!hasManuallyClosedFullscreen) {
        showWorksReportFullscreen = true;
      }
    }, 100);
  }

  function worksReportPdfDownloadName(): string {
    const stage = (selectedSubmission?.stage_code || 'report').replace(/[^\w.-]+/g, '_');
    const date = (selectedSubmission?.reporting_date || '').replace(/[^\w.-]+/g, '_');
    return `Works-Report_${stage}_${date}.pdf`;
  }

  // Works report data
  let worksReportData: any[] = [];
  let isWorksReportLoading = false;
  
  // Group works report data
  $: groupedReportWorks = groupReportWorks(worksReportData);

  // Manpower report data
  let manpowerReportData: any[] = [];
  let isManpowerReportLoading = false;

  /** True for merged-in stage reassignment rows (not prdn_reporting_manpower attendance). */
  function isManpowerReassignmentRow(report: any): boolean {
    return !!(report?.from_stage_code && report?.to_stage_code);
  }

  function manpowerRowShiftCode(report: any): string {
    return (report?.shift_code || selectedSubmission?.shift_code || '').trim();
  }

  /** e.g. P1S1-GEN; reassignment: P1S1-GEN → P2S1-GEN */
  function stageShiftLabel(report: any): string {
    const sh = manpowerRowShiftCode(report);
    const seg = (stage: string) => (stage && sh ? `${stage}-${sh}` : stage || sh || '—');
    if (isManpowerReassignmentRow(report)) {
      return `${seg(report.from_stage_code)} → ${seg(report.to_stage_code)}`;
    }
    const st = report?.stage_code || '';
    return st ? seg(st) : sh ? `—${sh}` : '—';
  }

  function formatManpowerHoursCell(value: unknown): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toFixed(2);
  }

  function attendanceLetterDisplay(report: any): string {
    if (isManpowerReassignmentRow(report)) return '';
    return formatManpowerAttendanceShort(report?.attendance_status);
  }

  function attendanceBadgeClassReport(report: any): string {
    if (isManpowerReassignmentRow(report)) return '';
    const t = formatManpowerAttendanceShort(report?.attendance_status);
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

  function attendanceCellSecondary(report: any): string {
    if (isManpowerReassignmentRow(report)) {
      const ft = report.from_time || '';
      const tt = report.to_time || '';
      if (ft || tt) return `Reassigned · ${ft}–${tt}`;
      return 'Reassigned';
    }
    return '';
  }

  $: manpowerReportRowsSorted = [...(manpowerReportData || [])].sort((a, b) => {
    const na = (a?.hr_emp?.emp_name || a?.emp_id || '').toString().toLowerCase();
    const nb = (b?.hr_emp?.emp_name || b?.emp_id || '').toString().toLowerCase();
    const c = na.localeCompare(nb, undefined, { sensitivity: 'base' });
    if (c !== 0) return c;
    return String(a?.emp_id || '').localeCompare(String(b?.emp_id || ''));
  });

  function manpowerRowKey(report: any, index: number): string {
    if (report?.id != null) return `m-${report.id}`;
    if (report?.reassignment_id != null) return `r-${report.reassignment_id}`;
    return `x-${report?.emp_id || index}-${report?.from_stage_code || ''}-${report?.to_stage_code || ''}-${index}`;
  }

  // Approval state
  let showApprovalModal = false;
  let approvalAction: 'approve' | 'reject' = 'approve';
  let rejectionReason = '';
  let showRevertModal = false;
  let revertReason = '';

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
        submission?.reporting_date || '',
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
      const dateCmp = String(b?.reporting_date || '').localeCompare(String(a?.reporting_date || ''));
      if (dateCmp !== 0) return dateCmp;
      return Number(b?.version || 0) - Number(a?.version || 0);
    });

  /** Pending/approved submission card title in sidebar, e.g. P1S1 - GEN */
  function submissionStageShiftLabel(submission: { stage_code?: string; shift_code?: string } | null | undefined): string {
    const stage = (submission?.stage_code || '').trim();
    const shift = (submission?.shift_code || '').trim();
    if (stage && shift) return `${stage} - ${shift}`;
    return stage || shift || '—';
  }

  async function loadAvailableStages() {
    try {
      const { data, error } = await supabase
        .from('sys_data_elements')
        .select('de_value')
        .eq('de_name', 'Plant-Stage')
        .order('de_value', { ascending: true });

      if (error) {
        console.error('Error loading Plant-Stage values:', error);
        return;
      }

      const values = (data || [])
        .map((row: any) => (row?.de_value || '').toString().trim())
        .filter((v: string) => v.length > 0);

      availableStages = Array.from(new Set(values));
    } catch (err) {
      console.error('Unexpected error loading Plant-Stage values:', err);
    }
  }

  onMount(async () => {
    await loadAvailableStages();
    const username = localStorage.getItem('username');
    if (username) {
      menus = await fetchUserMenus(username);
    }
    await loadSubmissions();
  });
  
  // Reload submissions when date changes
  $: if (selectedDate) {
    // Clear selected submission if it doesn't match the new date
    if (selectedSubmission && selectedSubmission.reporting_date !== selectedDate) {
      selectedSubmission = null;
      worksReportData = [];
      manpowerReportData = [];
    }
    loadSubmissions();
  }

  async function loadSubmissions() {
    isSubmissionsLoading = true;
    try {
      let query = supabase
        .from('prdn_reporting_submissions')
        .select('*, version')
        .eq('is_deleted', false);
      
      // Filter by date if selected
      if (selectedDate) {
        query = query.eq('reporting_date', selectedDate);
      }
      
      const { data, error } = await query
        .in('status', ['pending_approval', 'approved', 'rejected', 'reverted'])
        .order('stage_code', { ascending: true })
        .order('shift_code', { ascending: true })
        .order('reporting_date', { ascending: false })
        .order('version', { ascending: false })
        .order('submitted_dt', { ascending: false });

      if (error) {
        console.error('Error loading submissions:', error);
        throw error;
      }
      
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
    await loadSubmissionDetails();
  }
  
  async function loadSubmissionDetails() {
    if (!selectedSubmission) return;

    isLoading = true;
    isWorksReportLoading = true;
    isManpowerReportLoading = true;
    try {
      // Load works reports
      const { data: worksData, error: worksError } = await supabase
        .from('prdn_work_reporting')
        .select(`
          *,
          prdn_work_planning(
            *,
            std_work_type_details(derived_sw_code, sw_code, type_description, std_work_details(sw_name)),
            hr_emp(emp_id, emp_name, skill_short),
            prdn_wo_details(wo_no, pwo_no, wo_model, customer_name),
            std_work_skill_mapping(wsm_id, sc_name)
          )
        `)
        .eq('reporting_submission_id', selectedSubmission.id)
        .eq('is_deleted', false)
        .order('from_time', { ascending: true });

      if (worksError) throw worksError;
      let rawWorksReportData = worksData || [];
      
      // Load deviations for all reports
      const reportIds = (rawWorksReportData || []).map((r: any) => r.id).filter(Boolean);
      let deviationsMap = new Map<number, any[]>();
      if (reportIds.length > 0) {
        const { getDeviationsForReportings } = await import('$lib/services/workReportingDeviationService');
        deviationsMap = await getDeviationsForReportings(reportIds);
      }
      
      // Enrich work reports with skill-specific time standards and vehicle work flow
      worksReportData = await Promise.all(
        rawWorksReportData.map(async (report: any) => {
          // Attach deviations to report
          const deviations = deviationsMap.get(report.id) || [];
          report.deviations = deviations;
          
          const planningRecord = report.prdn_work_planning;
          const derivedSwCode = planningRecord?.std_work_type_details?.derived_sw_code;
          const skillShort = planningRecord?.hr_emp?.skill_short;
          const scRequired = planningRecord?.sc_required;
          
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
          
          if (!derivedSwCode || !skillShort || !scRequired) {
            return { ...report, skillTimeStandard: null, skillMapping: null, vehicleWorkFlow: vehicleWorkFlow };
          }

          // Find skill combination that contains the required skill
          let matchingWsm = null;
          try {
            const { data: allMappings } = await supabase
              .from('std_work_skill_mapping')
              .select(`
                wsm_id,
                sc_name,
                std_skill_combinations!inner(
                  skill_combination
                )
              `)
              .eq('derived_sw_code', derivedSwCode)
              .eq('is_deleted', false)
              .eq('is_active', true);

            if (allMappings && allMappings.length > 0) {
              for (const mapping of allMappings) {
                const skillCombination = (mapping as any).std_skill_combinations?.skill_combination;
                if (skillCombination && Array.isArray(skillCombination)) {
                  const hasSkill = skillCombination.some((skill: any) => 
                    skill.skill_name === scRequired || skill.skill_short === scRequired
                  );
                  if (hasSkill) {
                    matchingWsm = mapping;
                    break;
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error fetching skill mappings:', error);
          }

          if (!matchingWsm) {
            return { ...report, skillTimeStandard: null, skillMapping: null, vehicleWorkFlow: vehicleWorkFlow };
          }

          // Get skill time standard
          let skillTimeStandard = null;
          try {
            const { data: stsData } = await supabase
              .from('std_skill_time_standards')
              .select('*')
              .eq('wsm_id', matchingWsm.wsm_id)
              .eq('skill_short', scRequired)
              .eq('is_deleted', false)
              .eq('is_active', true)
              .maybeSingle();
            skillTimeStandard = stsData;
          } catch (error) {
            console.error('Error fetching skill time standard:', error);
          }
          
          // Calculate remaining time
          let remainingTimeMinutes = null;
          if (skillTimeStandard && skillTimeStandard.standard_time_minutes) {
            const totalWorkedMinutes = ((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0)) * 60;
            remainingTimeMinutes = Math.max(0, skillTimeStandard.standard_time_minutes - totalWorkedMinutes);
          }

          return {
            ...report,
            skillTimeStandard: skillTimeStandard,
            skillMapping: matchingWsm,
            vehicleWorkFlow: vehicleWorkFlow,
            remainingTimeMinutes: remainingTimeMinutes
          };
        })
      );

      isWorksReportLoading = false;

      // Load manpower reports
      const { data: manpowerData, error: manpowerError } = await supabase
        .from('prdn_reporting_manpower')
        .select(`
          *,
          hr_emp!inner(emp_id, emp_name, skill_short)
        `)
        .eq('reporting_submission_id', selectedSubmission.id)
        .eq('is_deleted', false);

      if (manpowerError) throw manpowerError;
      manpowerReportData = manpowerData || [];

      // Load stage reassignments: avoid hr_emp!inner (400 if embed/FK is wrong or emp row missing).
      // Cascade queries when schema differs (missing reporting_submission_id / shift_code) or PostgREST returns 400.
      let reassignmentsData: any[] = [];
      const reassignmentSelect = `*, hr_emp(emp_id, emp_name, skill_short)`;
      const sid = selectedSubmission.id;
      const rDate = selectedSubmission.reporting_date;
      const stg = selectedSubmission.stage_code;
      const sh = selectedSubmission.shift_code;

      const attempts = [
        () =>
          supabase
            .from('prdn_reporting_stage_reassignment')
            .select(reassignmentSelect)
            .eq('reporting_submission_id', sid)
            .eq('is_deleted', false),
        () =>
          supabase
            .from('prdn_reporting_stage_reassignment')
            .select('*')
            .eq('reporting_submission_id', sid)
            .eq('is_deleted', false),
        () => {
          let q = supabase
            .from('prdn_reporting_stage_reassignment')
            .select(reassignmentSelect)
            .eq('reassignment_date', rDate)
            .eq('to_stage_code', stg)
            .eq('is_deleted', false);
          if (sh) q = q.eq('shift_code', sh);
          return q;
        },
        () =>
          supabase
            .from('prdn_reporting_stage_reassignment')
            .select(reassignmentSelect)
            .eq('reassignment_date', rDate)
            .eq('to_stage_code', stg)
            .eq('is_deleted', false)
      ];

      let lastReassignmentErr: any = null;
      for (const run of attempts) {
        const { data, error } = await run();
        lastReassignmentErr = error;
        if (!error) {
          reassignmentsData = data || [];
          break;
        }
      }
      if (lastReassignmentErr && reassignmentsData.length === 0) {
        console.warn('Error loading stage reassignments:', lastReassignmentErr);
      }
      // Combine with manpower report data
      manpowerReportData = [...manpowerReportData, ...(reassignmentsData || [])];

      isManpowerReportLoading = false;
      
      // Calculate LTNP hours from work reports for each employee
      // Group work reports by employee
      const employeeLTNP: Map<string, number> = new Map();
      worksReportData.forEach((report: any) => {
        const empId = report.prdn_work_planning?.hr_emp?.emp_id;
        if (!empId) return;
        
        // Parse lt_details and calculate LTNP (non-payable lost time)
        let ltnpMinutes = 0;
        if (report.lt_details && Array.isArray(report.lt_details)) {
          ltnpMinutes = report.lt_details
            .filter((lt: any) => !lt.is_lt_payable)
            .reduce((sum: number, lt: any) => sum + (lt.lt_minutes || 0), 0);
        }
        
        const currentLTNP = employeeLTNP.get(empId) || 0;
        employeeLTNP.set(empId, currentLTNP + ltnpMinutes);
      });
      
      // Update manpower report data with calculated LTNP
      manpowerReportData = manpowerReportData.map((report: any) => {
        const empId = report.hr_emp?.emp_id || report.emp_id;
        const calculatedLTNP = employeeLTNP.get(empId) || 0;
        const calculatedLTNPHours = calculatedLTNP / 60;
        
        // Use calculated LTNP if it's greater than stored value, or if stored is 0
        const ltnpHours = report.ltnp_hours && report.ltnp_hours > 0 
          ? report.ltnp_hours 
          : calculatedLTNPHours;
        
        return {
          ...report,
          ltnp_hours: ltnpHours,
          calculated_ltnp_hours: calculatedLTNPHours
        };
      });
    } catch (error) {
      console.error('Error loading submission details:', error);
      worksReportData = [];
      manpowerReportData = [];
    } finally {
      isWorksReportLoading = false;
      isManpowerReportLoading = false;
      isLoading = false;
    }
  }
  
  async function generateWorksReportPDF() {
    if (worksReportData.length === 0 || !selectedSubmission) {
      pdfBlob = null;
      return;
    }
    
    isGeneratingPDF = true;
    pdfErrorMessage = '';
    try {
      // Import PDF generator (we'll create this)
      const { generateWorksReportPDF } = await import('./utils/generateWorksReportPDF');
      const doc = generateWorksReportPDF(
        worksReportData,
        selectedSubmission.stage_code,
        selectedSubmission.reporting_date,
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
  
  function closeWorksReportFullscreen() {
    showWorksReportFullscreen = false;
    hasManuallyClosedFullscreen = true;
  }
  
  function openWorksReportFullscreen() {
    showWorksReportFullscreen = true;
    hasManuallyClosedFullscreen = false;
  }
  
  function handleGeneratePDF() {
    generateWorksReportPDF();
  }

  function handleGenerateExcel() {
    if (!selectedSubmission) {
      alert('Select a submission to review first.');
      return;
    }
    if (worksReportData.length === 0 && manpowerReportData.length === 0) {
      alert('No report or manpower data loaded for this submission.');
      return;
    }
    exportReportReviewExcel(worksReportData, manpowerReportData, {
      reportingDate: selectedSubmission.reporting_date,
      stageCode: selectedSubmission.stage_code || '',
      shiftCode: (selectedSubmission.shift_code || '').trim(),
      submission: selectedSubmission
    });
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
        .from('prdn_reporting_submissions')
        .update(updateData)
        .eq('id', selectedSubmission.id);

      if (submissionError) throw submissionError;

      // Update all linked records
      const newStatus = approvalAction === 'approve' ? 'approved' : 'rejected';
      
      // Update work reports
      const { error: worksError } = await supabase
        .from('prdn_work_reporting')
        .update({
          status: newStatus,
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('reporting_submission_id', selectedSubmission.id);

      if (worksError) throw worksError;

      // Update manpower reports
      const { error: manpowerError } = await supabase
        .from('prdn_reporting_manpower')
        .update({
          status: newStatus,
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('reporting_submission_id', selectedSubmission.id);

      if (manpowerError) throw manpowerError;

      // Update stage reassignments (only if table has status column and reporting_submission_id)
      try {
        // First try with reporting_submission_id
        let reassignmentsError: any = null;
        try {
          const { error } = await supabase
            .from('prdn_reporting_stage_reassignment')
            .update({
              status: newStatus,
              modified_by: currentUser,
              modified_dt: now
            })
            .eq('reporting_submission_id', selectedSubmission.id);
          
          reassignmentsError = error;
        } catch (err: any) {
          // If reporting_submission_id column doesn't exist, use fallback
          if (err?.message?.includes('reporting_submission_id') || 
              err?.code === '42703' || 
              err?.code === 'PGRST204' ||
              err?.message?.includes('Could not find')) {
            try {
              let u = supabase
                .from('prdn_reporting_stage_reassignment')
                .update({
                  status: newStatus,
                  modified_by: currentUser,
                  modified_dt: now
                })
                .eq('reassignment_date', selectedSubmission.reporting_date)
                .eq('to_stage_code', selectedSubmission.stage_code);
              if (selectedSubmission.shift_code) {
                u = u.eq('shift_code', selectedSubmission.shift_code);
              }
              const { error: fallbackError } = await u;
              
              reassignmentsError = fallbackError;
            } catch (fallbackErr: any) {
              reassignmentsError = fallbackErr;
            }
          } else {
            reassignmentsError = err;
          }
        }

        if (reassignmentsError) {
          // If error is about missing column, log but don't fail
          if (reassignmentsError.message?.includes('status') || reassignmentsError.message?.includes('column')) {
            console.warn('prdn_reporting_stage_reassignment table may not have status column:', reassignmentsError.message);
            // Try updating without status column
            let updateError: any = null;
            try {
              const { error } = await supabase
                .from('prdn_reporting_stage_reassignment')
                .update({
                  modified_by: currentUser,
                  modified_dt: now
                })
                .eq('reporting_submission_id', selectedSubmission.id);
              
              updateError = error;
              } catch (err: any) {
                // If reporting_submission_id doesn't exist, use fallback
                if (err?.message?.includes('reporting_submission_id') || 
                    err?.code === '42703' || 
                    err?.code === 'PGRST204' ||
                    err?.message?.includes('Could not find')) {
                  try {
                    let u = supabase
                      .from('prdn_reporting_stage_reassignment')
                      .update({
                        modified_by: currentUser,
                        modified_dt: now
                      })
                      .eq('reassignment_date', selectedSubmission.reporting_date)
                      .eq('to_stage_code', selectedSubmission.stage_code);
                    if (selectedSubmission.shift_code) {
                      u = u.eq('shift_code', selectedSubmission.shift_code);
                    }
                    const { error: fallbackError } = await u;
                    
                    updateError = fallbackError;
                  } catch (fallbackErr: any) {
                    updateError = fallbackErr;
                  }
                } else {
                  updateError = err;
                }
              }
            
            if (updateError) {
              console.error('Error updating stage reassignments:', updateError);
            }
          } else {
            console.warn('Error updating stage reassignments:', reassignmentsError);
            // Don't throw - allow approval to continue even if stage reassignment update fails
          }
        }
      } catch (error) {
        console.error('Error updating stage reassignments:', error);
        // Don't throw - allow approval to continue even if stage reassignment update fails
      }

      if (approvalAction === 'reject') {
        // Revert all reports to 'draft' status and remove submission_id
        await supabase
          .from('prdn_work_reporting')
          .update({
            status: 'draft',
            reporting_submission_id: null,
            modified_by: currentUser,
            modified_dt: now
          })
          .eq('reporting_submission_id', selectedSubmission.id);

        await supabase
          .from('prdn_reporting_manpower')
          .update({
            status: 'draft',
            reporting_submission_id: null,
            modified_by: currentUser,
            modified_dt: now
          })
          .eq('reporting_submission_id', selectedSubmission.id);

        // Update stage reassignments (only if table has status column and reporting_submission_id)
        try {
          let reassignmentsRejectError: any = null;
          try {
            const { error } = await supabase
              .from('prdn_reporting_stage_reassignment')
              .update({
                status: 'draft',
                reporting_submission_id: null,
                modified_by: currentUser,
                modified_dt: now
              })
              .eq('reporting_submission_id', selectedSubmission.id);
            
            reassignmentsRejectError = error;
          } catch (err: any) {
            // If reporting_submission_id column doesn't exist, use fallback
            if (err?.message?.includes('reporting_submission_id') || 
                err?.code === '42703' || 
                err?.code === 'PGRST204' ||
                err?.message?.includes('Could not find')) {
              try {
                let u = supabase
                  .from('prdn_reporting_stage_reassignment')
                  .update({
                    status: 'draft',
                    modified_by: currentUser,
                    modified_dt: now
                  })
                  .eq('reassignment_date', selectedSubmission.reporting_date)
                  .eq('to_stage_code', selectedSubmission.stage_code);
                if (selectedSubmission.shift_code) {
                  u = u.eq('shift_code', selectedSubmission.shift_code);
                }
                const { error: fallbackError } = await u;
                
                reassignmentsRejectError = fallbackError;
              } catch (fallbackErr: any) {
                reassignmentsRejectError = fallbackErr;
              }
            } else {
              reassignmentsRejectError = err;
            }
          }
          
          if (reassignmentsRejectError) {
            // Check if error is about missing reporting_submission_id column
            if (reassignmentsRejectError.code === '42703' || 
                reassignmentsRejectError.code === 'PGRST204' ||
                reassignmentsRejectError.message?.includes('reporting_submission_id') ||
                reassignmentsRejectError.message?.includes('Could not find')) {
              // Column doesn't exist - skip update or use fallback without reporting_submission_id
              console.warn('reporting_submission_id column not found in prdn_reporting_stage_reassignment, skipping update');
              // Don't try to update - the column doesn't exist
            } else if (reassignmentsRejectError.message?.includes('status') || reassignmentsRejectError.message?.includes('column')) {
              console.warn('prdn_reporting_stage_reassignment table may not have status column:', reassignmentsRejectError.message);
              // Try updating without status and without reporting_submission_id
              try {
                let u = supabase
                  .from('prdn_reporting_stage_reassignment')
                  .update({
                    modified_by: currentUser,
                    modified_dt: now
                  })
                  .eq('reassignment_date', selectedSubmission.reporting_date)
                  .eq('to_stage_code', selectedSubmission.stage_code);
                if (selectedSubmission.shift_code) {
                  u = u.eq('shift_code', selectedSubmission.shift_code);
                }
                const { error: fallbackError } = await u;
                
                if (fallbackError) {
                  console.error('Error updating stage reassignments on reject (fallback):', fallbackError);
                }
              } catch (err: any) {
                console.error('Error updating stage reassignments on reject (fallback failed):', err);
              }
            } else {
              console.error('Error updating stage reassignments on reject:', reassignmentsRejectError);
            }
          }
        } catch (error) {
          console.error('Error updating stage reassignments on reject:', error);
          // Don't throw - allow rejection to continue
        }
      }

      alert(approvalAction === 'approve' 
        ? 'Reporting approved successfully!' 
        : 'Reporting rejected. Engineer can now modify and resubmit.');
      
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
      const { data, error } = await supabase.rpc('revert_reporting_submission_to_draft', {
        p_submission_id: selectedSubmission.id,
        p_reverted_by: currentUser,
        p_revert_reason: revertReason.trim()
      });

      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || 'Unable to revert reporting submission');
      }

      alert('Approved report reverted to draft successfully.');
      showRevertModal = false;
      revertReason = '';
      selectedSubmission = null;
      worksReportData = [];
      manpowerReportData = [];
      await loadSubmissions();
    } catch (error) {
      console.error('Error reverting approved report:', error);
      alert('Error reverting approved report: ' + ((error as Error).message || 'Unknown error'));
    } finally {
      isLoading = false;
    }
  }

  async function handleTabChange(tabId: string) {
    activeTab = tabId;
    if (selectedSubmission) {
      await loadSubmissionDetails();
    }
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }
</script>

<svelte:head>
  <title>PMS - Report Review</title>
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
        <h1 class="text-2xl font-semibold theme-text-primary">Reporting Review</h1>
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
    <!-- Left Sidebar - Unified Submissions -->
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
                <div class="text-sm theme-text-secondary mt-1">{submission.reporting_date}</div>
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
          <div class="text-6xl mb-4">📊</div>
          <p class="theme-text-secondary text-lg">Select a submission to review</p>
        </div>
      {:else}
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h2 class="text-xl font-semibold theme-text-primary">
              {selectedSubmission.status === 'approved'
                ? 'Approved Report'
                : selectedSubmission.status === 'reverted'
                ? 'Reverted Report'
                : 'Review'}: {selectedSubmission.stage_code} - {selectedSubmission.reporting_date}
              {#if selectedSubmission.version && selectedSubmission.version > 1}
                <span class="text-sm font-normal theme-text-secondary">(v{selectedSubmission.version})</span>
              {/if}
            </h2>
            <p class="text-sm theme-text-secondary mt-1">
              {selectedSubmission.status === 'pending_approval' 
                ? `Submitted by ${selectedSubmission.submitted_by} on ${formatDateTimeLocal(selectedSubmission.submitted_dt)}`
                : `Reviewed by ${selectedSubmission.reviewed_by} on ${formatDateTimeLocal(selectedSubmission.reviewed_dt)}`}
            </p>
          </div>
          <div class="flex gap-2">
            {#if selectedSubmission.status === 'pending_approval'}
              <Button variant="danger" size="sm" on:click={handleReject} disabled={isLoading}>
                Reject
              </Button>
              <Button variant="primary" size="sm" on:click={handleApprove} disabled={isLoading}>
                Approve
              </Button>
            {:else if selectedSubmission.status === 'approved'}
              <Button variant="secondary" size="sm" on:click={handleOpenRevertModal} disabled={isLoading}>
                Revert to Draft
              </Button>
            {/if}
            {#if activeTab === 'works-report' && pdfBlob}
              <Button variant="secondary" size="sm" on:click={openWorksReportFullscreen}>
                View PDF
              </Button>
            {/if}
            <Button
              variant="secondary"
              size="sm"
              on:click={handleGenerateExcel}
              disabled={
                !selectedSubmission || (worksReportData.length === 0 && manpowerReportData.length === 0)
              }
            >
              Generate Excel
            </Button>
            {#if activeTab === 'works-report'}
              <Button variant="primary" size="sm" on:click={handleGeneratePDF} disabled={isGeneratingPDF || worksReportData.length === 0}>
                {isGeneratingPDF ? 'Generating...' : 'Generate PDF'}
              </Button>
            {/if}
          </div>
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
        {#if activeTab === 'works-report'}
          {#if isWorksReportLoading}
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
              <span class="theme-text-secondary">Loading works reports...</span>
            </div>
          {:else if worksReportData.length === 0}
            <div class="text-center py-12">
              <p class="theme-text-secondary">No work reports in this submission</p>
            </div>
          {:else}
            <div class="px-6 py-4 border-b theme-border">
              <h2 class="text-xl font-semibold theme-text-primary">📊 Works Report</h2>
              <p class="theme-text-secondary text-sm mt-1">
                {selectedSubmission.stage_code}
                {#if selectedSubmission.shift_code}
                  <span class="theme-text-secondary"> · {selectedSubmission.shift_code}</span>
                {/if}
                · {new Date(selectedSubmission.reporting_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
              </p>
            </div>
            <div class="w-full" style="padding: 0; min-height: 560px;">
              <PDFViewer
                {pdfBlob}
                isLoading={isGeneratingPDF}
                errorMessage={pdfErrorMessage}
                downloadFileName={worksReportPdfDownloadName()}
              />
            </div>
            <div class="overflow-x-auto mt-4">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700" style="table-layout: fixed; width: 100%;">
                <thead class="theme-bg-secondary">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 100px;">Work Order</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">PWO Number</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">Work Code</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 250px;">Work Name</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 180px;">Skills Required</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">Standard Time</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">Status</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 180px;">Worker (Skill)</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 140px;">Time Worked Till Date</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 100px;">From Time</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 100px;">To Time</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 140px;">Hours Worked</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 140px;">Total Hours Worked</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">OT Hours</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">Lost Time</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 200px;">Reason</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 150px;">Reported On</th>
                  </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {#each Object.values(groupedReportWorks) as group (group.workCode + '_' + (group.woDetailsId ?? 'unknown'))}
                    {@const typedGroup = group}
                    <!-- Single Row per Work -->
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
                        class:lost-time={typedGroup.hasLostTime}>
                      <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {typedGroup.woNo}
                      </td>
                      <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {typedGroup.pwoNo}
                      </td>
                      <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {typedGroup.workCode}
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100" style="word-wrap: break-word;">
                        {typedGroup.workName}
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-wrap gap-1">
                          {#each typedGroup.items as report}
                            {@const skillName = report.skillMapping?.sc_name || report.prdn_work_planning?.std_work_skill_mapping?.sc_name || report.prdn_work_planning?.sc_required || 'N/A'}
                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                              {skillName}
                            </span>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {#if typedGroup.items && typedGroup.items.length > 0}
                          {@const firstItem = typedGroup.items[0]}
                          {#if firstItem?.vehicleWorkFlow?.estimated_duration_minutes}
                            {formatTime(firstItem.vehicleWorkFlow.estimated_duration_minutes / 60)}
                          {:else if firstItem?.skillTimeStandard?.standard_time_minutes}
                            {formatTime(firstItem.skillTimeStandard.standard_time_minutes / 60)}
                          {:else}
                            N/A
                          {/if}
                        {:else}
                          N/A
                        {/if}
                      </td>
                      <td class="px-4 py-2 text-sm">
                        <div class="flex flex-wrap gap-1">
                          {#each typedGroup.items as report}
                            {#if report.completion_status === 'C'}
                              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Completed</span>
                            {:else if report.completion_status === 'NC'}
                              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">Not Completed</span>
                            {:else}
                              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                {report.completion_status || 'Unknown'}
                              </span>
                            {/if}
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs">
                              {#if report.worker_id}
                                <span class="font-medium">{report.reporting_hr_emp?.emp_name || report.prdn_work_planning?.hr_emp?.emp_name || report.worker_id || 'N/A'}</span>
                                <span class="text-xs {report.lt_minutes_total > 0 ? 'text-gray-600' : 'theme-text-secondary'}"> ({report.reporting_hr_emp?.skill_short || report.prdn_work_planning?.hr_emp?.skill_short || 'N/A'})</span>
                              {:else}
                                <span class="text-gray-400 italic text-xs">No worker</span>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs font-medium">
                              {formatTime(report.hours_worked_till_date || 0)}
                            </div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs">{report.from_time || 'N/A'}</div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs">{report.to_time || 'N/A'}</div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs">
                              <div class="font-medium">
                                {formatTime(report.hours_worked_today || 0)}
                              </div>
                              {#if report.skillTimeStandard}
                                <div class="text-xs text-gray-600 dark:text-gray-400">
                                  Std: {formatTime(report.skillTimeStandard.standard_time_minutes / 60)}
                                </div>
                                <div class="text-xs text-gray-600 dark:text-gray-400">
                                  Rem: {formatTime(report.remainingTimeMinutes / 60)}
                                </div>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs font-medium">
                              {formatTime((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0))}
                            </div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs">
                              {#if report.overtime_minutes && report.overtime_minutes > 0}
                                <span class="text-orange-600 dark:text-orange-400 font-medium">
                                  {formatTime((report.overtime_minutes || 0) / 60)}
                                </span>
                              {:else}
                                <span class="text-gray-400">-</span>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs">
                              {#if report.lt_minutes_total > 0}
                                <span class="text-yellow-600 dark:text-yellow-400 font-medium">
                                  {report.lt_minutes_total}m
                                </span>
                              {:else}
                                <span class="text-green-600 dark:text-green-400">-</span>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs space-y-1 text-gray-700 dark:text-gray-300">
                              {#if report.deviations && report.deviations.length > 0}
                                {@const deviation = report.deviations[0]}
                                <div class="text-orange-600 dark:text-orange-400">
                                  <span class="font-medium">{formatDeviationTypeLabel(deviation.deviation_type)}</span>
                                  {#if deviation.reason?.trim()}
                                    <div class="mt-0.5 whitespace-normal">{deviation.reason.trim()}</div>
                                  {/if}
                                </div>
                              {/if}
                              {#if report.lt_details && Array.isArray(report.lt_details) && report.lt_details.length > 0}
                                <div class="truncate" title={formatLostTimeDetails(report.lt_details)}>
                                  {formatLostTimeDetails(report.lt_details)}
                                </div>
                              {:else if report.lt_minutes_total > 0}
                                <span class="text-gray-500 dark:text-gray-400">N/A</span>
                              {:else if !(report.deviations && report.deviations.length > 0)}
                                <span class="text-gray-500 dark:text-gray-400">-</span>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs">{formatDateTimeLocal(report.created_dt)}</div>
                          {/each}
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        {:else if activeTab === 'manpower-report'}
          {#if isManpowerReportLoading}
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
              <span class="theme-text-secondary">Loading manpower reports...</span>
            </div>
          {:else if manpowerReportData.length === 0}
            <div class="text-center py-12">
              <p class="theme-text-secondary">No manpower reports in this submission</p>
            </div>
          {:else}
            <div class="px-6 py-4 border-b theme-border flex justify-end">
              <Button
                variant="primary"
                size="sm"
                on:click={handleGenerateExcel}
                disabled={
                  !selectedSubmission || (worksReportData.length === 0 && manpowerReportData.length === 0)
                }
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
                    <th class="px-4 py-2 text-right text-xs font-medium theme-text-secondary uppercase">Reported Hours</th>
                    <th class="px-4 py-2 text-right text-xs font-medium theme-text-secondary uppercase">OT Hours</th>
                    <th class="px-4 py-2 text-right text-xs font-medium theme-text-secondary uppercase">C-Off Hours</th>
                    <th class="px-4 py-2 text-right text-xs font-medium theme-text-secondary uppercase">LTP Hours</th>
                    <th class="px-4 py-2 text-right text-xs font-medium theme-text-secondary uppercase">LTNP Hours</th>
                  </tr>
                </thead>
                <tbody class="divide-y theme-border">
                  {#each manpowerReportRowsSorted as report, i (manpowerRowKey(report, i))}
                    <tr
                      class="hover:theme-bg-secondary transition-colors {attendanceIsAbsentUninformed(report?.attendance_status)
                        ? 'bg-red-50 dark:bg-red-950/30'
                        : ''}"
                    >
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {report.hr_emp?.emp_name || 'N/A'}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary whitespace-nowrap">
                        {stageShiftLabel(report)}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {#if isManpowerReassignmentRow(report)}
                          <span class="text-xs theme-text-secondary">{attendanceCellSecondary(report)}</span>
                        {:else}
                          <span
                            class="inline-flex min-h-7 min-w-7 items-center justify-center rounded-md border border-transparent px-1.5 py-0.5 text-xs font-bold leading-tight {attendanceBadgeClassReport(report)}"
                          >
                            {attendanceLetterDisplay(report)}
                          </span>
                        {/if}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary text-right tabular-nums">
                        {isManpowerReassignmentRow(report) ? '—' : formatManpowerHoursCell(report.actual_hours)}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary text-right tabular-nums">
                        {isManpowerReassignmentRow(report) ? '—' : formatManpowerHoursCell(report.ot_hours)}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary text-right tabular-nums">
                        {isManpowerReassignmentRow(report) ? '—' : formatManpowerHoursCell(report.c_off_value)}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary text-right tabular-nums">
                        {formatManpowerHoursCell(report.ltp_hours)}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary text-right tabular-nums">
                        {formatManpowerHoursCell(
                          report.ltnp_hours != null && report.ltnp_hours > 0
                            ? report.ltnp_hours
                            : report.calculated_ltnp_hours
                        )}
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
        {approvalAction === 'approve' ? 'Approve Reporting' : 'Reject Reporting'}
      </h3>
      
      {#if approvalAction === 'reject'}
        <div class="mb-4">
          <label for="report-review-rejection-reason" class="block text-sm font-medium theme-text-primary mb-2">
            Reason for Rejection <span class="text-red-500">*</span>
          </label>
          <textarea
            id="report-review-rejection-reason"
            bind:value={rejectionReason}
            rows="4"
            placeholder="Enter reason for rejection..."
            class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg"
          ></textarea>
        </div>
      {:else}
        <p class="theme-text-secondary mb-4">
          Are you sure you want to approve this reporting submission?
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
      <h3 class="text-lg font-semibold theme-text-primary mb-4">Revert Approved Report</h3>

      <div class="mb-4">
        <label for="report-review-revert-reason" class="block text-sm font-medium theme-text-primary mb-2">
          Reason for Revert <span class="text-red-500">*</span>
        </label>
        <textarea
          id="report-review-revert-reason"
          bind:value={revertReason}
          rows="4"
          placeholder="Enter reason for reverting this approved report..."
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

<!-- Fullscreen Works Report PDF Viewer -->
{#if showWorksReportFullscreen && pdfBlob}
  <div class="fixed inset-0 z-[10000] theme-bg-primary flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b theme-border">
      <div>
        <h2 class="text-xl font-semibold theme-text-primary">📊 Works Report - Fullscreen</h2>
        <p class="text-sm theme-text-secondary mt-1">
          {selectedSubmission?.stage_code} - {selectedSubmission?.reporting_date ? new Date(selectedSubmission.reporting_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : ''}
        </p>
      </div>
      <div class="flex items-center space-x-3">
        <Button variant="primary" size="sm" on:click={handleGeneratePDF} disabled={isGeneratingPDF}>
          {isGeneratingPDF ? 'Generating...' : 'Regenerate PDF'}
        </Button>
        <button
          on:click={closeWorksReportFullscreen}
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
        downloadFileName={worksReportPdfDownloadName()}
      />
    </div>
  </div>
{/if}

<FloatingThemeToggle />

