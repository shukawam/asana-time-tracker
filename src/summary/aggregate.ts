import type { TimeEntry } from "../asana/timeEntries.js";
import { dowLabel } from "../util/date.js";

export interface TaskRollup {
  taskGid: string;
  name: string;
  permalink_url?: string;
  durationsByDate: Record<string, number>;
  totalMinutes: number;
}

export interface CustomerRollup {
  projectGid: string;
  name: string;
  byDate: Record<string, number>;
  totalMinutes: number;
  tasks: TaskRollup[];
}

export interface WeekRollup {
  start: string;
  end: string;
  days: string[];
  customers: CustomerRollup[];
  totalByDate: Record<string, number>;
  totalMinutes: number;
}

export function rollupWeek(entries: TimeEntry[], days: string[]): WeekRollup {
  const start = days[0];
  const end = days[days.length - 1];
  const customers = new Map<string, CustomerRollup>();
  const totalByDate: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
  let totalMinutes = 0;

  for (const e of entries) {
    if (!days.includes(e.entered_on)) continue;
    const project = e.task?.projects?.[0];
    const projectGid = project?.gid ?? "_none";
    const projectName = project?.name ?? "(no project)";

    let cust = customers.get(projectGid);
    if (!cust) {
      cust = {
        projectGid,
        name: projectName,
        byDate: Object.fromEntries(days.map((d) => [d, 0])),
        totalMinutes: 0,
        tasks: [],
      };
      customers.set(projectGid, cust);
    }
    cust.byDate[e.entered_on] += e.duration_minutes;
    cust.totalMinutes += e.duration_minutes;
    totalByDate[e.entered_on] += e.duration_minutes;
    totalMinutes += e.duration_minutes;

    const taskGid = e.task?.gid ?? "_unknown";
    let task = cust.tasks.find((t) => t.taskGid === taskGid);
    if (!task) {
      task = {
        taskGid,
        name: e.task?.name ?? "(unknown task)",
        permalink_url: e.task?.permalink_url,
        durationsByDate: {},
        totalMinutes: 0,
      };
      cust.tasks.push(task);
    }
    task.durationsByDate[e.entered_on] = (task.durationsByDate[e.entered_on] ?? 0) + e.duration_minutes;
    task.totalMinutes += e.duration_minutes;
  }

  const customerList = [...customers.values()].sort((a, b) => b.totalMinutes - a.totalMinutes);
  for (const c of customerList) {
    c.tasks.sort((a, b) => b.totalMinutes - a.totalMinutes);
  }

  return { start, end, days, customers: customerList, totalByDate, totalMinutes };
}

export function formatHoursCell(minutes: number): string {
  if (minutes === 0) return "-";
  return (minutes / 60).toFixed(2);
}

export function dayLabels(days: string[]): string[] {
  return days.map(dowLabel);
}
