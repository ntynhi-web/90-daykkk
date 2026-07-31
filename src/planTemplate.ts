import { AppState, Goal, Routine, ScheduleItem } from "./types";

export const MAX_TEMPLATE_BYTES = 256 * 1024;
export const MAX_TEXT_LENGTH = 5000;
const isDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00`));
const isTime = (value: unknown) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const cleanText = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} không được để trống.`);
  if (value.length > MAX_TEXT_LENGTH) throw new Error(`${field} vượt quá ${MAX_TEXT_LENGTH} ký tự.`);
  return value.trim();
};

export function validatePlanTemplate(raw: unknown, fallback: AppState) {
  if (!raw || typeof raw !== "object") throw new Error("Template phải là JSON object.");
  const plan = (raw as any).plan || raw as any;
  if (!Array.isArray(plan.goals) || plan.goals.length < 1 || plan.goals.length > 20) throw new Error("Template phải có từ 1 đến 20 mục tiêu.");
  if (!Array.isArray(plan.routines) || plan.routines.length > 100) throw new Error("Routines không hợp lệ hoặc vượt quá 100 mục.");
  const ids = new Set<string>();
  const goals: Goal[] = plan.goals.map((input: any, goalIndex: number) => {
    const id = cleanText(input?.id, `Goal ${goalIndex + 1} ID`);
    if (ids.has(id)) throw new Error(`Goal ID bị trùng: ${id}.`);
    ids.add(id);
    if (!Array.isArray(input.milestones) || input.milestones.length < 1 || input.milestones.length > 30) throw new Error(`Goal “${input?.name || id}” phải có từ 1 đến 30 bước.`);
    const milestones = input.milestones.map((step: any, stepIndex: number) => {
      if (!isDate(step?.dueDate)) throw new Error(`Ngày hạn của bước ${stepIndex + 1} không hợp lệ.`);
      return { ...step, id: cleanText(step?.id, `Milestone ${stepIndex + 1} ID`), goalId: id, title: cleanText(step?.title, `Milestone ${stepIndex + 1}`), targetValue: cleanText(step?.targetValue, `Kết quả milestone ${stepIndex + 1}`), dueDate: step.dueDate, order: Number.isFinite(Number(step.order)) ? Number(step.order) : stepIndex, achieved: Boolean(step.achieved), currentValue: String(step.currentValue ?? "0"), status: step.status === "completed" || step.status === "active" ? step.status : "locked" };
    });
    return { ...input, id, name: cleanText(input?.name, `Goal ${goalIndex + 1}`), description: cleanText(input?.description || input?.desiredOutcome, `Mô tả goal ${goalIndex + 1}`), desiredOutcome: cleanText(input?.desiredOutcome || input?.description, `Kết quả goal ${goalIndex + 1}`), startDate: isDate(input?.startDate) ? input.startDate : fallback.startDate, deadline: isDate(input?.deadline) ? input.deadline : fallback.endDate, milestones } as Goal;
  });
  const goalIds = new Set(goals.map(goal => goal.id));
  const routines: Routine[] = plan.routines.map((input: any, index: number) => {
    if (!goalIds.has(input?.goalId)) throw new Error(`Routine ${index + 1} tham chiếu goal không tồn tại.`);
    return { ...input, id: cleanText(input?.id, `Routine ${index + 1} ID`), goalId: input.goalId, name: cleanText(input?.name, `Routine ${index + 1}`), frequency: cleanText(input?.frequency, `Tần suất routine ${index + 1}`), minimumDay: cleanText(input?.minimumDay, `Mức tối thiểu routine ${index + 1}`), target: cleanText(input?.target, `Mục tiêu routine ${index + 1}`), evidence: cleanText(input?.evidence || "Check-in", `Bằng chứng routine ${index + 1}`), status: ["completed", "pending", "missed"].includes(input?.status) ? input.status : "pending" } as Routine;
  });
  const scheduleItems: ScheduleItem[] = (Array.isArray(plan.scheduleItems) ? plan.scheduleItems : []).slice(0, 2000).map((input: any, index: number) => {
    if (!isDate(input?.date) || !isTime(input?.startTime) || !isTime(input?.endTime) || input.endTime <= input.startTime) throw new Error(`Lịch ${index + 1} có ngày/giờ không hợp lệ.`);
    return { ...input, id: cleanText(input?.id, `Lịch ${index + 1} ID`), title: cleanText(input?.title, `Lịch ${index + 1}`), date: input.date, startTime: input.startTime, endTime: input.endTime, completed: Boolean(input.completed) } as ScheduleItem;
  });
  const startDate = isDate(plan.startDate) ? plan.startDate : fallback.startDate;
  const endDate = isDate(plan.endDate) ? plan.endDate : fallback.endDate;
  if (endDate < startDate) throw new Error("Ngày kết thúc phải sau ngày bắt đầu.");
  return { startDate, endDate, goals, routines, scheduleItems };
}

export async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (error: any) {
    if (error?.name === "AbortError") throw new Error("AI phản hồi quá 20 giây. Vui lòng thử lại.");
    throw new Error("Mất kết nối mạng. Template chưa được thay đổi.");
  } finally { window.clearTimeout(timeout); }
}
