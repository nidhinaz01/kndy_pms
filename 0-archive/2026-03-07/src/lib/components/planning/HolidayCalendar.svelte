<script lang="ts">
  import type { Holiday } from '$lib/api/planning';

  export let holidays: Holiday[] = [];
  export let selectedYear: number;

  // Tooltip state
  let hoveredHoliday: Holiday | null = null;
  let hoveredDate: { year: number; month: number; day: number } | null = null;
  let tooltipX = 0;
  let tooltipY = 0;

  // Create a map of holidays by date for quick lookup (supports multiple holidays per date)
  // Always use dt_day, dt_month, dt_year to construct the date (more reliable than dt_value)
  $: holidayMap = new Map<string, Holiday[]>();
  $: {
    holidayMap.clear();
    holidays.forEach(holiday => {
      // Always construct date from dt_day, dt_month, dt_year for accurate matching
      // This ensures the calendar shows holidays on the correct day regardless of dt_value
      const monthIndex = monthNames.indexOf(holiday.dt_month);
      if (monthIndex !== -1) {
        // Use local date construction to avoid timezone issues
        const dateObj = new Date(holiday.dt_year, monthIndex, holiday.dt_day);
        // Format as YYYY-MM-DD manually to avoid timezone conversion
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;
        
        if (!holidayMap.has(dateKey)) {
          holidayMap.set(dateKey, []);
        }
        holidayMap.get(dateKey)!.push(holiday);
      }
    });
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

  function isHoliday(year: number, month: number, day: number): Holiday[] {
    // Create date string (YYYY-MM-DD) using local date methods to avoid timezone issues
    // Must match the same format used in holidayMap construction
    const dateObj = new Date(year, month, day);
    // Use local date methods (not toISOString which converts to UTC)
    const dateYear = dateObj.getFullYear();
    const dateMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dateDay = String(dateObj.getDate()).padStart(2, '0');
    const dateKey = `${dateYear}-${dateMonth}-${dateDay}`;
    
    // Get holidays for this exact date
    return holidayMap.get(dateKey) || [];
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
              {@const holidaysForDay = isHoliday(selectedYear, monthIndex, day)}
              {@const hasHolidays = holidaysForDay.length > 0}
              {@const activeHolidays = holidaysForDay.filter(h => h.is_active)}
              {@const hasActiveHolidays = activeHolidays.length > 0}
              {@const hasInactiveHolidays = holidaysForDay.some(h => !h.is_active)}
              <button 
                type="button"
                class="calendar-day {hasHolidays ? 'holiday' : ''} {hasActiveHolidays ? 'active-holiday' : ''} {hasInactiveHolidays && !hasActiveHolidays ? 'inactive-holiday' : ''} {hasActiveHolidays && hasInactiveHolidays ? 'mixed-holiday' : ''}"
                aria-label={hasHolidays ? `${holidaysForDay.map(h => h.description).join(', ')} - ${holidaysForDay.length} holiday(s)` : `${monthName} ${day}, ${selectedYear}`}
                on:mouseenter={(e) => {
                  if (hasHolidays) {
                    hoveredHoliday = holidaysForDay[0];
                    hoveredDate = { year: selectedYear, month: monthIndex, day };
                    const rect = e.currentTarget.getBoundingClientRect();
                    tooltipX = rect.left + rect.width / 2;
                    tooltipY = rect.top - 10;
                  }
                }}
                on:mouseleave={() => {
                  hoveredHoliday = null;
                  hoveredDate = null;
                }}
                on:click={(e) => {
                  if (hasHolidays) {
                    if (hoveredHoliday && hoveredDate && hoveredDate.day === day) {
                      hoveredHoliday = null;
                      hoveredDate = null;
                    } else {
                      hoveredHoliday = holidaysForDay[0];
                      hoveredDate = { year: selectedYear, month: monthIndex, day };
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      tooltipX = rect.left + rect.width / 2;
                      tooltipY = rect.top - 10;
                    }
                  }
                }}
                on:keydown={(e) => {
                  if (hasHolidays && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    if (hoveredHoliday && hoveredDate && hoveredDate.day === day) {
                      hoveredHoliday = null;
                      hoveredDate = null;
                    } else {
                      hoveredHoliday = holidaysForDay[0];
                      hoveredDate = { year: selectedYear, month: monthIndex, day };
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
{#if hoveredHoliday && hoveredDate}
  {@const dayHolidays = isHoliday(hoveredDate.year, hoveredDate.month, hoveredDate.day)}
  <div 
    class="
      fixed z-50 px-3 py-2 rounded-lg shadow-lg text-sm
      theme-bg-primary theme-border border
      max-w-xs
    "
    style="left: {tooltipX}px; top: {tooltipY}px; transform: translateX(-50%);"
  >
    {#if dayHolidays.length > 1}
      <div class="font-semibold theme-text-primary mb-2">
        {dayHolidays.length} Holidays
      </div>
      {#each dayHolidays as holiday}
        <div class="mb-2 pb-2 border-b theme-border last:border-0 last:mb-0 last:pb-0">
          <div class="font-semibold theme-text-primary">
            {holiday.description}
          </div>
          <div class="theme-text-secondary text-xs">
            Status: {holiday.is_active ? 'Active' : 'Inactive'}
          </div>
        </div>
      {/each}
    {:else}
      <div class="font-semibold theme-text-primary mb-1">
        {hoveredHoliday.description}
      </div>
      <div class="theme-text-secondary text-xs">
        {hoveredHoliday.dt_month} {hoveredHoliday.dt_day}, {hoveredHoliday.dt_year}
      </div>
      <div class="theme-text-secondary text-xs">
        Status: {hoveredHoliday.is_active ? 'Active' : 'Inactive'}
      </div>
    {/if}
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

  .calendar-day.mixed-holiday {
    background: linear-gradient(135deg, #16a34a 50%, #dc2626 50%) !important;
    color: white !important;
  }

  .calendar-day {
    position: relative;
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