import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  Check,
  Clock,
  Maximize2,
  Play,
  Pause,
  Minimize2,
  Sun,
  LifeBuoy,
  ArrowDown,
  ArrowUp,
  Trash2,
  Volume2,
  VolumeX,
  Target,
  Activity,
  Plus,
  X,
  Inbox,
  Zap,
  Loader2,
  LayoutGrid,
  Archive,
  Dices,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// --- Types ---
type EffortSize = "quick" | "standard" | "deep";
type TaskStatus = "focus" | "primary" | "upcoming" | "dump" | "archive";
type TaskPriority = "primary" | "secondary" | "normal";
type TaskNature = "one-time" | "recurring";
type RecurringFrequency = "daily" | "weekly" | "monthly";

interface RecurringRules {
  frequency: RecurringFrequency;
  days?: number[]; // [0-6] for weekly, dates 1-31 for monthly
}

// Research-Driven Additions
type SpoonType = "focus" | "social" | "sensory" | "executive";
interface INCUP {
  interest: number; // 0-5
  novelty: number; // 0-5
  challenge: number; // 0-5
  urgency: number; // 0-5
  passion: number; // 0-5
}

interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

interface Task {
  id: string;
  text: string;
  note?: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  status: TaskStatus;
  priority: TaskPriority;
  nature: TaskNature;
  recurringRules?: RecurringRules;
  deadline?: number; // timestamp for Primary tasks
  focusDate?: number; // timestamp to track when it moved to Focus
  effort?: EffortSize | null;
  subtasks: Subtask[];
  dueDate?: number | null;
  // NIEP Additions
  spoons: Record<SpoonType, number>;
  incup: INCUP;
  evidenceRef?: string; // OCR page 5: Evidence Vault
  lastInteractedAt: number;
  dependencyIds: string[];
}

interface SpoonState {
  current: Record<SpoonType, number>;
  max: Record<SpoonType, number>;
}

const DEFAULT_SPOONS: Record<SpoonType, number> = {
  focus: 10,
  social: 10,
  sensory: 10,
  executive: 10,
};

const INCUP_WEIGHTS = {
  interest: 2,
  novelty: 1.5,
  challenge: 1.2,
  urgency: 2.5,
  passion: 2,
};

const TAILWIND_COLORS = [
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
  "bg-rose-100 text-rose-700 border-rose-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-purple-100 text-purple-700 border-purple-200",
  "bg-sky-100 text-sky-700 border-sky-200",
];

const EFFORT_MAP: Record<EffortSize, number> = {
  quick: 15,
  standard: 45,
  deep: 90,
};
const BANKRUPTCY_HR = 48;

// --- Custom Hooks ---
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return initialValue;
      const parsed = JSON.parse(item);
      return parsed === null ? initialValue : parsed;
    } catch (error) {
      return initialValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(storedValue));
  }, [key, storedValue]);

  return [storedValue, setStoredValue] as const;
}

// --- Components ---

function TimeSweep({
  totalSeconds,
  remainingSeconds,
}: {
  totalSeconds: number;
  remainingSeconds: number;
}) {
  const isOvertime = remainingSeconds < 0;
  const absRemaining = Math.abs(remainingSeconds);
  const progress = isOvertime
    ? 1
    : Math.max(0, remainingSeconds / totalSeconds);

  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div className="relative flex items-center justify-center w-64 h-64 mb-8">
      <svg className="absolute inset-0 w-full h-full transform -rotate-90">
        <circle
          cx="128"
          cy="128"
          r={radius}
          className={isOvertime ? "stroke-orange-100" : "stroke-slate-100"}
          strokeWidth="12"
          fill="transparent"
        />
        <circle
          cx="128"
          cy="128"
          r={radius}
          className={isOvertime ? "stroke-orange-400" : "stroke-teal-500"}
          strokeWidth="12"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div className="z-10 flex flex-col items-center">
        {isOvertime ? (
          <>
            <span className="text-orange-600 font-bold text-sm mb-1">
              Flow Overtime
            </span>
            <span className="text-4xl font-bold text-slate-800">
              {Math.floor(absRemaining / 60)}:
              {(absRemaining % 60).toString().padStart(2, "0")}
            </span>
          </>
        ) : (
          <span className="text-4xl font-bold text-slate-800">
            {Math.floor(absRemaining / 60)}:
            {(absRemaining % 60).toString().padStart(2, "0")}
          </span>
        )}
      </div>
    </div>
  );
}

