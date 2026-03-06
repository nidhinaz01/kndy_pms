import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';

export function calculateStageTransferHours(
  stageJourney: Array<{
    from_stage: string;
    to_stage: string;
    reassigned_at: string;
    from_time: string;
    to_time: string;
    reason?: string;
    reassigned_by: string;
  }>,
  currentStage: string,
  // breakTimes: array of { start_time, end_time } in HH:MM format for the employee's shift
  breakTimes: Array<{ start_time: string; end_time: string }> = []
): { toOtherStageHours: number; fromOtherStageHours: number } {
  let toOtherStageHours = 0;
  let fromOtherStageHours = 0;

  stageJourney.forEach(journey => {
    const hours = calculateTimeDifferenceMinusBreaks(journey.from_time, journey.to_time, breakTimes);
    
    if (journey.from_stage === currentStage && journey.to_stage !== currentStage) {
      toOtherStageHours += hours;
    } else if (journey.from_stage !== currentStage && journey.to_stage === currentStage) {
      fromOtherStageHours += hours;
    }
  });

  return { toOtherStageHours, fromOtherStageHours };
}

function calculateTimeDifferenceMinusBreaks(fromTime: string, toTime: string, breakTimes: Array<{ start_time: string; end_time: string }>): number {
  try {
    if (!fromTime || !toTime) return 0;
    // Calculate raw duration in minutes
    const from = new Date(`2000-01-01T${fromTime}`);
    let to = new Date(`2000-01-01T${toTime}`);
    
    if (to < from) {
      to = new Date(`2000-01-02T${toTime}`);
    }
    
    const diffMs = to.getTime() - from.getTime();
    const durationMinutes = diffMs / (1000 * 60);

    // Subtract overlapping break minutes using utility
    const breakMinutes = calculateBreakTimeInMinutes(fromTime, toTime, breakTimes || []);
    const netMinutes = Math.max(0, durationMinutes - breakMinutes);

    return netMinutes / 60;
  } catch (error) {
    console.error('Error calculating time difference minus breaks:', error);
    return 0;
  }
}

