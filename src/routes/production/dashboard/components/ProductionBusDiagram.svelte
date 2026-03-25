<script lang="ts">
  import type { CentralPlantNode, CentralShiftMetrics } from '../services/centralProductionMetricsService';
  import type { StageShiftPair } from '../services/dashboardDataService';

  export let plants: CentralPlantNode[] = [];
  export let selectedStageCode = '';
  export let selectedShiftCode = '';
  export let mode: 'planning' | 'reporting' | 'both' = 'both';
  export let onSelectStageShift: (pair: StageShiftPair) => void = () => {};

  const palette = ['#2563EB', '#F97316', '#10B981', '#A855F7', '#06B6D4', '#EF4444'];

  $: plantColors = Object.fromEntries(
    (plants || []).map((p, i) => [p.plantCode, palette[i % palette.length]])
  ) as Record<string, string>;

  $: selectedPlantCode =
    plants.find((p) => p.stages.some((s) => s.stageCode === selectedStageCode))?.plantCode || '';

  $: selectedStage =
    plants
      .find((p) => p.plantCode === selectedPlantCode)
      ?.stages.find((s) => s.stageCode === selectedStageCode) || null;

  function getPlantColor(plantCode: string) {
    return plantColors[plantCode] || '#2563EB';
  }

  function handlePlantClick(plant: CentralPlantNode) {
    const firstStage = plant.stages?.[0];
    const firstShift = firstStage?.shifts?.[0];
    if (!firstStage || !firstShift) return;
    onSelectStageShift({ stageCode: firstStage.stageCode, shiftCode: firstShift.shiftCode });
  }

  function handleStageClick(stageCode: string) {
    const plant = plants.find((p) => p.stages.some((s) => s.stageCode === stageCode));
    const stage = plant?.stages.find((s) => s.stageCode === stageCode);
    const firstShift = stage?.shifts?.[0];
    if (!stage || !firstShift) return;
    onSelectStageShift({ stageCode, shiftCode: firstShift.shiftCode });
  }

  function handleShiftClick(shift: CentralShiftMetrics) {
    onSelectStageShift({ stageCode: shift.stageCode, shiftCode: shift.shiftCode });
  }

  function isSelectedShift(shift: CentralShiftMetrics) {
    return shift.stageCode === selectedStageCode && shift.shiftCode === selectedShiftCode;
  }

  // SVG layout constants
  const busX = 26;
  const busY = 38;
  const busW = 848;
  const busH = 176;
  const busGap = 10;
  const maxSegments = Math.max(plants.length, 1);
  const segW = (busW - busGap * (maxSegments - 1)) / maxSegments;

  const selectedPlant = plants.find((p) => p.plantCode === selectedPlantCode) || null;
</script>

<svg
  viewBox="0 0 900 260"
  width="100%"
  height="auto"
  role="img"
  aria-label="Production bus hierarchy diagram"