// 2. Focused Deep Work Mode
function TaskFocusOverlay({
  task,
  onClose,
  onComplete,
}: {
  task: Task;
  onClose: () => void;
  onComplete: () => void;
}) {
  const defaultSeconds = task.effort ? EFFORT_MAP[task.effort] * 60 : 25 * 60;
  const [timeLeft, setTimeLeft] = useState(defaultSeconds);
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] glass-heavy bg-white/90 backdrop-blur-xl flex flex-col items-center justify-center p-8"
    >
      <button
        onClick={onClose}
        className="absolute top-12 right-12 text-slate-400 hover:text-slate-800 transition-colors"
      >
        <X className="w-8 h-8" />
      </button>

      <div className="max-w-2xl w-full text-center">
        <span className="text-[10px] font-black tracking-[0.3em] uppercase text-teal-600 mb-4 block">
          Focus Protocol Initialized
        </span>
        <h2 className="text-5xl font-display italic text-slate-900 mb-12 leading-tight">
          {task.text}
        </h2>

        <div className="relative inline-block mb-16">
          <svg className="w-80 h-80 transform -rotate-90">
            <circle
              cx="160"
              cy="160"
              r="150"
              stroke="currentColor"
              strokeWidth="4"
              fill="transparent"
              className="text-slate-100"
            />
            <motion.circle
              cx="160"
              cy="160"
              r="150"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-teal-500"
              strokeDasharray="942"
              animate={{
                strokeDashoffset: 942 - (timeLeft / defaultSeconds) * 942,
              }}
              transition={{ duration: 1, ease: "linear" }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-7xl font-black tracking-tighter text-slate-900 tabular-nums">
              {Math.floor(timeLeft / 60)}:
              {(timeLeft % 60).toString().padStart(2, "0")}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
              {task.effort || "Standard"} Session
            </span>
          </div>
        </div>

        <div className="flex gap-6 justify-center">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="w-20 h-20 rounded-3xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-all shadow-xl hover:scale-105 active:scale-95"
          >
            {isRunning ? (
              <Pause className="w-8 h-8" />
            ) : (
              <Play className="w-8 h-8 ml-1" />
            )}
          </button>
          <button
            onClick={onComplete}
            className="px-10 h-20 bg-teal-600 text-white font-black text-xs uppercase tracking-widest rounded-3xl flex items-center gap-4 hover:bg-teal-700 transition-all shadow-2xl shadow-teal-600/30 hover:scale-105 active:scale-95"
          >
            <Check className="w-6 h-6" strokeWidth={3} /> Complete Deep Work
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// 3. Task Item Component
function TaskCard({
  task,
  allTasks,
  onComplete,
  onDelete,
  onStatusChange,
  onEnterFocus,
  onAddSubtask,
  onToggleSubtask,
  onSetEnergy,
  onSetPriority,
  onUpdateNote,
  onToggleDependency,
  onPromote,
  onGrabEarly,
  onUpdateRecurring,
  onSetDeadline,
  activationWeight,
}: {
  task: Task;
  allTasks: Task[];
  onComplete: () => void;
  onDelete: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onEnterFocus: () => void;
  onAddSubtask: (text: string) => void;
  onToggleSubtask: (subId: string) => void;
  onSetEnergy: (effort: EffortSize | null) => void;
  onSetPriority: (priority: TaskPriority) => void;
  onUpdateNote: (note: string) => void;
  onToggleDependency: (depId: string) => void;
  onPromote: () => void;
  onGrabEarly: () => void;
  onUpdateRecurring: (frequency: RecurringFrequency, days: number[]) => void;
  onSetDeadline: (deadline: number | null) => void;
  activationWeight: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [subInput, setSubInput] = useState("");
  const [showClosure, setShowClosure] = useState(false);
  const [closureNote, setClosureNote] = useState("");
  const [showDependencySelector, setShowDependencySelector] = useState(false);

  const submitSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (subInput.trim()) {
      onAddSubtask(subInput.trim());
      setSubInput("");
    }
  };

  const priorityStyles = {
    primary: "text-rose-600 bg-rose-50 border-rose-200",
    secondary: "text-amber-600 bg-amber-50 border-amber-200",
    normal: "text-slate-500 bg-slate-50 border-slate-100",
  };

  const hasIncompleteSubtasks = (task.subtasks || []).some((s) => !s.completed);

  // Dependency Logic
  const blockingTasks = allTasks.filter(
    (t) => task.dependencyIds?.includes(t.id) && !t.completed,
  );
  const isBlocked = blockingTasks.length > 0;

  const cannotComplete = hasIncompleteSubtasks || isBlocked;

  const todayStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
  ).getTime();
  const isMissedFocus =
    task.status === "focus" &&
    !task.completed &&
    task.focusDate &&
    task.focusDate < todayStart;

  const handleComplete = () => {
    if (task.completed) {
      onComplete(); // Undo toggle
    } else {
      setShowClosure(true); // Page 5: Closing Ritual
    }
  };

  const finishClosure = () => {
    onUpdateNote(
      task.note
        ? `${task.note}\n\n[EVIDENCE]: ${closureNote}`
        : `[EVIDENCE]: ${closureNote}`,
    );
    onComplete();
    setShowClosure(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      whileHover={{ y: -2 }}
      className={`relative group/card bg-white rounded-[2.5rem] p-5 md:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-slate-100/50 transition-all duration-500 overflow-hidden ${isBlocked && !task.completed ? "opacity-90" : ""}`}
    >
      {/* Subtle Gradient Accent */}
      <div className={`absolute top-0 inset-x-0 h-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity ${task.priority === "primary" ? "bg-gradient-to-r from-rose-400 to-rose-600" : "bg-gradient-to-r from-teal-400 to-teal-600"}`} />

      <div className="flex gap-6 items-start relative z-10">
        <button
          disabled={cannotComplete}
          onClick={handleComplete}
          aria-label="Complete task"
          className={`mt-1 w-10 h-10 rounded-[1.25rem] border-2 flex items-center justify-center transition-all shrink-0 ${cannotComplete ? "border-slate-50 bg-slate-50/30 cursor-not-allowed text-slate-200" : "border-slate-200 bg-white hover:border-teal-500 hover:bg-teal-50 group-hover/card:scale-110 active:scale-90"}`}
        >
          {task.completed ? (
            <Check className="w-6 h-6 text-teal-600" strokeWidth={3} />
          ) : isBlocked ? (
            <Clock className="w-4 h-4 text-slate-300" />
          ) : null}
        </button>

        <div
          className="flex-1 flex flex-col cursor-pointer mt-1"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3 flex-wrap min-h-[32px]">
            <span
              className={`text-xl md:text-2xl font-bold tracking-tight leading-tight ${task.completed ? "text-slate-300 line-through" : "text-slate-900"} group-hover/card:text-slate-900 transition-colors`}
            >
              {task.text}
            </span>
            {isBlocked && !task.completed && (
              <span className="text-[9px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full bg-slate-900 text-white shadow-xl shrink-0 flex items-center gap-1.5">
                <Pause className="w-2.5 h-2.5" /> Blocked
              </span>
            )}
            {task.priority === "primary" && (
              <span className="text-[9px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/20 shrink-0">
                Primary
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            {task.effort && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 group-hover/card:bg-white transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {task.effort} • {EFFORT_MAP[task.effort]}m
                </span>
              </div>
            )}

            {task.nature === "recurring" && task.recurringRules && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50/50 border border-indigo-100/50">
                <Clock className="w-3 h-3 text-indigo-400" />
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                  {task.recurringRules.frequency}
                </span>
              </div>
            )}

            {task.subtasks && task.subtasks.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(task.subtasks.filter((s) => s.completed).length / task.subtasks.length) * 100}%`,
                    }}
                    className="h-full bg-teal-500"
                  />
                </div>
                <span className="text-[10px] font-black text-slate-400 tabular-nums uppercase tracking-widest">
                  {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} Step{task.subtasks.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-center">
          {task.status === "dump" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPromote();
              }}
              className="w-10 h-10 flex items-center justify-center text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"
              title="Promote to Primary"
            >
              <Zap className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-10 h-10 flex items-center justify-center text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
            title="Delete task"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-6 pt-5 border-t border-slate-100 flex flex-col gap-5"
          >
            <button
              disabled={isBlocked}
              onClick={onEnterFocus}
              className={`w-full py-4 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${isBlocked ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-teal-50 text-teal-700 hover:bg-teal-100"}`}
            >
              <Maximize2 className="w-5 h-5" />{" "}
              {isBlocked ? "Task is currently Blocked" : "Start Focus Session"}
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="flex flex-col gap-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  Subtasks
                </span>
                <div className="flex flex-col gap-2">
                  {task.subtasks?.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-start gap-3 group/sub"
                    >
                      <button
                        onClick={() => onToggleSubtask(sub.id)}
                        className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${sub.completed ? "border-teal-500 bg-teal-500 shadow-lg shadow-teal-500/20" : "border-slate-300 hover:border-slate-400 bg-white"}`}
                      >
                        {sub.completed && (
                          <Check
                            className="w-3 h-3 text-white"
                            strokeWidth={3}
                          />
                        )}
                      </button>
                      <span
                        className={`text-sm font-semibold transition-colors ${sub.completed ? "text-slate-400 line-through" : "text-slate-700"}`}
                      >
                        {sub.text}
                      </span>
                    </div>
                  ))}
                </div>
                <form onSubmit={submitSubtask} className="flex mt-2">
                  <input
                    type="text"
                    placeholder="Add a micro-step..."
                    value={subInput}
                    onChange={(e) => setSubInput(e.target.value)}
                    className="bg-transparent border-b border-slate-200 pb-2 text-sm text-slate-700 focus:outline-none focus:border-teal-500 w-full placeholder:text-slate-400 font-bold"
                  />
                </form>
              </div>

              <div className="flex flex-col gap-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  Prerequisites
                </span>
                <div className="flex flex-col gap-2">
                  {task.dependencyIds?.map((id) => {
                    const dep = allTasks.find((t) => t.id === id);
                    if (!dep) return null;
                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100"
                      >
                        <span
                          className={`text-xs font-bold line-clamp-1 ${dep.completed ? "text-slate-400 line-through" : "text-slate-700"}`}
                        >
                          {dep.text}
                        </span>
                        <button
                          onClick={() => onToggleDependency(id)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={() =>
                      setShowDependencySelector(!showDependencySelector)
                    }
                    className="py-2 text-[10px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-700 transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" /> Add Linkage
                  </button>
                  {showDependencySelector && (
                    <div className="flex flex-col gap-1 p-2 bg-slate-50 rounded-xl border border-slate-100 max-h-[150px] overflow-y-auto">
                      {allTasks
                        .filter(
                          (t) =>
                            t.id !== task.id &&
                            !task.dependencyIds?.includes(t.id) &&
                            !t.completed,
                        )
                        .map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              onToggleDependency(t.id);
                              setShowDependencySelector(false);
                            }}
                            className="text-left text-[11px] font-bold py-1.5 px-2 hover:bg-white rounded-md transition-colors text-slate-600 line-clamp-1 border border-transparent hover:border-slate-200"
                          >
                            {t.text}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  Energy
                </span>
                <div className="flex flex-col gap-2">
                  {(["quick", "standard", "deep"] as EffortSize[]).map(
                    (size) => (
                      <button
                        key={size}
                        onClick={() =>
                          onSetEnergy(task.effort === size ? null : size)
                        }
                        className={`py-3 px-4 font-bold text-xs uppercase tracking-widest rounded-xl border text-left transition-all ${task.effort === size ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}
                      >
                        {size} ({EFFORT_MAP[size]}m)
                      </button>
                    ),
                  )}
                </div>
              </div>              <div className="flex flex-col gap-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  Schedule Nature
                </span>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      {(["daily", "weekly", "monthly"] as RecurringFrequency[]).map(
                        (freq) => (
                          <button
                            key={freq}
                            onClick={() =>
                              onUpdateRecurring(freq, task.recurringRules?.days || [])
                            }
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all ${task.nature === "recurring" && task.recurringRules?.frequency === freq ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}
                          >
                            {freq}
                          </button>
                        ),
                      )}
                      {task.nature === "recurring" && (
                        <button
                          onClick={() => {
                            setTasks((prev) =>
                              prev.map((t) =>
                                t.id === task.id
                                  ? {
                                      ...t,
                                      nature: "one-time",
                                      recurringRules: undefined,
                                    }
                                  : t,
                              ),
                            );
                          }}
                          className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all"
                        >
                          X
                        </button>
                      )}
                    </div>

                    {task.nature === "recurring" &&
                      task.recurringRules?.frequency === "weekly" && (
                        <div className="flex justify-between gap-1 mt-1">
                          {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                const currentDays = task.recurringRules?.days || [];
                                const newDays = currentDays.includes(i)
                                  ? currentDays.filter((d) => d !== i)
                                  : [...currentDays, i];
                                onUpdateRecurring("weekly", newDays);
                              }}
                              className={`w-7 h-7 rounded-lg text-[10px] font-black flex items-center justify-center transition-all ${task.recurringRules?.days?.includes(i) ? "bg-teal-500 text-white shadow-lg shadow-teal-500/20" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      )}

                    {task.nature === "recurring" &&
                      task.recurringRules?.frequency === "monthly" && (
                        <div className="grid grid-cols-7 gap-1 mt-1 p-2 bg-slate-50 rounded-xl">
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(
                            (date) => (
                              <button
                                key={date}
                                onClick={() => {
                                  const currentDays =
                                    task.recurringRules?.days || [];
                                  const newDays = currentDays.includes(date)
                                    ? currentDays.filter((d) => d !== date)
                                    : [...currentDays, date];
                                  onUpdateRecurring("monthly", newDays);
                                }}
                                className={`w-6 h-6 rounded-md text-[8px] font-black flex items-center justify-center transition-all ${task.recurringRules?.days?.includes(date) ? "bg-teal-500 text-white" : "bg-white text-slate-400 border border-slate-100"}`}
                              >
                                {date}
                              </button>
                            ),
                          )}
                        </div>
                      )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                      Target Deadline
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={
                          task.deadline
                            ? new Date(task.deadline).toISOString().split("T")[0]
                            : ""
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          onSetDeadline(val ? new Date(val).getTime() : null);
                        }}
                        className="flex-1 px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 ring-indigo-500/20"
                      />
                      {task.deadline && (
                        <button
                          onClick={() => onSetDeadline(null)}
                          className="px-3 py-2 bg-rose-50 text-rose-500 border border-rose-100 rounded-xl text-[10px] font-black uppercase tracking-widest"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                Perspective
              </span>
              <textarea
                value={task.note || ""}
                onChange={(e) => onUpdateNote(e.target.value)}
                placeholder="Capture nuance or context..."
                className="w-full bg-slate-50/50 p-4 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none border border-slate-200/50 placeholder:text-slate-300 min-h-[100px] resize-none"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EVIDENCE VAULT: Closing Ritual Overlay (Page 5) */}
      <AnimatePresence>
        {showClosure && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-white backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="mb-6">
              <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600 mb-4 mx-auto">
                <Sparkles className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-black italic tracking-tighter">
                Closing Ritual
              </h4>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                Prove it is done to silence the mind
              </p>
            </div>
            <textarea
              autoFocus
              placeholder="Write one sentence of proof... (e.g. 'Sent the email to HR')"
              className="w-full bg-slate-50 p-4 rounded-2xl text-sm font-semibold focus:outline-none border border-slate-200 mb-6 min-h-[80px]"
              value={closureNote}
              onChange={(e) => setClosureNote(e.target.value)}
            />
            <div className="flex gap-4 w-full">
              <button
                onClick={() => setShowClosure(false)}
                className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={finishClosure}
                className="flex-[2] py-4 bg-teal-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-teal-600/20"
              >
                Seal Evidence
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// 4. TRIAGE QUIZ COMPONENT (Page 2)
function TriageQuiz({
  tasks,
  onComplete,
}: {
  tasks: Task[];
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const current = tasks[index];

  if (index >= tasks.length) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-6"
      >
        <div className="w-20 h-20 bg-teal-500 rounded-full flex items-center justify-center text-white shadow-2xl">
          <Check className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-black italic">Triage Complete</h2>
        <button
          onClick={onComplete}
          className="px-12 py-4 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest"
        >
          Return to Command
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-xl w-full text-center">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 block">
        Triage Protocol active: {index + 1}/{tasks.length}
      </span>
      <h2 className="text-4xl font-display font-black italic text-slate-900 mb-12 leading-tight">
        "{current.text}"
      </h2>

      <div className="grid grid-cols-1 gap-4">
        <button
          onClick={() => setIndex((i) => i + 1)}
          className="group p-8 bg-white border-2 border-slate-100 rounded-[2.5rem] hover:border-teal-500 hover:bg-teal-50 transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h5 className="font-black text-slate-900">Execute Today</h5>
              <p className="text-xs font-bold text-slate-400 uppercase mt-1">
                Add to surgical focus
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setIndex((i) => i + 1)}
          className="group p-8 bg-white border-2 border-slate-100 rounded-[2.5rem] hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h5 className="font-black text-slate-900">Leave in Dump</h5>
              <p className="text-xs font-bold text-slate-400 uppercase mt-1">
                Requires more gestation
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

// --- Main Application ---
export default function App() {
  const [tasks, setTasks] = useLocalStorage<Task[]>("ff_v3_tasks", []);

  const [activeView, setActiveView] = useState<
    "focus" | "primary" | "upcoming" | "dump" | "archive"
  >("focus");
  const [captureInput, setCaptureInput] = useState("");
  const [captureIsPrimary, setCaptureIsPrimary] = useState(false);
  const [captureDeadline, setCaptureDeadline] = useState("");
  const [captureNature, setCaptureNature] = useState<TaskNature>("one-time");
  const [captureFreq, setCaptureFreq] = useState<RecurringFrequency>("daily");
  const [captureDays, setCaptureDays] = useState<number[]>([]);
  const [captureToFocus, setCaptureToFocus] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isTriageMode, setIsTriageMode] = useState(false);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [showMissedPopup, setShowMissedPopup] = useState(false);

  // --- FOCUSFLOW ENGINE: State Transitions ---
  useEffect(() => {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();

    setTasks((prev) => {
      let changed = false;
      const updated = prev.map((task) => {
        let newStatus = task.status;
        let newFocusDate = task.focusDate;

        // 1. Missed Focus Detection (Yesterday's Focus not completed)
        if (
          task.status === "focus" &&
          !task.completed &&
          task.focusDate &&
          task.focusDate < todayStart
        ) {
          // Keep in Focus but we will trigger the popup
          // Or we can flag it. For now, let's just use focusDate logic to show popup.
        }

        // 2. Primary -> Focus (If deadline is today or before)
        if (
          task.status === "primary" &&
          task.deadline &&
          task.deadline <= todayStart + 86400000
        ) {
          newStatus = "focus";
          newFocusDate = todayStart;
          changed = true;
        }

        // 3. Upcoming (Recurring) -> Focus (If scheduled day is today)
        if (
          task.status === "upcoming" &&
          task.nature === "recurring" &&
          task.recurringRules
        ) {
          const rules = task.recurringRules;
          let shouldTrigger = false;

          if (rules.frequency === "daily") shouldTrigger = true;
          if (
            rules.frequency === "weekly" &&
            rules.days?.includes(now.getDay())
          )
            shouldTrigger = true;
          if (
            rules.frequency === "monthly" &&
            rules.days?.includes(now.getDate())
          )
            shouldTrigger = true;

          if (shouldTrigger && task.focusDate !== todayStart) {
            newStatus = "focus";
            newFocusDate = todayStart;
            changed = true;
          }
        }

        if (newStatus !== task.status || newFocusDate !== task.focusDate) {
          return { ...task, status: newStatus, focusDate: newFocusDate };
        }
        return task;
      });

      return changed ? updated : prev;
    });

    // Determine if popup should show
    const yesterdayFocusMissed = tasks.some(
      (t) =>
        t.status === "focus" &&
        !t.completed &&
        t.focusDate &&
        t.focusDate < todayStart,
    );
    if (yesterdayFocusMissed) setShowMissedPopup(true);
  }, []); // Run once on mount

  // States for Smart Capture / Voice
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);

  // INCUP Calculation: Heuristic-based novelty and urgency calculation
  const getActivationWeight = (task: Task) => {
    const ageDays =
      (Date.now() - (task.createdAt || Date.now())) / (1000 * 60 * 60 * 24);
    // Novelty boost for new tasks, then decay, then novelty boost for "forgotten" tasks
    const noveltyFactor = ageDays < 1 ? 5 : ageDays > 7 ? 4 : 1;

    // Safety check for legacy tasks without incup data
    const incup = task.incup || {
      interest: 3,
      novelty: 3,
      challenge: 2,
      urgency: 1,
      passion: 2,
    };

    return (
      (incup.interest * INCUP_WEIGHTS.interest +
        noveltyFactor * INCUP_WEIGHTS.novelty +
        incup.urgency * INCUP_WEIGHTS.urgency +
        incup.passion * INCUP_WEIGHTS.passion) /
      10
    );
  };

  const handleChaosStart = () => {
    const startable = tasks.filter((t) => !t.completed && t.status === "focus");
    if (startable.length > 0) {
      const random = startable[Math.floor(Math.random() * startable.length)];
      setFocusTask(random);
    }
  };

  const handleSmartCapture = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!captureInput.trim()) return;

    setIsProcessing(true);
    const rawLines = captureInput
      .split(/\r?\n|,/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const deadlineTimestamp = captureDeadline
      ? new Date(captureDeadline).getTime()
      : (captureIsPrimary || captureToFocus)
        ? Date.now() + 86400000
        : undefined;

    const newTasks: Task[] = rawLines.map((text) => ({
      id: crypto.randomUUID(),
      text: text.charAt(0).toUpperCase() + text.slice(1),
      completed: false,
      createdAt: Date.now(),
      lastInteractedAt: Date.now(),
      status: captureToFocus
        ? "focus"
        : captureIsPrimary
          ? "primary"
          : captureNature === "recurring"
            ? "upcoming"
            : "dump",
      focusDate: captureToFocus ? Date.now() : undefined,
      priority: (captureIsPrimary || captureToFocus) ? "primary" : "normal",
      nature: captureNature,
      recurringRules:
        captureNature === "recurring"
          ? { frequency: captureFreq, days: captureDays }
          : undefined,
      deadline: deadlineTimestamp,
      subtasks: [],
      note: "",
      effort: "standard",
      spoons: { focus: 1, social: 1, sensory: 1, executive: 1 },
      incup: { interest: 3, novelty: 5, challenge: 2, urgency: 1, passion: 2 },
      dependencyIds: [],
    }));

    setTimeout(() => {
      setTasks((prev) => [...newTasks, ...prev]);
      setCaptureInput("");
      setCaptureIsPrimary(false);
      setCaptureToFocus(false);
      setCaptureDeadline("");
      setCaptureNature("one-time");
      setCaptureFreq("daily");
      setCaptureDays([]);
      setIsCapturing(false);
      setIsProcessing(false);
      if (newTasks.length > 3) setIsTriageMode(true);
    }, 400);
  };

  const handleToggleMic = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setCaptureInput((prev) =>
        (prev ? prev + " " + transcript : transcript).trim(),
      );
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  // View Filtering
  const filteredTasks = tasks.filter((t) => {
    if (activeView === "archive") return t.completed;
    if (t.completed) return false;

    if (activeView === "focus") return t.status === "focus";
    if (activeView === "primary") return t.status === "primary";
    if (activeView === "upcoming") return t.status === "upcoming";
    if (activeView === "dump") return t.status === "dump";
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50/20 text-slate-900 selection:bg-teal-100 selection:text-teal-900 overflow-x-hidden">
      {/* Main Content Area */}
      <main className="pt-16 md:pt-24 pb-48 px-6 md:px-12 max-w-5xl mx-auto w-full">
        <div className="mb-10">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${activeView === 'focus' ? 'bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.5)] animate-pulse' : 'bg-slate-300'}`} />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
              System \\ {activeView}
            </span>
          </div>
        </div>

        {/* Task List */}
        <div className="flex flex-col gap-10">
          <AnimatePresence mode="popLayout">
            {filteredTasks
              .sort((a, b) => getActivationWeight(b) - getActivationWeight(a))
              .map((task, idx) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <TaskCard
                    task={task}
                    allTasks={tasks}
                    onSetDeadline={(d) => {
                      setTasks((prev) =>
                        prev.map((t) =>
                          t.id === task.id ? { ...t, deadline: d } : t,
                        ),
                      );
                    }}
                    onComplete={() => {
                      const isCompleting = !task.completed;
                      setTasks((prev) =>
                        prev.map((t) =>
                          t.id === task.id
                            ? {
                                ...t,
                                completed: isCompleting,
                                completedAt: isCompleting
                                  ? Date.now()
                                  : undefined,
                              }
                            : t,
                        ),
                      );
                    }}
                    onDelete={() =>
                      setTasks((prev) => prev.filter((t) => t.id !== task.id))
                    }
                    onStatusChange={(status) =>
                      setTasks((prev) =>
                        prev.map((t) =>
                          t.id === task.id ? { ...t, status } : t,
                        ),
                      )
                    }
                    onEnterFocus={() => setFocusTask(task)}
                    onAddSubtask={(text) => {
                      const newSub = {
                        id: crypto.randomUUID(),
                        text,
                        completed: false,
                      };
                      setTasks((prev) =>
                        prev.map((t) =>
                          t.id === task.id
                            ? {
                                ...t,
                                subtasks: [...(t.subtasks || []), newSub],
                              }
                            : t,
                        ),
                      );
                    }}
                    onToggleSubtask={(subId) => {
                      setTasks((prev) =>
                        prev.map((t) =>
                          t.id === task.id
                            ? {
                                ...t,
                                subtasks: t.subtasks?.map((s) =>
                                  s.id === subId
                                    ? { ...s, completed: !s.completed }
                                    : s,
                                ),
                              }
                            : t,
                        ),
                      );
                    }}
                    onSetEnergy={(eff) =>
                      setTasks((prev) =>
                        prev.map((t) =>
                          t.id === task.id ? { ...t, effort: eff } : t,
                        ),
                      )
                    }
                    onSetPriority={(p) =>
                      setTasks((prev) =>
                        prev.map((t) =>
                          t.id === task.id ? { ...t, priority: p } : t,
                        ),
                      )
                    }
                    onUpdateNote={(note) =>
                      setTasks((prev) =>
                        prev.map((t) =>
                          t.id === task.id ? { ...t, note } : t,
                        ),
                      )
                    }
                    onToggleDependency={(depId) => {
                      setTasks((prev) =>
                        prev.map((t) =>
                          t.id === task.id
                            ? {
                                ...t,
                                dependencyIds: (t.dependencyIds || []).includes(
                                  depId,
                                )
                                  ? t.dependencyIds.filter((id) => id !== depId)
                                  : [...(t.dependencyIds || []), depId],
                              }
                            : t,
                        ),
                      );
                    }}
                    onPromote={() => {
                      setTasks((prev) =>
                        prev.map((t) =>
                          t.id === task.id
                            ? {
                                ...t,
                                status: "primary",
                                deadline: Date.now() + 86400000 * 2,
                              }
                            : t,
                        ),
                      );
                    }}
                    onGrabEarly={() => {
                      setTasks((prev) =>
                        prev.map((t) =>
                          t.id === task.id
                            ? { ...t, status: "focus", focusDate: Date.now() }
                            : t,
                        ),
                      );
                    }}
                    onUpdateRecurring={(frequency, days) => {
                      setTasks((prev) =>
                        prev.map((t) =>
                          t.id === task.id
                            ? {
                                ...t,
                                nature: "recurring",
                                recurringRules: { frequency, days },
                              }
                            : t,
                        ),
                      );
                    }}
                  />
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      </main>

      {/* NAVIGATION DOCK: Orbital Navigation (Innovative Design) */}
      <nav className="fixed bottom-6 md:bottom-12 inset-x-0 z-50 flex justify-center px-4">
        <motion.div
          layout
          className="glass-heavy p-1.5 md:p-2.5 rounded-[2.5rem] md:rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.1)] border-white/60 flex items-center gap-1 md:gap-2 max-w-full"
        >
          {[
            { id: "focus", icon: Target, label: "Focus" },
            { id: "primary", icon: Zap, label: "Primary" },
            { id: "upcoming", icon: Clock, label: "Upcoming" },
            { id: "dump", icon: Inbox, label: "Dump" },
            { id: "archive", icon: Archive, label: "Done" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as any)}
              className={`relative px-4 py-3 md:px-8 md:py-5 rounded-[2rem] md:rounded-[2.5rem] flex items-center gap-2 md:gap-3 transition-all ${activeView === item.id ? "bg-slate-900 text-white shadow-xl" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
            >
              <item.icon className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">
                {item.label}
              </span>
              {activeView === item.id && (
                <motion.div
                  layoutId="dock-indicator"
                  className="absolute inset-0 bg-slate-900 rounded-[2rem] md:rounded-[2.5rem] -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          ))}
          <div className="w-px h-6 md:h-10 bg-slate-200 mx-1 md:mx-2" />
          <button
            onClick={() => setIsCapturing(true)}
            className="w-12 h-12 md:w-20 md:h-20 bg-teal-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-teal-500/30 hover:scale-105 active:scale-95 transition-all group shrink-0"
          >
            <Plus className="w-6 h-6 md:w-8 md:h-8 group-hover:rotate-90 transition-transform" />
          </button>
        </motion.div>
      </nav>

      {/* Smart Capture Overlay */}
      <AnimatePresence>
        {isCapturing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-12 backdrop-blur-3xl bg-white/40"
            onClick={() => !isProcessing && setIsCapturing(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-4xl glass p-4 rounded-[4rem] shadow-[0_80px_150px_rgba(0,0,0,0.15)] border-white/80"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSmartCapture} className="relative">
                <textarea
                  autoFocus
                  rows={2}
                  value={captureInput}
                  onChange={(e) => setCaptureInput(e.target.value)}
                  placeholder="What must be done?"
                  className="w-full bg-transparent p-6 md:p-12 text-2xl md:text-4xl font-black tracking-tighter text-slate-900 placeholder:text-slate-200 focus:outline-none resize-none leading-none"
                />

                <div className="px-6 md:px-12 pb-8 flex flex-col gap-8">
                  <div className="flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div
                        onClick={() => setCaptureIsPrimary(!captureIsPrimary)}
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${captureIsPrimary ? "bg-rose-600 border-rose-600 shadow-lg shadow-rose-600/20" : "border-slate-200 group-hover:border-slate-300"}`}
                      >
                        {captureIsPrimary && (
                          <Check className="w-4 h-4 text-white" strokeWidth={4} />
                        )}
                      </div>
                      <span className="text-sm font-black uppercase tracking-widest text-slate-600">
                        Primary
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setCaptureToFocus(!captureToFocus)}
                      className={`flex items-center gap-3 px-5 py-2.5 rounded-full border-2 transition-all ${captureToFocus ? "bg-teal-600 border-teal-600 text-white shadow-xl shadow-teal-600/30" : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"}`}
                    >
                      <Target className={`w-4 h-4 ${captureToFocus ? "animate-pulse" : ""}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        Focus Today
                      </span>
                    </button>

                    {captureIsPrimary && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3"
                      >
                        <span className="text-[10px] font-black uppercase text-slate-400">
                          Deadline:
                        </span>
                        <input
                          type="date"
                          value={captureDeadline}
                          onChange={(e) => setCaptureDeadline(e.target.value)}
                          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                        />
                      </motion.div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      {(["one-time", "recurring"] as TaskNature[]).map(
                        (nature) => (
                          <button
                            key={nature}
                            type="button"
                            onClick={() => setCaptureNature(nature)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${captureNature === nature ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-500"}`}
                          >
                            {nature}
                          </button>
                        ),
                      )}
                    </div>

                    {captureNature === "recurring" && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-4"
                      >
                        <select
                          value={captureFreq}
                          onChange={(e) =>
                            setCaptureFreq(e.target.value as any)
                          }
                          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>

                        {captureFreq === "weekly" && (
                          <div className="flex gap-1">
                            {["S", "m", "t", "w", "t", "f", "s"].map((d, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  setCaptureDays((prev) =>
                                    prev.includes(i)
                                      ? prev.filter((day) => day !== i)
                                      : [...prev, i],
                                  );
                                }}
                                className={`w-8 h-8 rounded-lg text-[10px] font-black uppercase flex items-center justify-center transition-all ${captureDays.includes(i) ? "bg-teal-500 text-white shadow-lg shadow-teal-500/20" : "bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100"}`}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {captureFreq === "monthly" && (
                          <span className="text-[10px] font-black text-slate-400 uppercase italic">
                            Select date in editing view
                          </span>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between p-4 md:p-8 bg-slate-50/80 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-100 mt-4 shadow-inner gap-4">
                  <div className="flex items-center gap-4 md:gap-6 text-slate-400 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={handleToggleMic}
                      className={`p-4 md:p-5 rounded-[1.25rem] md:rounded-[1.5rem] transition-all shadow-xl ${isListening ? "bg-rose-500 text-white shadow-rose-500/30 animate-pulse" : "bg-white hover:text-slate-900"}`}
                    >
                      <Mic className="w-6 h-6 md:w-7 md:h-7" />
                    </button>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
                        {isListening ? "Awaiting Audio" : "Secure Channel"}
                      </span>
                      <span className="text-[10px] md:text-xs font-bold text-slate-300">
                        Voice recognition active
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={() => setIsCapturing(false)}
                      className="flex-1 md:flex-none px-6 md:px-8 py-3 md:py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors text-sm md:text-base"
                    >
                      Abort
                    </button>
                    <button
                      type="submit"
                      className="flex-[2] md:flex-none bg-slate-900 text-white px-8 md:px-12 py-4 md:py-5 rounded-[2rem] md:rounded-[2.5rem] font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center justify-center gap-2 md:gap-3 shadow-2xl shadow-slate-900/30"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Sparkles className="w-5 h-5" />
                      )}
                      <span className="whitespace-nowrap">Commit Dump</span>
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TRIAGE ritual (Page 2) */}
      <AnimatePresence>
        {isTriageMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-12 glass-heavy bg-white/70 backdrop-blur-3xl"
          >
            <TriageQuiz
              tasks={tasks.filter((t) => t.status === "inbox")}
              onComplete={() => setIsTriageMode(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Focus Session Overlay */}
      <AnimatePresence>
        {focusTask && (
          <TaskFocusOverlay
            task={focusTask}
            onClose={() => setFocusTask(null)}
            onComplete={() => {
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === focusTask.id
                    ? { ...t, completed: true, completedAt: Date.now() }
                    : t,
                ),
              );
              setFocusTask(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Missed Focus Overlay */}
      <AnimatePresence>
        {showMissedPopup && (
          <MissedFocusOverlay
            tasks={tasks.filter(
              (t) =>
                t.status === "focus" &&
                !t.completed &&
                t.focusDate &&
                t.focusDate <
                  new Date(
                    new Date().getFullYear(),
                    new Date().getMonth(),
                    new Date().getDate(),
                  ).getTime(),
            )}
            onClose={() => setShowMissedPopup(false)}
            onComplete={(id) => {
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === id
                    ? { ...t, completed: true, completedAt: Date.now() }
                    : t,
                ),
              );
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MissedFocusOverlay({
  tasks,
  onClose,
  onComplete,
}: {
  tasks: Task[];
  onClose: () => void;
  onComplete: (id: string) => void;
}) {
  if (tasks.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[300] bg-rose-600 flex items-center justify-center p-6 md:p-12 overflow-y-auto"
    >
      <div className="max-w-2xl w-full">
        <div className="flex justify-between items-start mb-12 text-left">
          <div>
            <h2 className="text-5xl md:text-7xl font-black text-white italic tracking-tighter leading-none mb-4">
              MISSED FOCUS
            </h2>
            <p className="text-rose-200 font-bold uppercase tracking-widest text-sm">
              Yesterday's objectives remain unfinished
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all"
          >
            <Minimize2 className="w-8 h-8" />
          </button>
        </div>

        <div className="flex flex-col gap-4 mb-20 text-left">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6"
            >
              <span className="text-xl md:text-2xl font-black text-slate-900 line-clamp-2">
                {task.text}
              </span>
              <button
                onClick={() => onComplete(task.id)}
                className="w-full md:w-auto px-6 md:px-8 py-3 md:py-4 bg-rose-600 text-white rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-600/20 shrink-0"
              >
                Complete Now
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-rose-300 font-bold text-[10px] uppercase tracking-[0.4em]">
          Persistence is non-optional
        </p>
      </div>
    </motion.div>
  );
}
