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
  currentStage: string
): { toOtherStageHours: number; fromOtherStageHours: number } {
  let toOtherStageHours = 0;
  let fromOtherStageHours = 0;

  stageJourney.forEach(journey => {
    const hours = calculateTimeDifference(journey.from_time, journey.to_time);
    
    if (journey.from_stage === currentStage && journey.to_stage !== currentStage) {
      toOtherStageHours += hours;
    } else if (journey.from_stage !== currentStage && journey.to_stage === currentStage) {
      fromOtherStageHours += hours;
    }
  });

  return { toOtherStageHours, fromOtherStageHours };
}

function calculateTimeDifference(fromTime: string, toTime: string): number {
  try {
    const from = new Date(`2000-01-01T${fromTime}`);
    const to = new Date(`2000-01-01T${toTime}`);
    
    if (to < from) {
      to.setDate(to.getDate() + 1);
    }
    
    const diffMs = to.getTime() - from.getTime();
    return diffMs / (1000 * 60 * 60);
  } catch (error) {
    console.error('Error calculating time difference:', error);
    return 0;
  }
}

