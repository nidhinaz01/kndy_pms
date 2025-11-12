<script lang="ts">
  import type { Holiday } from '$lib/api/planning';

  export let holidays: Holiday[] = [];
  export let selectedYear: number;

  // Tooltip state
  let hoveredHoliday: Holiday | null = null;
  let tooltipX = 0;
  let tooltipY = 0;

  // Create a map of holidays by date for quick lookup
  $: holidayMap = new Map<string, Holiday>();
  $: {
    holidayMap.clear();
    console.log('Loading holidays:', holidays);
    holidays.forEach(holiday => {
      const dateKey = `${holiday.dt_year}-${holiday.dt_month}-${holiday.dt_day}`;
      holidayMap.set(dateKey, holiday);
      console.log(`Added holiday to map: ${dateKey}`, holiday);
    });
    console.log('Holiday map keys:', Array.from(holidayMap.keys()));
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 1).getDay();
  }

  function isHoliday(year: number, month: number, day: number): Holiday | null {
    const monthName = monthNames[month];
    // Create date key using the month name as stored in the database
    const dateKey = `${year}-${monthName}-${day}`;
    const holiday = holidayMap.get(dateKey);
    
    // Debug: Log when holidays are found
    if (holiday) {
      console.log(`Found holiday: ${dateKey}`, holiday);
    }
    
    return holiday || null;
  }

  function getCalendarDays(year: number, month: number): (number | null)[] {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days: (number | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  }
</script>

<div class="p-5 font-sans">
  <h2 class="text-center mb-5 text-xl font-bold theme-text-primary">Holiday Calendar - {selectedYear}</h2>
  
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
    {#each monthNames as monthName, monthIndex}
      <div class="border theme-border rounded-lg p-3 theme-bg-primary shadow-sm">
        <h3 class="text-center mb-3 text-sm font-semibold theme-text-primary">{monthName}</h3>
        
        <!-- Day headers -->
        <div class="grid grid-cols-7 gap-1 mb-2">
          {#each dayNames as dayName}
            <div class="text-center text-xs font-bold theme-text-secondary p-1">
              {dayName}
            </div>
          {/each}
        </div>
        
        <!-- Calendar days -->
        <div class="grid grid-cols-7 gap-1">
          {#each getCalendarDays(selectedYear, monthIndex) as day}
            {#if day === null}
              <div class="h-6"></div>
            {:else}
              {@const holiday = isHoliday(selectedYear, monthIndex, day)}
              <button 
                type="button"
                class="calendar-day {holiday ? 'holiday' : ''} {holiday && holiday.is_active ? 'active-holiday' : ''} {holiday && !holiday.is_active ? 'inactive-holiday' : ''}"
                aria-label={holiday ? `${holiday.description} - ${holiday.is_active ? 'Active' : 'Inactive'} holiday` : `${monthName} ${day}, ${selectedYear}`}
                on:mouseenter={(e) => {
                  if (holiday) {
                    hoveredHoliday = holiday;
                    const rect = e.currentTarget.getBoundingClientRect();
                    tooltipX = rect.left + rect.width / 2;
                    tooltipY = rect.top - 10;
                  }
                }}
                on:mouseleave={() => {
                  hoveredHoliday = null;
                }}
                on:click={(e) => {
                  if (holiday) {
                    hoveredHoliday = hoveredHoliday === holiday ? null : holiday;
                    if (hoveredHoliday) {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      tooltipX = rect.left + rect.width / 2;
                      tooltipY = rect.top - 10;
                    }
                  }
                }}
                on:keydown={(e) => {
                  if (holiday && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    hoveredHoliday = hoveredHoliday === holiday ? null : holiday;
                    if (hoveredHoliday) {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      tooltipX = rect.left + rect.width / 2;
                      tooltipY = rect.top - 10;
                    }
                  }
                }}
              >
                {day}
              </button>
            {/if}
          {/each}
        </div>
      </div>
    {/each}
  </div>
  
  <!-- Legend -->
  <div class="mt-5 text-center">
    <div class="inline-flex gap-5 items-center">
      <div class="flex items-center gap-2">
        <div class="legend-active"></div>
        <span class="text-sm theme-text-primary font-medium">Active Holiday</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="legend-inactive"></div>
        <span class="text-sm theme-text-primary font-medium">Inactive Holiday</span>
      </div>
    </div>
  </div>
</div>

<!-- Tooltip -->
{#if hoveredHoliday}
  <div 
    class="
      fixed z-50 px-3 py-2 rounded-lg shadow-lg text-sm
      theme-bg-primary theme-border border
      max-w-xs
    "
    style="left: {tooltipX}px; top: {tooltipY}px; transform: translateX(-50%);"
  >
    <div class="font-semibold theme-text-primary mb-1">
      {hoveredHoliday.description}
    </div>
    <div class="theme-text-secondary text-xs">
      {hoveredHoliday.dt_month} {hoveredHoliday.dt_day}, {hoveredHoliday.dt_year}
    </div>
    <div class="theme-text-secondary text-xs">
      Status: {hoveredHoliday.is_active ? 'Active' : 'Inactive'}
    </div>
  </div>
{/if}

<style>
  .calendar-day {
    height: 24px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    border-radius: 4px;
    transition: all 0.2s;
    border: none;
    padding: 0;
    background-color: transparent;
    color: inherit;
    font-weight: normal;
    cursor: default;
  }

  .calendar-day:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }

  .calendar-day.holiday {
    cursor: pointer;
    font-weight: bold;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .calendar-day.active-holiday {
    background-color: #16a34a !important;
    color: white !important;
  }

  .calendar-day.active-holiday:hover {
    background-color: #15803d !important;
  }

  .calendar-day.inactive-holiday {
    background-color: #dc2626 !important;
    color: white !important;
  }

  .calendar-day.inactive-holiday:hover {
    background-color: #b91c1c !important;
  }

  .legend-active {
    width: 16px;
    height: 16px;
    background-color: #16a34a;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .legend-inactive {
    width: 16px;
    height: 16px;
    background-color: #dc2626;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
</style> 