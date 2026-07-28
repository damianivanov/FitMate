/** Generic Monday-first month grid shared by the workout calendar and program calendar. */

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAYS_PER_WEEK = 7;

export type CalendarCell = {
  date: Date;
  dayKey: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function buildMonthMatrix(year: number, month: number): CalendarCell[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cellCount = Math.ceil((mondayOffset + daysInMonth) / DAYS_PER_WEEK) * DAYS_PER_WEEK;
  const start = new Date(year, month - 1, 1 - mondayOffset);
  const todayKey = toDayKey(new Date());

  const cells: CalendarCell[] = [];
  for (let index = 0; index < cellCount; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const dayKey = toDayKey(date);
    cells.push({
      date,
      dayKey,
      dayOfMonth: date.getDate(),
      isCurrentMonth: date.getMonth() === month - 1 && date.getFullYear() === year,
      isToday: dayKey === todayKey,
    });
  }

  return cells;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isFutureDate(date: Date): boolean {
  return startOfDay(date).getTime() > startOfDay(new Date()).getTime();
}