>
  <defs>
    <linearGradient id="busMetal" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0B1220" stop-opacity="1" />
      <stop offset="45%" stop-color="#111827" stop-opacity="1" />
      <stop offset="100%" stop-color="#0B1220" stop-opacity="1" />
    </linearGradient>

    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Decorative bus base -->
  <rect x="{busX}" y="{busY}" width="{busW}" height="{busH}" rx="26" fill="url(#busMetal)" filter="url(#softShadow)" />

  <!-- Wheels -->
  <g opacity="0.9">
    <circle cx="{busX + 64}" cy="{busY + busH - 26}" r="18" fill="#0A0F1B" stroke="#334155" stroke-width="2" />
    <circle cx="{busX + busW - 64}" cy="{busY + busH - 26}" r="18" fill="#0A0F1B" stroke="#334155" stroke-width="2" />
    <circle cx="{busX + 64}" cy="{busY + busH - 26}" r="8" fill="#1F2937" />
    <circle cx="{busX + busW - 64}" cy="{busY + busH - 26}" r="8" fill="#1F2937" />
  </g>

  <!-- Plant segments -->
  {#each plants as plant, i (plant.plantCode)}
    {@const x = busX + i * (segW + busGap)}
    {@const color = getPlantColor(plant.plantCode)}
    {@const isSelectedPlant = plant.plantCode === selectedPlantCode}
    {@const showLostTime = mode === 'reporting' || mode === 'both'}
    {@const pulseNumerator = showLostTime ? plant.totals.workOrdersReportedWithLostTime : plant.totals.workOrdersPlanned}
    {@const pulseDenominator = showLostTime ? Math.max(1, plant.totals.workOrdersReported) : Math.max(1, plant.totals.workOrdersPlanned + plant.totals.workOrdersReported)}
    {@const pulseWidth = Math.max(0, Math.min(segW - 20, (segW - 20) * (pulseNumerator / pulseDenominator)))}
    {@const pulseColor = showLostTime ? '#F59E0B' : '#60A5FA'}

    <g>
      <rect
        x="{x}"
        y="{busY}"
        width="{segW}"
        height="{busH}"
        rx="18"
        fill="{color}"
        fill-opacity="{isSelectedPlant ? 0.34 : 0.16}"
        stroke="{color}"
        stroke-opacity="{isSelectedPlant ? 0.95 : 0.35}"
        stroke-width="2"
        style="cursor: pointer;"
        role="button"
        tabindex="0"
        aria-label={`Plant ${plant.plantCode}`}
        on:keydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handlePlantClick(plant);
          }
        }}
        on:click={() => handlePlantClick(plant)}
      />

      <text x="{x + segW / 2}" y="{busY + 22}" text-anchor="middle" font-size="14" fill="#E5E7EB" opacity="{isSelectedPlant ? 1 : 0.75}">
        {plant.plantCode}
      </text>

      <!-- A small “LT pulse” bar -->
      <rect
        x="{x + 10}"
        y="{busY + busH - 34}"
        width="{segW - 20}"
        height="10"
        rx="6"
        fill="#0B1220"
        fill-opacity="0.55"
        stroke="#334155"
        stroke-opacity="0.45"
      />
      <rect
        x="{x + 10}"
        y="{busY + busH - 34}"
        width="{pulseWidth}"
        height="10"
        rx="6"
        fill="{pulseColor}"
        fill-opacity="{pulseNumerator > 0 ? 0.85 : 0.25}"
      >
      </rect>
    </g>
  {/each}

  <!-- Stages + shifts only for the selected plant -->
  {#if selectedPlant}
    {#each selectedPlant.stages as stage, j (stage.stageCode)}
      {@const stageH = busH / Math.max(1, selectedPlant.stages.length)}
      {@const stageY = busY + j * stageH}
      {@const x0 = busX + plants.findIndex((p) => p.plantCode === selectedPlant.plantCode) * (segW + busGap)}
      {@const y0 = stageY}
      {@const color = getPlantColor(selectedPlant.plantCode)}

      <g>
        <!-- Stage band -->
        <rect
          x="{x0 + 7}"
          y="{y0 + 3}"
          width="{segW - 14}"
          height="{stageH - 6}"
          rx="14"
          fill="{color}"
          fill-opacity="{stage.stageCode === selectedStageCode ? 0.18 : 0.09}"
          stroke="{color}"
          stroke-opacity="{stage.stageCode === selectedStageCode ? 0.95 : 0.4}"
          stroke-width="2"
          style="cursor: pointer;"
          role="button"
          tabindex="0"
          aria-label={`Stage ${stage.stageCode}`}
          on:keydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleStageClick(stage.stageCode);
            }
          }}
          on:click={() => handleStageClick(stage.stageCode)}
        />

        <text
          x="{x0 + 18}"
          y="{y0 + 22}"
          font-size="11"
          fill="#E5E7EB"
          opacity="{stage.stageCode === selectedStageCode ? 1 : 0.75}"
        >
          {stage.stageCode}
        </text>

        <!-- Shift markers -->
        {#each stage.shifts as shift, k (shift.shiftCode)}
          {@const shiftCount = Math.max(1, stage.shifts.length)}
          {@const markerStartX = x0 + 20}
          {@const markerEndX = x0 + segW - 20}
          {@const markerW = markerEndX - markerStartX}
          {@const markerX = markerStartX + (k + 0.5) * (markerW / shiftCount)}
          {@const markerY = y0 + stageH - 18}
          {@const selected = isSelectedShift(shift)}
          {@const showLostTime = mode === 'reporting' || mode === 'both'}
          {@const markerHot = showLostTime ? shift.workOrdersReportedWithLostTime > 0 : shift.workOrdersPlanned > 0}
          {@const hotColor = showLostTime ? '#F59E0B' : '#60A5FA'}

          <circle
            cx="{markerX}"
            cy="{markerY}"
            r="{selected ? 7 : 5.5}"
            fill="{markerHot ? hotColor : color}"
            fill-opacity="{selected ? 0.95 : 0.45}"
            stroke="{color}"
            stroke-opacity="{selected ? 1 : 0.55}"
            stroke-width="{selected ? 2.5 : 2}"
            style="cursor: pointer;"
            role="button"
            tabindex="0"
            aria-label={`${shift.stageCode}-${shift.shiftCode}`}
            on:keydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                handleShiftClick(shift);
              }
            }}
            on:click={(e) => { e.stopPropagation(); handleShiftClick(shift); }}
          >
            <title>
              {shift.stageCode}-{shift.shiftCode}
              &#10;Rep WO: {shift.workOrdersReported}
              &#10;LT WO: {shift.workOrdersReportedWithLostTime}
              &#10;Rep MW: {shift.manpowerReportedAttendance}
            </title>
          </circle>

          {#if selected}
            <circle cx="{markerX}" cy="{markerY}" r="11" fill="transparent" stroke="#FFFFFF" stroke-width="1.5" />
          {/if}
        {/each}
      </g>
    {/each}
  {/if}

  <!-- Bus label -->
  <text x="{busX + busW / 2}" y="{busY - 8}" text-anchor="middle" font-size="14" fill="#93C5FD" opacity="0.95">
    PRODUCTION
  </text>
</svg>

