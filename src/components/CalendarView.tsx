import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Plus, AlertCircle, Sparkles, Trash2, Check, LockKeyhole } from "lucide-react";
import { AppState, ScheduleItem } from "../types";
import { isScheduleValidForDate } from "../utils";

interface CalendarViewProps {
  state: AppState;
  onChangeState: (newState: AppState) => void;
}

export default function CalendarView({ state, onChangeState }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    const localToday = new Date(today.getTime() - offset);
    return localToday.toISOString().split('T')[0];
  });

  // Modal control states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newJourneyId, setNewJourneyId] = useState("");
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:00");
  const [newDate, setNewDate] = useState(selectedDate);
  const [addError, setAddError] = useState<string | null>(null);
  const [allowLockedOverride, setAllowLockedOverride] = useState(false);

  const activeJourneys = (state.goals || []).filter(g => g.status === 'active');
  const selectedWeekday = new Date(`${selectedDate}T12:00:00`).getDay();
  const selectedDayPlan = state.weeklyAvailability?.find(plan => plan.dayOfWeek === selectedWeekday);
  const yogaDue = state.routines.some(routine => routine.name.toLowerCase().includes('yoga') && routine.scheduleDays?.includes(selectedWeekday));

  // Navigate dates
  const handlePrevDate = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'day') {
      d.setDate(d.getDate() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDate = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'day') {
      d.setDate(d.getDate() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleGoToday = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    const localToday = new Date(today.getTime() - offset);
    setSelectedDate(localToday.toISOString().split('T')[0]);
  };

  // Helper to get week days around selected date
  const getWeekDays = () => {
    const curr = new Date(selectedDate);
    const first = curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1); // Monday is start
    const result = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(curr);
      d.setDate(first + i);
      result.push(d.toISOString().split('T')[0]);
    }
    return result;
  };

  // Detect collision or overlap
  const checkOverlaps = (items: ScheduleItem[]) => {
    const overlaps: Record<string, boolean> = {};
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const itemA = items[i];
        const itemB = items[j];
        if (itemA.date === itemB.date) {
          if ((itemA.locked && itemB.insideLockedBlock) || (itemB.locked && itemA.insideLockedBlock)) continue;
          const startA = parseInt(itemA.startTime.replace(":", ""));
          const endA = parseInt(itemA.endTime.replace(":", ""));
          const startB = parseInt(itemB.startTime.replace(":", ""));
          const endB = parseInt(itemB.endTime.replace(":", ""));

          // Condition for overlap: startA < endB && startB < endA
          if (startA < endB && startB < endA) {
            overlaps[itemA.id] = true;
            overlaps[itemB.id] = true;
          }
        }
      }
    }
    return overlaps;
  };

  const itemsForSelected = (state.scheduleItems || []).filter(item => isScheduleValidForDate(item)).filter(item => {
    if (viewMode === 'day') {
      return item.date === selectedDate;
    } else {
      return getWeekDays().includes(item.date);
    }
  });

  const overlapMap = checkOverlaps(state.scheduleItems || []);

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    if (newEndTime <= newStartTime) {
      setAddError('Giờ hoàn tất phải sau giờ bắt đầu.');
      return;
    }
    const lockedConflict = (state.scheduleItems || []).find(item => item.locked && item.date === newDate && item.startTime < newEndTime && newStartTime < item.endTime);
    const exceptionCount = lockedConflict ? (state.scheduleItems || []).filter(item => item.insideLockedBlock && item.date === newDate && item.startTime < lockedConflict.endTime && lockedConflict.startTime < item.endTime).length : 0;
    if (lockedConflict && !allowLockedOverride) {
      setAddError(`“${lockedConflict.title}” đang khóa ${lockedConflict.startTime}–${lockedConflict.endTime}. Bật “Việc phát sinh” nếu bạn thật sự cần thêm.`);
      return;
    }
    if (lockedConflict && exceptionCount >= (lockedConflict.lockedCapacity || 2)) {
      setAddError(`Khung này đã có đủ ${lockedConflict.lockedCapacity || 2} việc phát sinh. Hãy dời hoặc xóa một việc trước.`);
      return;
    }
    const newItem: ScheduleItem = {
      id: `schedule_${Date.now()}`,
      title: newTitle,
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      journeyId: newJourneyId || null,
      insideLockedBlock: Boolean(lockedConflict)
    };

    onChangeState({
      ...state,
      scheduleItems: [...(state.scheduleItems || []), newItem]
    });

    setNewTitle("");
    setAddError(null);
    setAllowLockedOverride(false);
    setShowAddModal(false);
  };

  const handleDeleteEvent = (id: string) => {
    onChangeState({
      ...state,
      scheduleItems: (state.scheduleItems || []).filter(item => item.id !== id)
    });
  };

  // Journey Styling Helpers
  const getJourneyColor = (id: string | null) => {
    if (!id) return { bg: 'bg-slate-50 border-slate-200 text-slate-800', badge: 'bg-slate-200 text-slate-700' };
    const index = (state.goals || []).findIndex(g => g.id === id);
    const colors = [
      { bg: 'bg-indigo-50 border-indigo-200 text-indigo-900', badge: 'bg-indigo-100 text-indigo-700' },
      { bg: 'bg-teal-50 border-teal-200 text-teal-950', badge: 'bg-teal-100 text-teal-700' },
      { bg: 'bg-amber-50 border-amber-200 text-amber-950', badge: 'bg-amber-100 text-amber-700' },
      { bg: 'bg-rose-50 border-rose-200 text-rose-950', badge: 'bg-rose-100 text-rose-700' },
      { bg: 'bg-sky-50 border-sky-200 text-sky-950', badge: 'bg-sky-100 text-sky-700' }
    ];
    return colors[index % colors.length] || colors[0];
  };

  const getJourneyName = (id: string | null) => {
    if (!id) return "Việc chung / Cá nhân";
    const j = (state.goals || []).find(g => g.id === id);
    return j ? j.name : "Hành trình";
  };

  // Helper to compute unoccupied segments and advice
  const getSuggestions = () => {
    const todayItems = (state.scheduleItems || []).filter(item => item.date === selectedDate);
    const occupiedSlots = new Set<number>();

    todayItems.forEach(item => {
      const start = parseInt(item.startTime.split(':')[0]);
      const end = Math.ceil(parseInt(item.endTime.split(':')[0]) + parseInt(item.endTime.split(':')[1]) / 60);
      for (let h = start; h < end; h++) {
        occupiedSlots.add(h);
      }
    });

    const suggestions: Array<{ slot: string; text: string }> = [];
    if (selectedDayPlan?.mode === 'rest') {
      suggestions.push({ slot: "Bất kỳ lúc nào", text: "Đây là ngày nghỉ. Không cần nhét thêm Deep Work; chỉ giữ life anchors và chuẩn bị nhẹ cho tuần mới nếu bạn muốn." });
      return suggestions;
    }
    if (selectedDayPlan?.mode === 'office') {
      if (!occupiedSlots.has(6) && !occupiedSlots.has(7)) suggestions.push({ slot: "06:30 - 07:30", text: "Một block duy nhất cho mục tiêu chính trước khi chuẩn bị đi công ty." });
      if (!occupiedSlots.has(19)) suggestions.push({ slot: "19:30 - 20:00", text: "Chỉ review hoặc routine nhẹ sau khi về nhà; không xếp Deep Work dài." });
    } else {
      if (!occupiedSlots.has(9) && !occupiedSlots.has(10)) suggestions.push({ slot: "09:00 - 11:00", text: "Block sâu cho mục tiêu chính trong ngày làm việc tại nhà." });
      if (!occupiedSlots.has(14) && !occupiedSlots.has(15) && !yogaDue) suggestions.push({ slot: "14:00 - 16:00", text: "Block hỗ trợ cho B2B, portfolio hoặc backtest." });
      if (yogaDue) suggestions.push({ slot: "17:30 - 18:15", text: "Buổi Yoga theo nhịp tuần; hoàn thành Yoga thì không cần đi bộ." });
    }

    if (suggestions.length === 0) {
      suggestions.push({ slot: "Bất kỳ lúc nào", text: "Lịch hôm nay đã khá dày, hãy tập trung hoàn thành tốt các khoảng thời gian đã lên lịch." });
    }

    return suggestions;
  };

  return (
    <div id="calendar-view" className="space-y-6">
      
      {/* HEADER CONTROL BAR */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Navigation & Jump to Today */}
        <div className="flex items-center gap-3">
          <button 
            id="btn-calendar-prev"
            onClick={handlePrevDate}
            className="p-2 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer text-slate-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <span className="text-sm font-bold text-slate-800 min-w-[140px] text-center">
            {viewMode === 'day' 
              ? new Date(selectedDate).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
              : `Tuần từ ${new Date(getWeekDays()[0]).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' })} đến ${new Date(getWeekDays()[6]).toLocaleDateString('vi-VN', { year: 'numeric', month: 'numeric', day: 'numeric' })}`
            }
          </span>

          <button 
            id="btn-calendar-next"
            onClick={handleNextDate}
            className="p-2 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer text-slate-600"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            id="btn-calendar-today"
            onClick={handleGoToday}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 rounded-xl transition-all ml-1 cursor-pointer"
          >
            Hôm nay
          </button>
        </div>

        {/* View mode switcher & Add Button */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center">
            <button
              id="btn-calendar-view-day"
              onClick={() => setViewMode('day')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'day' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Theo Ngày
            </button>
            <button
              id="btn-calendar-view-week"
              onClick={() => setViewMode('week')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'week' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Theo Tuần
            </button>
          </div>

          <button
            id="btn-calendar-add-event"
            onClick={() => {
              setNewDate(selectedDate);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Xếp lịch</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* MAIN CALENDAR DISPLAY */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            
            {/* Day View */}
            {viewMode === 'day' ? (
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 15 }, (_, i) => {
                  const hour = i + 8; // 8 AM to 10 PM
                  const hourStr = `${hour.toString().padStart(2, '0')}:00`;
                  const matchingEvents = itemsForSelected.filter(item => {
                    const startH = parseInt(item.startTime.split(':')[0]);
                    return startH === hour;
                  });

                  return (
                    <div key={hour} className="flex min-h-[70px] group transition-all">
                      {/* Hour label */}
                      <div className="w-20 px-4 py-3 text-right border-r border-slate-100 flex items-start justify-end text-xs font-mono font-bold text-slate-400">
                        {hourStr}
                      </div>

                      {/* Content slot */}
                      <div className="flex-1 p-2 bg-slate-50/20 group-hover:bg-slate-50/50 transition-all flex flex-col gap-2">
                        {matchingEvents.length > 0 ? (
                          matchingEvents.map(event => {
                            const colors = getJourneyColor(event.journeyId);
                            const hasConflict = overlapMap[event.id];

                            return (
                              <div
                                key={event.id}
                                className={`p-3 rounded-xl border flex items-center justify-between gap-3 shadow-2xs transition-all ${colors.bg}`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-bold text-slate-900">{event.title}</h4>
                                    {hasConflict && (
                                      <span className="flex items-center gap-1 text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-black uppercase tracking-wider animate-pulse">
                                        <AlertCircle className="w-3 h-3" />
                                        Trùng lịch
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-500 font-mono font-medium flex items-center gap-1.5">
                                    <Clock className="w-3 h-3" />
                                    <span>{event.startTime} - {event.endTime}</span>
                                    <span className="mx-1">•</span>
                                    <span className={`px-1.5 py-0.5 rounded font-sans font-bold text-[9px] ${colors.badge}`}>
                                      {getJourneyName(event.journeyId)}
                                    </span>
                                  </p>
                                </div>

                                <button
                                  onClick={() => handleDeleteEvent(event.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <button
                            onClick={() => {
                              setNewStartTime(`${hour.toString().padStart(2, '0')}:00`);
                              setNewEndTime(`${(hour + 1).toString().padStart(2, '0')}:00`);
                              setNewDate(selectedDate);
                              setShowAddModal(true);
                            }}
                            className="h-full w-full flex items-center justify-start text-xs text-slate-400 hover:text-indigo-600 transition-all italic border border-dashed border-transparent hover:border-indigo-100 hover:bg-indigo-50/20 rounded-lg p-2 text-left"
                          >
                            + Nhấp để phân bổ khung giờ {hourStr}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Week View */
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  {/* Grid header */}
                  <div className="grid grid-cols-8 border-b border-slate-100 bg-slate-50/50">
                    <div className="p-3 border-r border-slate-100"></div>
                    {getWeekDays().map(dayStr => {
                      const d = new Date(dayStr);
                      const isSelected = dayStr === selectedDate;
                      return (
                        <div key={dayStr} className={`p-3 text-center border-r border-slate-100 ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">
                            {d.toLocaleDateString('vi-VN', { weekday: 'short' })}
                          </p>
                          <p className={`text-sm font-mono font-black mt-0.5 ${isSelected ? 'text-indigo-600' : 'text-slate-800'}`}>
                            {d.getDate()}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Grid Content */}
                  <div className="divide-y divide-slate-100">
                    {Array.from({ length: 15 }, (_, i) => {
                      const hour = i + 8;
                      const hourStr = `${hour.toString().padStart(2, '0')}:00`;

                      return (
                        <div key={hour} className="grid grid-cols-8 min-h-[55px]">
                          {/* Hour tag */}
                          <div className="p-2 text-right border-r border-slate-100 text-[10px] font-mono font-bold text-slate-400 flex items-start justify-end">
                            {hourStr}
                          </div>

                          {/* 7 Days of week */}
                          {getWeekDays().map(dayStr => {
                            const dayEvents = (state.scheduleItems || []).filter(
                              event => event.date === dayStr && parseInt(event.startTime.split(':')[0]) === hour
                            );

                            return (
                              <div key={dayStr} className="p-1 border-r border-slate-100 bg-slate-50/10 hover:bg-slate-50/30 transition-all relative flex flex-col gap-1 min-h-[55px]">
                                {dayEvents.map(event => {
                                  const colors = getJourneyColor(event.journeyId);
                                  const hasConflict = overlapMap[event.id];

                                  const [sh, sm] = event.startTime.split(':').map(Number);
                                  const [eh, em] = event.endTime.split(':').map(Number);
                                  const duration = Math.max(30, (eh * 60 + em) - (sh * 60 + sm));
                                  return (
                                    <div
                                      key={event.id}
                                      style={{ height: `${Math.max(44, duration / 60 * 55 - 4)}px` }}
                                      className={`relative ${event.insideLockedBlock ? 'z-20 ring-2 ring-orange-300' : 'z-10'} p-1.5 rounded-lg border text-[10px] leading-tight ${event.locked ? 'border-slate-700 bg-slate-800 text-white shadow-md' : colors.bg} ${hasConflict && !event.locked && !event.insideLockedBlock ? 'border-rose-300 bg-rose-50' : ''} shadow-3xs group/item overflow-hidden`}
                                    >
                                      <div className={`font-bold line-clamp-2 ${event.locked ? 'text-white' : 'text-slate-800'}`}>{event.title}</div>
                                      <div className={`text-[8px] font-mono mt-0.5 ${event.locked ? 'text-slate-200' : 'text-slate-500'}`}>{event.startTime}–{event.endTime}</div>
                                      {event.locked && <div className="mt-1 flex items-center gap-1 text-[8px] font-black uppercase tracking-wide text-sky-200"><LockKeyhole className="h-2.5 w-2.5" /> Đã khóa</div>}
                                      {event.insideLockedBlock && <div className="mt-1 text-[8px] font-black uppercase tracking-wide text-orange-700">Việc phát sinh</div>}
                                      
                                      {!event.locked && <button
                                        onClick={() => handleDeleteEvent(event.id)}
                                        className="absolute top-1 right-1 p-0.5 bg-white rounded border border-slate-100 text-slate-400 hover:text-rose-600 opacity-0 group-hover/item:opacity-100 transition-all cursor-pointer"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>}
                                    </div>
                                  );
                                })}

                                {dayEvents.length === 0 && (
                                  <button
                                    onClick={() => {
                                      setNewStartTime(`${hour.toString().padStart(2, '0')}:00`);
                                      setNewEndTime(`${(hour + 1).toString().padStart(2, '0')}:00`);
                                      setNewDate(dayStr);
                                      setShowAddModal(true);
                                    }}
                                    className="absolute inset-0 opacity-0 hover:opacity-100 bg-indigo-50/20 text-indigo-600 flex items-center justify-center text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    + Xếp
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CALENDAR SIDEBAR: INSIGHTS & SUGGESTIONS */}
        <div className="space-y-6">
          
          {/* SUGGESTED AVAILABLE TIMES HELPER */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-indigo-600">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-800">Khung giờ trống lý tưởng</h3>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed">
              Dựa trên lịch đã có và nhịp làm việc thật của bạn, app chỉ đề xuất thời gian còn khả thi:
            </p>

            <div className={`rounded-xl border p-3 ${selectedDayPlan?.mode === 'office' ? 'border-sky-200 bg-sky-50 text-sky-800' : selectedDayPlan?.mode === 'rest' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
              <p className="text-[10px] font-black uppercase tracking-wider">Nhịp ngày đã lưu</p>
              <p className="mt-1 text-xs font-bold">{selectedDayPlan?.label || 'Chưa đặt nhịp ngày'}{selectedDayPlan?.blockedStart ? ` · Bận ${selectedDayPlan.blockedStart}–${selectedDayPlan.blockedEnd}` : ''}</p>
              {yogaDue && <p className="mt-1 text-[10px]">Có Yoga trong lịch routine hôm nay.</p>}
            </div>

            <div className="space-y-3 pt-1">
              {getSuggestions().map((sug, i) => (
                <div key={i} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50/70 px-2 py-0.5 rounded-lg border border-indigo-100">
                      {sug.slot}
                    </span>
                    {sug.slot !== "Bất kỳ lúc nào" && (
                      <button
                        onClick={() => {
                          const startH = sug.slot.split(' - ')[0];
                          const endH = sug.slot.split(' - ')[1];
                          setNewStartTime(startH);
                          setNewEndTime(endH);
                          setNewDate(selectedDate);
                          setShowAddModal(true);
                        }}
                        className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        Xếp lịch ngay
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 font-medium">
                    {sug.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* CALENDAR TUTORIAL */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/50 space-y-3">
            <h4 className="text-xs font-bold text-slate-700">Quy tắc Deep Work 90 Ngày:</h4>
            <ul className="text-xs text-slate-500 space-y-2 list-disc pl-4 leading-relaxed">
              <li>Ngày ở nhà: tối đa <strong className="text-slate-800">1 block chính + 1 block hỗ trợ</strong>. Ngày công ty: chỉ 1 block ngắn trước giờ đi.</li>
              <li>Thứ bảy và Chủ nhật được bảo vệ là thời gian nghỉ; app không tự ép thêm công việc.</li>
              <li>Hãy ghi nhận trực tiếp kết quả thông qua Voice Check-in hoặc Text Input để hệ thống tự động hoàn thành các cột mốc tương ứng.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ADD EVENT MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xl max-w-md w-full p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-indigo-600" />
                  <span>Xếp lịch làm việc</span>
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer p-1.5 hover:bg-slate-100 rounded-lg"
                >
                  Đóng
                </button>
              </div>

              <form onSubmit={handleAddEvent} className="space-y-4">
                {addError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700">{addError}</div>}
                {(state.scheduleItems || []).some(item => item.locked && item.date === newDate && item.startTime < newEndTime && newStartTime < item.endTime) && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
                    <input type="checkbox" checked={allowLockedOverride} onChange={event => { setAllowLockedOverride(event.target.checked); setAddError(null); }} className="mt-0.5 h-4 w-4 accent-orange-600" />
                    <span><strong className="block">Đây là việc phát sinh trong giờ làm</strong><span className="mt-1 block text-[10px] text-orange-700">Cho phép tối đa 2 việc ngoại lệ trong khung khóa. Việc này sẽ được đánh dấu riêng.</span></span>
                  </label>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Tiêu đề công việc</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Gọi 15 khách hàng outreached"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Liên kết Hành trình Mục tiêu</label>
                  <select
                    value={newJourneyId}
                    onChange={e => setNewJourneyId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 bg-slate-50/50"
                  >
                    <option value="">-- Việc chung / Cá nhân --</option>
                    {activeJourneys.map(j => (
                      <option key={j.id} value={j.id}>{j.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Giờ bắt đầu</label>
                    <input
                      type="time"
                      required
                      value={newStartTime}
                      onChange={e => setNewStartTime(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Giờ kết thúc</label>
                    <input
                      type="time"
                      required
                      value={newEndTime}
                      onChange={e => setNewEndTime(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 bg-slate-50/50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Ngày thực hiện</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 bg-slate-50/50"
                  />
                </div>

                <div className="pt-3 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="text-xs font-bold text-slate-500 hover:bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 transition-all cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Xác nhận
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
