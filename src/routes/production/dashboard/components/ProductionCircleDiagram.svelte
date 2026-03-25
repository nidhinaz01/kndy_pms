<script lang="ts">
  import type { CentralPlantNode, CentralShiftMetrics } from '../services/centralProductionMetricsService';
  import type { StageShiftPair } from '../services/dashboardDataService';

  export let plants: CentralPlantNode[] = [];
  export let selectedStageCode = '';
  export let selectedShiftCode = '';
  export let mode: 'planning' | 'reporting' | 'both' = 'both';
  export let onSelectStageShift: (pair: StageShiftPair) => void = () => {};

  const palette = ['#2563EB', '#F97316', '#10B981', '#A855F7', '#06B6D4', '#EF4444'];

  $: plantsSorted = [...(plants || [])].sort((a, b) => a.plantCode.localeCompare(b.plantCode));
  $: plantColors = Object.fromEntries(
    plantsSorted.map((p, i) => [p.plantCode, palette[i % palette.length]])
  ) as Record<string, string>;

  $: selectedPlantCode =
    plantsSorted.find((p) => p.stages.some((s) => s.stageCode === selectedStageCode))?.plantCode || '';

  $: selectedPlant =
    plantsSorted.find((p) => p.plantCode === selectedPlantCode) || null;

  $: selectedStage =
    selectedPlant?.stages.find((s) => s.stageCode === selectedStageCode) || null;

  const cx = 200;
  const cy = 200;

  // Radii: outer donut is plants, middle donut is stages (only inside selected plant),
  // inner ring is shift markers.
  const outerInnerR = 120;
  const outerOuterR = 165;

  const stageInnerR = 70;
  const stageOuterR = 115;

  const shiftR = 52;

  const baseAngle = -90; // top
  const plantGapDeg = 4;
  const stageGapDeg = 2;

  function polarToCartesian(radius: number, angleDeg: number) {
    const a = (angleDeg * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(a),
      y: cy + radius * Math.sin(a)
    };
  }

  function donutSectorPath(innerR: number, outerR: number, startAngleDeg: number, endAngleDeg: number) {
    const startOuter = polarToCartesian(outerR, startAngleDeg);
    const endOuter = polarToCartesian(outerR, endAngleDeg);
    const startInner = polarToCartesian(innerR, startAngleDeg);
    const endInner = polarToCartesian(innerR, endAngleDeg);

    const largeArcFlag = endAngleDeg - startAngleDeg > 180 ? 1 : 0;

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${startInner.x} ${startInner.y}`,
      'Z'
    ].join(' ');
  }

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
    const stage = selectedPlant?.stages.find((s) => s.stageCode === stageCode) || null;
    const firstShift = stage?.shifts?.[0];
    if (!stage || !firstShift) return;
    onSelectStageShift({ stageCode: stageCode, shiftCode: firstShift.shiftCode });
  }

  function handleShiftClick(shift: CentralShiftMetrics) {
    onSelectStageShift({ stageCode: shift.stageCode, shiftCode: shift.shiftCode });
  }

  function hotForShift(shift: CentralShiftMetrics) {
    if (mode === 'planning') return (shift.workOrdersPlanned || 0) > 0;
    if (mode === 'reporting') return (shift.workOrdersReportedWithLostTime || 0) > 0;
    // both
    return (shift.workOrdersReportedWithLostTime || 0) > 0 || (shift.workOrdersPlanned || 0) > 0;
  }

  $: plantAngles = (() => {
    const n = Math.max(plantsSorted.length, 1);
    const available = 360 - plantGapDeg * n;
    const seg = available / n;
    let a = baseAngle;
    return plantsSorted.map((p, i) => {
      const start = a + i * (seg + plantGapDeg);
      const end = start + seg;
      return { plant: p, start, end, index: i };
    });
  })();

  $: stageAngles = (() => {
    if (!selectedPlant || !selectedPlant.stages || selectedPlant.stages.length === 0) return [];
    const stages = selectedPlant.stages;
    const plant = plantAngles.find((x) => x.plant.plantCode === selectedPlant.plantCode);
    if (!plant) return [];

    const count = Math.max(stages.length, 1);
    const available = (plant.end - plant.start) - stageGapDeg * count;
    const seg = available / count;

    return stages.map((s, j) => {
      const start = plant.start + j * (seg + stageGapDeg);
      const end = start + seg;
      return { stage: s, start, end, index: j };
    });
  })();

  $: shiftAngles = (() => {
    if (!selectedStage) return [];
    const shifts = selectedStage.shifts || [];
    if (shifts.length === 0) return [];
    const seg = stageAngles.find((x) => x.stage.stageCode === selectedStage.stageCode);
    if (!seg) return [];
    const count = Math.max(shifts.length, 1);
    const available = (seg.end - seg.start);

    return shifts.map((sh, k) => {
      const w = available / count;
      const start = seg.start + k * w;
      const end = start + w;
      const mid = (start + end) / 2;
      return { shift: sh, mid, start, end, index: k };
    });
  })();

  function handleRectKey(e: KeyboardEvent, action: () => void) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  }

  $: selectedPlantCodeSafe = selectedPlantCode || (plantsSorted[0]?.plantCode ?? '');
</script>

<svg
  viewBox="0 0 420 420"
  width="100%"
  height="auto"
  role="img"
  aria-label="Production circle hierarchy diagram"
>
  <defs>
    <linearGradient id="bgGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0B1220" stop-opacity="0.7" />
      <stop offset="50%" stop-color="#111827" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#0B1220" stop-opacity="0.7" />
    </linearGradient>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.35" />
    </filter>
  </defs>

  <circle cx="{cx}" cy="{cy}" r="190" fill="url(#bgGlow)" filter="url(#softShadow)" opacity="0.9" />

  <text x="{cx}" y="{cy - 112}" text-anchor="middle" font-size="14" fill="#93C5FD" opacity="0.95">
    PRODUCTION
  </text>

  <!-- Plant ring -->
  {#each plantAngles as seg (seg.plant.plantCode)}
    {@const plantCode = seg.plant.plantCode}
    {@const color = getPlantColor(plantCode)}
    {@const isSelected = plantCode === selectedPlantCodeSafe}
    <path
      d="{donutSectorPath(outerInnerR, outerOuterR, seg.start, seg.end)}"
      fill="{color}"
      fill-opacity="{isSelected ? 0.34 : 0.16}"
      stroke="{color}"
      stroke-opacity="{isSelected ? 0.95 : 0.35}"
      stroke-width="2"
      role="button"
      tabindex="0"
      aria-label={`Plant ${plantCode}`}
      on:click={() => handlePlantClick(seg.plant)}
      on:keydown={(e) => handleRectKey(e as any, () => handlePlantClick(seg.plant))}
    />
    {@const mid = (seg.start + seg.end) / 2}
    {@const labelPos = polarToCartesian((outerInnerR + outerOuterR) / 2, mid)}
    <text
      x="{labelPos.x}"
      y="{labelPos.y}"
      text-anchor="middle"
      font-size="12"
      fill="#E5E7EB"
      opacity="{isSelected ? 1 : 0.75}"
    >
      {plantCode}
    </text>
  {/each}

  <!-- Stage ring (inside selected plant only) -->
  {#if selectedPlant}
    {#each stageAngles as seg (seg.stage.stageCode)}
      {@const stageCode = seg.stage.stageCode}
      {@const plantColor = getPlantColor(selectedPlant.plantCode)}
      {@const isSelected = stageCode === selectedStageCode}
      <path
        d="{donutSectorPath(stageInnerR, stageOuterR, seg.start, seg.end)}"
        fill="{plantColor}"
        fill-opacity="{isSelected ? 0.22 : 0.08}"
        stroke="{plantColor}"
        stroke-opacity="{isSelected ? 0.95 : 0.35}"
        stroke-width="2"
        role="button"
        tabindex="0"
        aria-label={`Stage ${stageCode}`}
        on:click={() => handleStageClick(stageCode)}
        on:keydown={(e) => handleRectKey(e as any, () => handleStageClick(stageCode))}
      />
      {@const mid = (seg.start + seg.end) / 2}
      {@const labelPos = polarToCartesian((stageInnerR + stageOuterR) / 2, mid)}
      <text
        x="{labelPos.x}"
        y="{labelPos.y}"
        text-anchor="middle"
        font-size="11"
        fill="#E5E7EB"
        opacity="{isSelected ? 1 : 0.75}"
      >
        {stageCode}
      </text>
    {/each}
  {/if}

  <!-- Shift markers (inside selected stage only) -->
  {#if selectedStage}
    {#each shiftAngles as s (s.shift.shiftCode)}
      {@const shiftCode = s.shift.shiftCode}
      {@const shift = s.shift}
      {@const plantColor = getPlantColor(shift.plantCode)}
      {@const isSelected = shiftCode === selectedShiftCode && shift.stageCode === selectedStageCode}
      {@const showHot = hotForShift(shift)}
      {@const markerColor = showHot ? '#F59E0B' : plantColor}
      {@const pos = polarToCartesian(shiftR, s.mid)}
      <circle
        cx="{pos.x}"
        cy="{pos.y}"
        r="{isSelected ? 8 : 5.5}"
        fill="{markerColor}"
        fill-opacity="{isSelected ? 0.95 : 0.45}"
        stroke="{plantColor}"
        stroke-opacity="{isSelected ? 1 : 0.55}"
        stroke-width="{isSelected ? 2.5 : 2}"
        role="button"
        tabindex="0"
        aria-label={`Shift ${shift.stageCode}-${shift.shiftCode}`}
        style="cursor: pointer;"
        on:click={(e) => { e.stopPropagation(); handleShiftClick(shift); }}
        on:keydown={(e) => handleRectKey(e as any, () => { handleShiftClick(shift); })}
      >
        <title>
          {shift.stageCode}-{shift.shiftCode}
          {"\n"}Rep WO: {shift.workOrdersReported}
          {"\n"}LT WO: {shift.workOrdersReportedWithLostTime}
          {"\n"}Rep MW: {shift.manpowerReportedAttendance}
        </title>
      </circle>
    {/each}
  {/if}

  <!-- Center legend -->
  <text x="{cx}" y="{cy + 88}" text-anchor="middle" font-size="10" fill="#CBD5E1" opacity="0.9">
    Outer: Plant · Middle: Stage · Inner: Shift
  </text>
</svg>

