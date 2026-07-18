import { Routine, ScheduleItem } from './types';

export type ScheduleRecurrence = 'once' | 'daily' | 'weekly_days' | 'interval';

export interface RecurringScheduleInput {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  journeyId?: string | null;
  recurrence?: ScheduleRecurrence;
  intervalDays?: number;
  scheduleDays?: number[];
  recurrenceEndDate?: string | null;
  routineId?: string | null;
}

const atNoon = (value: string) => new Date(`${value}T12:00:00`);
const dateKey = (value: Date) => value.toISOString().slice(0, 10);

export const addCalendarDays = (value: string, days: number) => {
  const date = atNoon(value);
  date.setDate(date.getDate() + days);
  return dateKey(date);
};

const clampStart = (candidate: string, cycleStart: string) => candidate < cycleStart ? cycleStart : candidate;

export function expandRecurringSchedule(input: RecurringScheduleInput, cycleStart: string, cycleEnd: string): ScheduleItem[] {
  const recurrence = input.recurrence || 'once';
  const start = clampStart(input.date || cycleStart, cycleStart);
  const end = input.recurrenceEndDate && input.recurrenceEndDate < cycleEnd ? input.recurrenceEndDate : cycleEnd;
  if (start > end) return [];

  const dates: string[] = [];
  if (recurrence === 'once') {
    dates.push(start);
  } else if (recurrence === 'interval') {
    const step = Math.max(1, input.intervalDays || 7);
    for (let date = start; date <= end; date = addCalendarDays(date, step)) dates.push(date);
  } else {
    const selectedDays = recurrence === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : (input.scheduleDays || []);
    for (let date = start; date <= end; date = addCalendarDays(date, 1)) {
      if (selectedDays.includes(atNoon(date).getDay())) dates.push(date);
    }
  }

  return dates.map(date => ({
    id: input.routineId ? `routine_schedule_${input.routineId}_${date}` : `schedule_${date}_${input.startTime}_${input.title.toLowerCase().replace(/[^a-z0-9]+/gi, '_')}`,
    title: input.title,
    date,
    startTime: input.startTime,
    endTime: input.endTime,
    goalId: input.journeyId || null,
    journeyId: input.journeyId || null,
    routineId: input.routineId || null,
    type: input.routineId ? 'habit' : 'task',
    completed: false
  }));
}

export function expandRoutine(routine: Routine, cycleStart: string, cycleEnd: string): ScheduleItem[] {
  if (!routine.calendarEnabled || !routine.startTime || !routine.endTime) return [];
  return expandRecurringSchedule({
    title: routine.name,
    date: routine.recurrenceStartDate || cycleStart,
    startTime: routine.startTime,
    endTime: routine.endTime,
    journeyId: routine.goalId,
    recurrence: routine.recurrence || (routine.scheduleDays?.length ? 'weekly_days' : 'daily'),
    intervalDays: routine.intervalDays,
    scheduleDays: routine.scheduleDays,
    routineId: routine.id
  }, cycleStart, cycleEnd);
}

export function mergeScheduleItems(existing: ScheduleItem[], incoming: ScheduleItem[]) {
  const key = (item: ScheduleItem) => item.routineId
    ? `${item.routineId}|${item.date}`
    : `${item.title.trim().toLowerCase()}|${item.date}|${item.startTime}|${item.endTime}`;
  const merged = new Map(existing.map(item => [key(item), item]));
  incoming.forEach(item => {
    const previous = merged.get(key(item));
    const overlapsLocked = [...merged.values()].some(current => current.locked && current.date === item.date && current.startTime < item.endTime && item.startTime < current.endTime && key(current) !== key(item));
    if (overlapsLocked) return;
    merged.set(key(item), previous ? { ...item, id: previous.id, completed: previous.completed } : item);
  });
  return [...merged.values()].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
}
