import React, { useState, useEffect, useRef } from 'react';
import { Mic, Check, Clock, Maximize2, Play, Pause, Minimize2, Sun, LifeBuoy, ArrowDown, ArrowUp, Trash2, Volume2, VolumeX, Sprout, TreePine, Flower2, Target, Flame, Activity, Plus, Settings2, X, Dices, Inbox, Zap, Loader2, Sparkles, Calendar as CalendarIcon, Bell, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
type EffortSize = 'short' | 'medium' | 'deep';

interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

interface RecurringConfig {
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0-6 (0 is Sunday)
  dateOfMonth?: number; // 1-31
}

interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  status: 'today' | 'backlog';
  priority?: 'high' | 'medium' | 'low' | null;
  estimatedTime?: EffortSize | null;
  subtasks?: Subtask[];
  dependencies?: string[];
  recurring?: RecurringConfig | null;
  showAfter?: number;
}

interface Habit {
  id: string;
  name: string;
  categoryId: string | null;
  tiers: { mini: string; plus: string; elite: string };
  momentum: number;
  lastLoggedAt: number;
  history?: string[];
}

interface Category {
  id: string;
  name: string;
  color: string;
}

const TAILWIND_COLORS = [
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-sky-100 text-sky-700 border-sky-200',
];

const TIME_MAP: Record<EffortSize, number> = { short: 15, medium: 45, deep: 90 };
const BANKRUPTCY_HR = 48;

// --- Custom Hooks ---
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
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

function TimeSweep({ totalSeconds, remainingSeconds }: { totalSeconds: number, remainingSeconds: number }) {
  const isOvertime = remainingSeconds < 0;
  const absRemaining = Math.abs(remainingSeconds);
  const progress = isOvertime ? 1 : Math.max(0, remainingSeconds / totalSeconds);
  
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div className="relative flex items-center justify-center w-64 h-64 mb-8">
      <svg className="absolute inset-0 w-full h-full transform -rotate-90">
        <circle cx="128" cy="128" r={radius} className={isOvertime ? "stroke-orange-100" : "stroke-slate-100"} strokeWidth="12" fill="transparent" />
        <circle
          cx="128" cy="128" r={radius}
          className={isOvertime ? "stroke-orange-400" : "stroke-teal-500"}
          strokeWidth="12" fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="z-10 flex flex-col items-center">
        {isOvertime ? (
          <>
            <span className="text-orange-600 font-bold text-sm mb-1">Flow Overtime</span>
            <span className="text-4xl font-bold text-slate-800">{Math.floor(absRemaining/60)}:{(absRemaining%60).toString().padStart(2,'0')}</span>
          </>
        ) : (
          <span className="text-4xl font-bold text-slate-800">{Math.floor(absRemaining/60)}:{(absRemaining%60).toString().padStart(2,'0')}</span>
        )}
      </div>
    </div>
  );
}

// 2. Integrated Focus Room
function HyperfocusOverlay({ task, onClose, onComplete, onLogDistraction }: { task: Task; onClose: () => void; onComplete: (reward: number) => void; onLogDistraction: (text: string) => void; }) {
  const defaultSeconds = task.estimatedTime ? TIME_MAP[task.estimatedTime] * 60 : 25 * 60;
  const [totalTime, setTotalTime] = useState(defaultSeconds);
  const [timeLeft, setTimeLeft] = useState(defaultSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const [isNoiseActive, setIsNoiseActive] = useState(false);
  const [distraction, setDistraction] = useState('');
  const [showDistractionSuccess, setShowDistractionSuccess] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (!isNoiseActive) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const bufferSize = ctx.sampleRate * 2; 
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; 
    }
    const noiseource = ctx.createBufferSource();
    noiseource.buffer = buffer;
    noiseource.loop = true;
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.03; 
    noiseource.connect(gainNode);
    gainNode.connect(ctx.destination);
    noiseource.start(0);

    return () => { noiseource.stop(); ctx.close(); };
  }, [isNoiseActive]);

  const handleDistractionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(distraction.trim()) {
      onLogDistraction(distraction.trim());
      setDistraction('');
      setShowDistractionSuccess(true);
      setTimeout(() => setShowDistractionSuccess(false), 2000);
    }
  };

  const setMicroSprint = () => {
    setTotalTime(5 * 60);
    setTimeLeft(5 * 60);
    setIsRunning(true);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-[#FAFAFA] text-slate-800 flex flex-col md:flex-row shadow-2xl">
      <button onClick={onClose} className="absolute top-8 right-8 text-slate-400 hover:text-slate-800 z-50 transition-colors">
        <Minimize2 className="w-8 h-8" />
      </button>

      <div className="flex-1 bg-slate-50 flex flex-col items-center justify-center p-8 border-r border-slate-200">
        <div className="w-64 h-64 bg-slate-200 rounded-[2rem] mb-8 relative overflow-hidden shadow-inner flex items-center justify-center border-4 border-white">
          <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }} className="w-32 h-40 bg-slate-300 rounded-t-3xl absolute bottom-0 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-slate-400 -mt-8 shadow-sm"></div>
          </motion.div>
          <div className="absolute bottom-4 left-4 bg-white/90 px-3 py-1.5 rounded-lg shadow-sm">
            <span className="text-xs font-bold text-slate-500">Virtual Partner Active</span>
          </div>
        </div>
        
        <button onClick={() => setIsNoiseActive(!isNoiseActive)} className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${isNoiseActive ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-white border-slate-200 text-slate-500'}`}>
          {isNoiseActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span className="text-sm font-semibold">{isNoiseActive ? "Brown Noise ON" : "Soundscape OFF"}</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-between p-8 relative overflow-hidden">
        <div className="flex-1 w-full flex flex-col items-center justify-center">
          <div className="max-w-md w-full flex flex-col items-center text-center z-10">
              <h2 className="text-2xl font-bold text-slate-800 leading-relaxed mb-10">{task.text}</h2>
              
              <TimeSweep totalSeconds={totalTime} remainingSeconds={timeLeft} />

              <div className="flex flex-col gap-4 items-center mt-6 w-full max-w-sm">
                <div className="flex gap-4 w-full">
                  <button onClick={() => setIsRunning(!isRunning)} className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors" aria-label={isRunning ? "Pause focus timer" : "Resume focus timer"}>
                    {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                  </button>
                  <button onClick={() => {
                      const base = 15;
                      const multiplier = (Math.random() < 0.15) ? 4 : (0.8 + Math.random() * 0.4);
                      onComplete(Math.floor(base * multiplier));
                    }}
                    className="flex-1 py-5 bg-teal-600 text-white font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-teal-700 shadow-md shadow-teal-600/20 transition-all"
                  >
                    <Check className="w-6 h-6" strokeWidth={3} /> Complete
                  </button>
                </div>
                
                {totalTime > 300 && (
                  <button onClick={setMicroSprint} className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors">
                    <Zap className="w-4 h-4" />
                    <span className="font-semibold text-sm">Paralyzed? Just do 5 minutes instead.</span>
                  </button>
                )}
              </div>
          </div>
        </div>

        <div className="w-full max-w-md mt-auto pt-8 border-t border-slate-100">
           <form onSubmit={handleDistractionSubmit} className="relative group">
             <div className="absolute -top-6 left-2 flex items-center gap-1.5 opacity-0 group-focus-within:opacity-100 transition-opacity">
                <Inbox className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Distraction Catcher</span>
             </div>
             <input
               type="text" value={distraction} onChange={e=>setDistraction(e.target.value)}
               placeholder="Thought popped up? Type it here, don't leave."
               className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-700 focus:outline-none focus:border-teal-500 focus:ring-4 ring-teal-500/10 transition-all"
             />
             <AnimatePresence>
               {showDistractionSuccess && (
                 <motion.div initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}} exit={{opacity:0}} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-500 font-bold text-xs bg-teal-50 px-2 py-1 rounded-md">
                   Saved to Archive!
                 </motion.div>
               )}
             </AnimatePresence>
           </form>
        </div>
      </div>
    </motion.div>
  );
}

// 3. Emergency Mode
function EmergencyMode({ onClose }: { onClose: () => void }) {
  const gentleTasks = [
    "Drink a glass of water right now.",
    "Take 3 deep, slow breaths.",
    "Stand up and stretch your arms for 10 seconds.",
    "Step outside or look out a window for 1 minute.",
    "Wash your face with cold water for a sensory reset."
  ];
  const [task, setTask] = useState(gentleTasks[0]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[200] bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <LifeBuoy className="w-16 h-16 text-teal-400 mb-8 opacity-60" />
      <h2 className="text-xl mb-6 font-medium text-slate-300">Executive function offline? That is completely okay.</h2>
      <p className="text-3xl md:text-4xl font-bold text-white max-w-2xl leading-relaxed mb-16">{task}</p>
      
      <div className="flex flex-col gap-4 w-full max-w-xs">
         <button onClick={() => setTask(gentleTasks[Math.floor(Math.random()*gentleTasks.length)])} className="py-4 border border-slate-700 rounded-2xl text-slate-400 hover:bg-slate-800 transition-colors font-medium">
           Give me a different one
         </button>
         <button onClick={onClose} className="py-4 bg-teal-600 text-white font-bold rounded-2xl shadow-lg shadow-teal-600/20 hover:bg-teal-500 transition-colors">
           I'm ready to return
         </button>
      </div>
    </motion.div>
  );
}

// Habit Editor Overlay
function HabitFormOverlay({
  initialHabit, onSave, onClose, onDelete, categories, createCategory
}: {
  initialHabit: Habit | null | 'new'; onSave: (habitData: { name: string; categoryId: string | null; tiers: { mini: string; plus: string; elite: string } }) => void; onClose: () => void; onDelete: () => void;
  categories: Category[]; createCategory: (name: string, color: string) => Category;
}) {
  const isEditing = initialHabit && initialHabit !== 'new';
  const data = isEditing ? (initialHabit as Habit) : null;
  const [name, setName] = useState(data?.name || '');
  const [categoryId, setCategoryId] = useState<string>(data?.categoryId || '');
  const [mini, setMini] = useState(data?.tiers.mini || '');
  const [plus, setPlus] = useState(data?.tiers.plus || '');
  const [elite, setElite] = useState(data?.tiers.elite || '');
  
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(TAILWIND_COLORS[0]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: -20 }} className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative overflow-y-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full transition-colors focus:ring-2 ring-teal-500">
          <X className="w-5 h-5"/>
        </button>
        <h2 className="text-2xl font-bold text-slate-800 mb-6">{isEditing ? 'Edit Habit' : 'New Elastic Habit'}</h2>
        
        <div className="flex flex-col gap-5">
          <div>
            <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-1.5 block ml-1">Habit Name</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Exercise, Reading, Water" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-semibold focus:outline-none focus:border-teal-500 focus:bg-white transition-colors placeholder:font-normal"/>
          </div>

          <div>
             <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-1.5 block ml-1">Category</label>
             {!isCreatingCategory ? (
                <select value={categoryId} onChange={e => {
                   if (e.target.value === 'NEW') setIsCreatingCategory(true);
                   else setCategoryId(e.target.value);
                }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white transition-colors">
                  <option value="">No Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="NEW">+ Create New Category</option>
                </select>
             ) : (
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl flex flex-col gap-3">
                   <div className="flex items-center justify-between">
                     <span className="text-sm font-semibold text-slate-700">New Category</span>
                     <button onClick={() => setIsCreatingCategory(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
                   </div>
                   <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="e.g. Wellness" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"/>
                   <div className="flex gap-2">
                     {TAILWIND_COLORS.map(color => (
                        <button key={color} onClick={() => setNewCatColor(color)} className={`w-6 h-6 rounded-full border-2 ${color} ${newCatColor === color ? 'ring-2 ring-slate-400 ring-offset-2' : ''}`}></button>
                     ))}
                   </div>
                </div>
             )}
          </div>

          <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-100 flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-bold text-teal-600/70 tracking-wider uppercase mb-1.5 block ml-1">Tier 1: Mini (Low Energy Day)</label>
              <input value={mini} onChange={e=>setMini(e.target.value)} placeholder="e.g. Put on running shoes" className="w-full bg-white border border-teal-100 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-teal-400 transition-colors"/>
            </div>
            <div>
              <label className="text-[11px] font-bold text-teal-600/70 tracking-wider uppercase mb-1.5 block ml-1">Tier 2: Plus (Standard Day)</label>
              <input value={plus} onChange={e=>setPlus(e.target.value)} placeholder="e.g. 10 minute walk" className="w-full bg-white border border-teal-100 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-teal-400 transition-colors"/>
            </div>
            <div>
              <label className="text-[11px] font-bold text-teal-600/70 tracking-wider uppercase mb-1.5 block ml-1">Tier 3: Elite (High Energy Day)</label>
              <input value={elite} onChange={e=>setElite(e.target.value)} placeholder="e.g. 45 min gym session" className="w-full bg-white border border-teal-100 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-teal-400 transition-colors"/>
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-8 pt-6 border-t border-slate-100">
          {isEditing && (
            <button onClick={onDelete} className="px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors" title="Delete Habit">
              <Trash2 className="w-5 h-5"/>
            </button>
          )}
          <button 
            disabled={!name.trim() || !mini.trim() || (isCreatingCategory && !newCatName.trim())} 
            onClick={() => {
              if(name.trim() && mini.trim()) {
                let finalCategoryId = categoryId;
                if (isCreatingCategory && newCatName.trim()) {
                   const newCat = createCategory(newCatName.trim(), newCatColor);
                   finalCategoryId = newCat.id;
                }
                
                onSave({
                  name: name.trim(), 
                  categoryId: finalCategoryId || null,
                  tiers: {
                    mini: mini.trim(), 
                    plus: plus.trim() || mini.trim(), 
                    elite: elite.trim() || plus.trim() || mini.trim()
                  }
                });
              }
            }}
            className="flex-1 px-4 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save Habit
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// 4. Task Item Component
function TaskCard({ 
  task, availableTasks, onComplete, onDelete, onStatusChange, onEnterHyperfocus, onAddSubtask, onToggleSubtask, onSetEffort, onSetPriority, onUpdateDependencies, onUpdateRecurring
}: { 
  key?: string | number,
  task: Task; 
  availableTasks: Task[];
  onComplete: () => void; onDelete: () => void; onStatusChange: (status: 'today' | 'backlog') => void;
  onEnterHyperfocus: () => void; onAddSubtask: (text: string) => void; onToggleSubtask: (subId: string) => void; onSetEffort: (effort: EffortSize | null) => void;
  onSetPriority: (priority: 'high' | 'medium' | 'low' | null) => void;
  onUpdateDependencies: (deps: string[]) => void;
  onUpdateRecurring: (recurring: RecurringConfig | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [subInput, setSubInput] = useState('');

  const submitSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (subInput.trim()) {
      onAddSubtask(subInput.trim());
      setSubInput('');
    }
  };

  const priorityColors = {
    high: 'text-rose-600 bg-rose-50 border-rose-200',
    medium: 'text-amber-600 bg-amber-50 border-amber-200',
    low: 'text-slate-600 bg-slate-100 border-slate-200',
  };

  const activeDependencies = task.dependencies?.map(dId => availableTasks.find(t => t.id === dId)).filter(t => t && !t.completed) || [];
  const isBlocked = activeDependencies.length > 0;

  const validLinkTargets = availableTasks.filter(t => t.id !== task.id && !t.completed && !task.dependencies?.includes(t.id));

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`bg-white rounded-[2rem] p-5 shadow-sm border ${task.status === 'today' ? 'border-teal-100 hover:border-teal-200' : 'border-slate-100 hover:border-slate-200'} transition-all ${isBlocked ? 'opacity-70 grayscale-[0.2]' : ''}`}>
      <div className="flex gap-4 items-start">
        <button disabled={isBlocked} onClick={onComplete} aria-label="Complete task" className={`mt-1 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-colors shrink-0 ${isBlocked ? 'border-slate-200 bg-slate-50 cursor-not-allowed' : 'border-slate-200 hover:border-teal-500 hover:bg-teal-50'}`}>
          {task.completed ? <Check className="w-4 h-4 text-teal-600" strokeWidth={3} /> : (isBlocked ? <div className="w-2 h-2 rounded-full bg-slate-300"></div> : null)}
        </button>
        
        <div className="flex-1 flex flex-col cursor-pointer" onClick={() => setExpanded(!expanded)}>
           <div className="flex items-center gap-2">
             <span className={`text-lg font-bold leading-snug ${isBlocked ? 'text-slate-500' : 'text-slate-800'}`}>{task.text}</span>
             {task.priority && (
                <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${priorityColors[task.priority]} shrink-0 mt-0.5`}>
                  {task.priority} Priority
                </span>
             )}
             {isBlocked && (
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-500 shrink-0 mt-0.5 flex items-center gap-1">
                  Blocked
                </span>
             )}
             {task.recurring && (
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-600 shrink-0 mt-0.5 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Repeating
                </span>
             )}
           </div>
           <div className="flex items-center gap-3 mt-2 flex-wrap">
             {task.estimatedTime && (
               <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md mb-1">
                 {task.estimatedTime} ({TIME_MAP[task.estimatedTime]}m)
               </span>
             )}
             {task.subtasks && task.subtasks.length > 0 && (
               <span className="text-xs font-medium text-slate-400 mb-1">
                 {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks
               </span>
             )}
             {!expanded && isBlocked && (
               <span className="text-xs font-medium text-amber-500 mb-1 flex items-center gap-1">
                 Waiting on {activeDependencies.length} task{activeDependencies.length !== 1 ? 's' : ''}
               </span>
             )}
             {!expanded && !isBlocked && <span className="text-xs text-slate-300 ml-auto mr-2">Tap to expand</span>}
           </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button disabled={task.status === 'backlog' && isBlocked} onClick={(e) => { e.stopPropagation(); onStatusChange(task.status === 'today' ? 'backlog' : 'today'); }} className={`p-2 rounded-lg transition-colors ${task.status === 'backlog' && isBlocked ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`} title={task.status === 'today' ? "Move to Archive" : (isBlocked ? "Blocked: Cannot move to Today" : "Move to Today")}>
            {task.status === 'today' ? <ArrowDown className="w-5 h-5" /> : <ArrowUp className="w-5 h-5" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50" title="Delete task">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-6 pt-5 border-t border-slate-100 flex flex-col gap-5">
            <button disabled={isBlocked} onClick={onEnterHyperfocus} className={`w-full py-4 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${isBlocked ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'}`}>
              <Maximize2 className="w-5 h-5" /> Start Focus Room Session
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               <div className="flex flex-col gap-3">
                  <span className="text-sm font-bold text-slate-600">Break it down</span>
                  <div className="flex flex-col gap-2">
                    {task.subtasks?.map(sub => (
                       <div key={sub.id} className="flex items-start gap-3">
                         <button onClick={() => onToggleSubtask(sub.id)} className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${sub.completed ? 'border-teal-500 bg-teal-500' : 'border-slate-300 hover:border-slate-400'}`}>
                           {sub.completed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                         </button>
                         <span className={`text-base ${sub.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{sub.text}</span>
                       </div>
                    ))}
                  </div>
                  <form onSubmit={submitSubtask} className="flex mt-2">
                    <input type="text" placeholder="Add a micro-step..." value={subInput} onChange={e => setSubInput(e.target.value)} className="bg-transparent border-b border-slate-200 pb-2 text-base text-slate-700 focus:outline-none focus:border-teal-500 w-full placeholder:text-slate-400" />
                  </form>
               </div>

               <div className="flex flex-col gap-3">
                  <span className="text-sm font-bold text-slate-600">Estimate Effort</span>
                  <div className="flex flex-col gap-2">
                    {(['short', 'medium', 'deep'] as EffortSize[]).map(size => (
                      <button key={size} onClick={() => onSetEffort(task.estimatedTime === size ? null : size)} className={`py-3 px-4 font-semibold text-sm rounded-xl border text-left transition-colors ${task.estimatedTime === size ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        {size.charAt(0).toUpperCase() + size.slice(1)} Task ({TIME_MAP[size]} mins)
                      </button>
                    ))}
                  </div>
               </div>

               <div className="flex flex-col gap-3">
                  <span className="text-sm font-bold text-slate-600">Set Priority</span>
                  <div className="flex flex-col gap-2">
                    {(['high', 'medium', 'low'] as const).map(p => (
                      <button key={p} onClick={() => onSetPriority(task.priority === p ? null : p)} className={`py-3 px-4 font-semibold text-sm rounded-xl border text-left transition-colors flex items-center gap-2 ${task.priority === p ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                         <div className={`w-3 h-3 rounded-full ${p === 'high' ? 'bg-rose-500' : p === 'medium' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
                         {p.charAt(0).toUpperCase() + p.slice(1)} Priority
                      </button>
                    ))}
                  </div>
               </div>

               <div className="flex flex-col gap-3">
                  <span className="text-sm font-bold text-slate-600">Dependencies</span>
                  <div className="flex flex-col gap-2">
                     {activeDependencies.length > 0 && (
                        <div className="flex flex-col gap-2 mb-2">
                           {activeDependencies.map(dep => (
                              <div key={dep.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm">
                                 <span className="text-slate-600 truncate mr-2" title={dep.text}>{dep.text}</span>
                                 <button onClick={() => onUpdateDependencies((task.dependencies||[]).filter(id => id !== dep.id))} className="text-slate-400 hover:text-red-500">
                                    <X className="w-3.5 h-3.5" />
                                 </button>
                              </div>
                           ))}
                        </div>
                     )}
                     
                     {validLinkTargets.length > 0 ? (
                        <select 
                           value="" 
                           onChange={e => {
                              if(e.target.value) {
                                 onUpdateDependencies([...(task.dependencies||[]), e.target.value]);
                              }
                           }}
                           className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 focus:outline-none focus:border-indigo-400"
                        >
                           <option value="" disabled>+ Link blocking task</option>
                           {validLinkTargets.map(t => (
                              <option key={t.id} value={t.id}>{t.text.length > 30 ? t.text.substring(0,30) + '...' : t.text}</option>
                           ))}
                        </select>
                     ) : (
                        <span className="text-xs text-slate-400 font-medium italic">No other tasks to link.</span>
                     )}
                  </div>
               </div>

               <div className="flex flex-col gap-3">
                  <span className="text-sm font-bold text-slate-600">Recurring Status</span>
                  <div className="flex flex-col gap-2">
                     <select 
                        value={task.recurring?.frequency || ""}
                        onChange={e => {
                           const val = e.target.value;
                           if (!val) {
                              onUpdateRecurring(null);
                           } else {
                              onUpdateRecurring({ frequency: val as any, dayOfWeek: 0, dateOfMonth: 1 });
                           }
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 focus:outline-none focus:border-indigo-400"
                     >
                        <option value="">Doesn't repeat</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                     </select>

                     {task.recurring?.frequency === 'weekly' && (
                        <select 
                           value={task.recurring.dayOfWeek?.toString() || "0"}
                           onChange={e => onUpdateRecurring({...task.recurring!, dayOfWeek: parseInt(e.target.value)})}
                           className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 focus:outline-none focus:border-indigo-400"
                        >
                           {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, idx) => (
                              <option key={idx} value={idx}>On {day}s</option>
                           ))}
                        </select>
                     )}

                     {task.recurring?.frequency === 'monthly' && (
                        <select 
                           value={task.recurring.dateOfMonth?.toString() || "1"}
                           onChange={e => onUpdateRecurring({...task.recurring!, dateOfMonth: parseInt(e.target.value)})}
                           className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 focus:outline-none focus:border-indigo-400"
                        >
                           {Array.from({length: 31}, (_, i) => i + 1).map(date => (
                              <option key={date} value={date}>On the {date}{[1,21,31].includes(date)?'st':[2,22].includes(date)?'nd':[3,23].includes(date)?'rd':'th'}</option>
                           ))}
                        </select>
                     )}
                  </div>
               </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// 5. Visual Achievement Garden Component
function VisualGarden({ sunlight }: { sunlight: number }) {
  const plantCount = Math.min(Math.floor(sunlight / 30), 10);
  const elements = [];
  
  for (let i = 0; i < plantCount; i++) {
    if (i % 3 === 0) elements.push(<TreePine key={i} className="text-teal-600 w-8 h-8 drop-shadow-sm" />);
    else if (i % 2 === 0) elements.push(<Flower2 key={i} className="text-pink-400 w-6 h-6 mb-1 drop-shadow-sm" />);
    else elements.push(<Sprout key={i} className="text-teal-400 w-5 h-5 mb-1" />);
  }

  return (
    <div className="flex items-end gap-3 h-10 px-4 min-w-[200px]">
      <AnimatePresence>
        {elements.length > 0 ? (
          elements.map((el, i) => (
            <motion.div key={i} initial={{ scale: 0, y: 10 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', damping: 12 }}>
              {el}
            </motion.div>
          ))
        ) : (
          <span className="text-sm font-medium text-slate-400 pb-1">Complete tasks to grow your garden</span>
        )}
      </AnimatePresence>
    </div>
  );
}

// 6. Habit Tracker Component integrating Categories
function HabitCard({ habit, category, onLog, onEdit }: { key?: string | number, habit: Habit; category: Category | undefined; onLog: (tier: 'mini'|'plus'|'elite', sunlightReward: number, momentumBoost: number) => void; onEdit: () => void; }) {
  const [expanded, setExpanded] = useState(false);
  const isLoggedToday = new Date().toDateString() === new Date(habit.lastLoggedAt).toDateString();
  
  const heatmapDays = Array.from({length: 28}).map((_, i) => {
     const d = new Date();
     d.setDate(d.getDate() - (27 - i));
     return d.toDateString();
  });
  
  return (
    <motion.div layout className={`bg-white rounded-[2rem] p-5 shadow-sm border ${isLoggedToday ? 'border-teal-100 bg-teal-50/20' : 'border-slate-100 hover:border-slate-200'} transition-all`}>
       <div className="flex justify-between items-start mb-5">
          <div className="flex flex-col flex-1 truncate pr-2">
            <h3 className="font-bold text-slate-800 text-lg leading-tight truncate">{habit.name}</h3>
            {category && (
               <span className={`self-start mt-2 text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider ${category.color} bg-opacity-20`}>{category.name}</span>
            )}
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
             <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-full border border-amber-100 shadow-sm" title="Momentum Score">
                <Flame className={`w-4 h-4 ${habit.momentum > 0 ? 'text-amber-500' : 'text-amber-200 text-opacity-50'}`} />
                <span className={`text-sm font-bold ${habit.momentum > 0 ? 'text-amber-600' : 'text-amber-300'}`}>{habit.momentum}</span>
             </div>
             <button onClick={() => setExpanded(!expanded)} className={`p-1.5 rounded-full transition-colors flex shrink-0 ${expanded ? 'bg-indigo-100 text-indigo-600' : 'text-slate-300 hover:text-slate-600 bg-slate-50 hover:bg-slate-100'}`} title="Toggle Heatmap">
                <Activity className="w-4 h-4"/>
             </button>
             <button onClick={onEdit} className="p-1.5 text-slate-300 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors flex shrink-0" title="Edit Habit">
                <Settings2 className="w-4 h-4"/>
             </button>
          </div>
       </div>

       {isLoggedToday ? (
         <div className="py-8 flex flex-col items-center justify-center bg-teal-50/80 rounded-2xl border border-teal-100 shadow-inner">
            <Check className="w-10 h-10 text-teal-400 mb-2" strokeWidth={4} />
            <span className="text-teal-700 font-bold">Momentum secured</span>
            <span className="text-xs text-teal-600/70 font-medium">Great job adapting today.</span>
         </div>
       ) : (
         <div className="flex flex-col gap-2.5">
            <button onClick={() => onLog('mini', 10, 2)} className="text-left px-5 py-3.5 bg-white hover:bg-slate-50 border border-slate-100 hover:border-teal-200 shadow-sm rounded-2xl transition-colors group">
               <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase group-hover:text-teal-500 transition-colors">Tier 1: Mini</span>
                  <span className="text-[10px] font-bold text-amber-500/50">+2 Mo</span>
               </div>
               <span className="text-sm font-bold text-slate-700">{habit.tiers.mini}</span>
            </button>
            <button onClick={() => onLog('plus', 20, 5)} className="text-left px-5 py-3.5 bg-white hover:bg-slate-50 border border-slate-100 hover:border-teal-200 shadow-sm rounded-2xl transition-colors group">
               <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase group-hover:text-teal-500 transition-colors">Tier 2: Plus</span>
                  <span className="text-[10px] font-bold text-amber-500/50">+5 Mo</span>
               </div>
               <span className="text-sm font-bold text-slate-700">{habit.tiers.plus}</span>
            </button>
            <button onClick={() => onLog('elite', 40, 10)} className="text-left px-5 py-3.5 bg-white hover:bg-slate-50 border border-slate-100 hover:border-teal-200 shadow-sm rounded-2xl transition-colors group">
               <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase group-hover:text-teal-500 transition-colors">Tier 3: Elite</span>
                  <span className="text-[10px] font-bold text-amber-500/50">+10 Mo</span>
               </div>
               <span className="text-sm font-bold text-slate-700">{habit.tiers.elite}</span>
            </button>
         </div>
       )}

       <AnimatePresence>
         {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-5 pt-4 border-t border-slate-100">
               <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">28-Day Consistency</span>
               <div className="grid grid-cols-7 gap-1.5 h-max">
                 {heatmapDays.map((dateStr, idx) => {
                    const didLog = habit.history && habit.history.includes(dateStr);
                    return (
                       <div 
                         key={idx} 
                         title={dateStr}
                         className={`aspect-square rounded-md ${didLog ? 'bg-teal-500 shadow-sm border border-teal-600/20' : 'bg-slate-100 border border-slate-200/50'}`}
                       />
                    )
                 })}
               </div>
            </motion.div>
         )}
       </AnimatePresence>
    </motion.div>
  )
}

// --- Main Application ---
export default function App() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('ff_v2_tasks', []);
  const [sunlight, setSunlight] = useLocalStorage<number>('ff_v2_sunlight', 0);
  
  const [categories, setCategories] = useLocalStorage<Category[]>('ff_v2_categories', [
    { id: 'cat-health', name: 'Health', color: TAILWIND_COLORS[0] },
    { id: 'cat-mind', name: 'Mindfulness', color: TAILWIND_COLORS[1] }
  ]);
  
  const [habits, setHabits] = useLocalStorage<Habit[]>('ff_v2_habits', [
    { id: 'h1', name: 'Hydration Base', categoryId: 'cat-health', tiers: { mini: 'Drink 1 glass of water', plus: 'Drink 3 glasses', elite: 'Drink 2 liters' }, momentum: 12, lastLoggedAt: 0 },
    { id: 'h2', name: 'Breathing Routine', categoryId: 'cat-mind', tiers: { mini: '3 deep breaths', plus: '5 minute meditation', elite: '20 minute meditation session' }, momentum: 5, lastLoggedAt: 0 }
  ]);
  
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  const [captureInput, setCaptureInput] = useState('');
  const [hyperfocusTask, setHyperfocusTask] = useState<Task | null>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null | 'new'>(null);

  // Voice & Parsing States
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSmartCompiling, setIsSmartCompiling] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Calendar Integration States
  const [calendarToken, setCalendarToken] = useLocalStorage<{ access_token: string, expiry: number } | null>('ff_v2_calendar_token', null);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<any | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) return;
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const tokens = event.data.tokens;
        if (tokens.access_token) {
           setCalendarToken({ access_token: tokens.access_token, expiry: Date.now() + tokens.expires_in * 1000 });
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setCalendarToken]);

  useEffect(() => {
    if (calendarToken && calendarToken.expiry > Date.now()) {
       fetchCalendarEvents();
    } else if (calendarToken && calendarToken.expiry <= Date.now()) {
       setCalendarToken(null);
    }
  }, [calendarToken]);

  const fetchCalendarEvents = async () => {
    if (!calendarToken) return;
    setIsLoadingCalendar(true);
    try {
      const start = new Date();
      start.setHours(0,0,0,0);
      const end = new Date();
      end.setHours(23,59,59,999);
      
      const res = await fetch(`/api/calendar/events?timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}`, {
        headers: { 'Authorization': `Bearer ${calendarToken.access_token}` }
      });
      if (res.status === 401) {
         setCalendarToken(null);
         throw new Error("Token expired");
      }
      
      const text = await res.text();
      let data;
      try {
         data = JSON.parse(text);
      } catch (e) {
         console.error("Invalid JSON from calendar fetch:", text);
         return;
      }

      if (!res.ok) {
         console.error("Calendar API Error:", data);
         alert(`Calendar Sync Error: ${data.message || data.error?.message || data.error || "Verify Google Calendar API is enabled in GCP."}`);
         return;
      }
      setCalendarEvents(data.items || []);
    } catch (err) {
      console.error("Calendar fetch error:", err);
      if (err instanceof TypeError && err.message.includes('fetch')) {
         alert("Network Error: Failed to fetch calendar (Adblocker or offline). Proxy should prevent this.");
      }
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const handleConnectCalendar = async () => {
    try {
      console.log("Fetching /api/auth/url");
      const res = await fetch('/api/auth/url');
      console.log("Response status:", res.status);
      
      const text = await res.text();
      console.log("Response text:", text);
      
      let data;
      try {
         data = JSON.parse(text);
      } catch (e) {
         console.error("Failed to parse JSON from /api/auth/url", text);
         alert("Invalid response from server");
         return;
      }
      
      if (!res.ok) {
         alert(data.message || "Failed to set up Google Calendar sync.");
         return;
      }
      
      window.open(data.url, 'oauth_popup', 'width=600,height=700');
    } catch (err) {
      console.error("handleConnectCalendar fetch error:", err);
      alert(`Network error connecting to backend: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const addEventAsTask = (event: any) => {
    const newTask: Task = { 
      id: crypto.randomUUID(), 
      text: event.summary || "Calendar Event", 
      completed: false, 
      createdAt: Date.now(), 
      status: 'today', 
      priority: 'high',
      subtasks: [],
      dependencies: []
    };
    setTasks(prev => [newTask, ...prev]);
  };

  // Alarm Poller
  useEffect(() => {
    if (calendarEvents.length === 0) return;
    
    // Request permission if not granted
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }

    const interval = setInterval(() => {
      const now = new Date();
      calendarEvents.forEach(event => {
        if (event.start?.dateTime) {
           const eventTime = new Date(event.start.dateTime);
           const diffMs = eventTime.getTime() - now.getTime();
           // Notify 5 minutes before
           if (diffMs > 0 && diffMs <= 5 * 60 * 1000) {
             const key = `notified_${event.id}`;
             if (!localStorage.getItem(key)) {
                localStorage.setItem(key, 'true');
                setActiveAlarm(event); // Trigger loud, visual app alert
                
                if (Notification.permission === "granted") {
                  new Notification("Upcoming Event", {
                     body: `${event.summary} starts in 5 minutes!`,
                     icon: '/pwa-192x192.png'
                  });
                }
             }
           }
        }
      });
    }, 60000); // check every minute
    return () => clearInterval(interval);
  }, [calendarEvents]);

  useEffect(() => {
    const purgeThreshold = BANKRUPTCY_HR * 60 * 60 * 1000;
    const interval = setInterval(() => {
      const now = Date.now();
      setTasks(prev => prev.filter(t => t.completed || t.recurring || (now - t.createdAt) < purgeThreshold));
    }, 60 * 1000); 
    return () => clearInterval(interval);
  }, [setTasks]);

  useEffect(() => {
    const todayStr = new Date().toDateString();
    let updated = false;
    const newHabits = habits.map(h => {
      if (h.lastLoggedAt === 0) return h; 
      const daysSince = Math.floor((Date.now() - h.lastLoggedAt) / (1000 * 60 * 60 * 24));
      if (daysSince > 1 && new Date(h.lastLoggedAt).toDateString() !== todayStr) {
        const decay = (daysSince - 1) * 2;
        const newMomentum = Math.max(0, h.momentum - decay);
        if (newMomentum !== h.momentum) {
          updated = true;
          return { ...h, momentum: newMomentum };
        }
      }
      return h;
    });
    if (updated) setHabits(newHabits);
  }, []);

  useEffect(() => {
    setTasks(prev => {
      const activeTodayLength = prev.filter(t => !t.completed && t.status === 'today' && (!t.showAfter || t.showAfter <= Date.now())).length;
      if (activeTodayLength >= 5) return prev;
      
      const activeBacklog = prev.filter(t => !t.completed && t.status === 'backlog' && (!t.showAfter || t.showAfter <= Date.now()));
      if (activeBacklog.length === 0) return prev;

      const needed = 5 - activeTodayLength;
      
      const pL = (p: Task['priority']) => p === 'high' ? 3 : p === 'medium' ? 2 : p === 'low' ? 1 : 0;
      const sortedBacklog = [...activeBacklog].sort((a,b) => {
        const pDiff = pL(b.priority) - pL(a.priority);
        return pDiff !== 0 ? pDiff : b.createdAt - a.createdAt;
      });

      const toPromoteIds = sortedBacklog.slice(0, needed).map(t => t.id);
      
      let changed = false;
      const next = prev.map(t => {
         if (toPromoteIds.includes(t.id)) {
            changed = true;
            return { ...t, status: 'today' };
         }
         return t;
      });
      return changed ? next : prev;
    });
  }, [tasks]);

  const handleSmartCapture = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!captureInput.trim()) return;
    
    setIsSmartCompiling(true);
    let todayCount = tasks.filter(t => !t.completed && t.status === 'today').length;
    
    // Parse input string: Attempt newlines first, then commas
    let rawTasks: string[] = [];
    if (captureInput.includes('\n')) {
       rawTasks = captureInput.split(/\r?\n/);
    } else if (captureInput.includes(',')) {
       rawTasks = captureInput.split(',');
    } else {
       rawTasks = [captureInput];
    }
    
    rawTasks = rawTasks.map(t => t.trim().replace(/^[-*•]\s*/, '')).filter(t => t.length > 0);

    const newTasks: Task[] = rawTasks.map(text => {
       let assignedStatus: 'today' | 'backlog' = 'today';
       if (todayCount >= 5) assignedStatus = 'backlog';
       else todayCount++;
       
       return {
         id: crypto.randomUUID(),
         text: text.charAt(0).toUpperCase() + text.slice(1),
         completed: false,
         createdAt: Date.now(),
         status: assignedStatus,
         priority: 'medium',
         estimatedTime: null,
         subtasks: [],
         dependencies: []
       };
    });
    
    setTimeout(() => {
      setTasks(prev => [...newTasks, ...prev]);
      setCaptureInput('');
      setIsSmartCompiling(false);
    }, 500); // Visual delay
  };

  const handleToggleMic = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setCaptureInput(prev => (prev ? prev + ' ' + transcript : transcript).trim());
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  const completeTask = (id: string, extraReward: number = 0) => {
    let reward = extraReward;
    if (reward === 0) reward = Math.floor(15 * (Math.random() < 0.15 ? 4 : (0.8 + Math.random() * 0.4)));
    setSunlight(prev => prev + reward);
    
    setTasks(prev => {
      const task = prev.find(t => t.id === id);
      let nextTasks = [...prev];
      if (task && task.recurring) {
        const now = new Date();
        const next = new Date(now);
        next.setHours(0,0,0,0);
        
        if (task.recurring.frequency === 'daily') {
          next.setDate(next.getDate() + 1);
        } else if (task.recurring.frequency === 'weekly') {
          const targetDay = task.recurring.dayOfWeek || 0;
          let diff = targetDay - now.getDay();
          if (diff <= 0) diff += 7;
          next.setDate(next.getDate() + diff);
        } else if (task.recurring.frequency === 'monthly') {
          const targetDate = task.recurring.dateOfMonth || 1;
          let currentMonth = now.getMonth();
          let currentYear = now.getFullYear();
          if (now.getDate() >= targetDate) {
              currentMonth++;
              if (currentMonth > 11) {
                  currentMonth = 0;
                  currentYear++;
              }
          }
          next.setFullYear(currentYear, currentMonth, targetDate);
        }
        
        // Spawn next instance
        nextTasks.push({
          ...task,
          id: crypto.randomUUID(),
          completed: false,
          createdAt: Date.now(),
          showAfter: next.getTime(),
          subtasks: task.subtasks ? task.subtasks.map(st => ({...st, completed: false})) : []
        });
      }
      return nextTasks.map(t => t.id === id ? { ...t, completed: true } : t);
    });
    
    setTimeout(() => { setTasks(prev => prev.filter(t => t.id !== id)); }, 2000);
  };

  const handleLogHabit = (id: string, reward: number, boost: number) => {
    const todayStr = new Date().toDateString();
    setHabits(prev => prev.map(h => {
      if (h.id === id) {
         const history = h.history ? [...h.history] : [];
         if (!history.includes(todayStr)) history.push(todayStr);
         return { ...h, momentum: h.momentum + boost, lastLoggedAt: Date.now(), history };
      }
      return h;
    }));
    const multiplier = Math.random() < 0.20 ? 3 : 1;
    setSunlight(prev => prev + (reward * multiplier));
  };

  const createCategory = (name: string, color: string): Category => {
     const newCat = { id: crypto.randomUUID(), name, color };
     setCategories(prev => [...prev, newCat]);
     return newCat;
  }

  const handleSaveHabit = (habitData: { name: string; categoryId: string | null; tiers: { mini: string; plus: string; elite: string } }) => {
    if (editingHabit === 'new') {
      const newHabit: Habit = { id: crypto.randomUUID(), name: habitData.name, categoryId: habitData.categoryId, tiers: habitData.tiers, momentum: 0, lastLoggedAt: 0, history: [] };
      setHabits(prev => [...prev, newHabit]);
    } else if (editingHabit) {
      setHabits(prev => prev.map(h => h.id === editingHabit.id ? { ...h, name: habitData.name, categoryId: habitData.categoryId, tiers: habitData.tiers } : h));
    }
    setEditingHabit(null);
  };

  const handleDeleteHabit = () => {
    if (editingHabit && editingHabit !== 'new') {
      setHabits(prev => prev.filter(h => h.id !== editingHabit.id));
      setEditingHabit(null);
    }
  };

  const [isSpinning, setIsSpinning] = useState(false);
  const pickForMe = () => {
    if (activeToday.length === 0) return;
    setIsSpinning(true);
    setTimeout(() => {
      const randomTask = activeToday[Math.floor(Math.random() * activeToday.length)];
      setHyperfocusTask(randomTask);
      setIsSpinning(false);
    }, 600);
  };

  const handleLogDistraction = (text: string) => {
    const newTask: Task = { id: crypto.randomUUID(), text: text.charAt(0).toUpperCase() + text.slice(1), completed: false, createdAt: Date.now(), status: 'backlog', priority: 'low', subtasks: [], dependencies: [] };
    setTasks(prev => [newTask, ...prev]);
  };

  const pLevel = (p: Task['priority']) => p === 'high' ? 3 : p === 'medium' ? 2 : p === 'low' ? 1 : 0;

  const activeToday = tasks.filter(t => !t.completed && t.status === 'today' && (!t.showAfter || t.showAfter <= Date.now())).sort((a,b) => {
    const pDiff = pLevel(b.priority) - pLevel(a.priority);
    return pDiff !== 0 ? pDiff : b.createdAt - a.createdAt;
  });
  
  const activeBacklog = tasks.filter(t => !t.completed && t.status === 'backlog' && (!t.showAfter || t.showAfter <= Date.now())).sort((a,b) => {
    const pDiff = pLevel(b.priority) - pLevel(a.priority);
    return pDiff !== 0 ? pDiff : b.createdAt - a.createdAt;
  });

  const displayedHabits = selectedCategoryFilter 
     ? habits.filter(h => h.categoryId === selectedCategoryFilter) 
     : habits;

  return (
    <div className="min-h-screen pb-24 w-full overflow-x-hidden selection:bg-teal-200">
      
      <AnimatePresence>
        {hyperfocusTask && (
          <HyperfocusOverlay task={hyperfocusTask} onClose={() => setHyperfocusTask(null)} onComplete={(reward) => { completeTask(hyperfocusTask.id, reward); setHyperfocusTask(null); }} onLogDistraction={handleLogDistraction} />
        )}
        {emergencyMode && (
          <EmergencyMode onClose={() => setEmergencyMode(false)} />
        )}
        {editingHabit && (
          <HabitFormOverlay 
             initialHabit={editingHabit} 
             onSave={handleSaveHabit} 
             onClose={() => setEditingHabit(null)} 
             onDelete={handleDeleteHabit} 
             categories={categories}
             createCategory={createCategory}
          />
        )}
        {activeAlarm && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] w-full max-w-sm">
             <div className="bg-indigo-600 text-white p-6 rounded-3xl shadow-2xl flex flex-col items-center text-center gap-4 border-4 border-indigo-500 shadow-indigo-600/30">
                <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center animate-pulse">
                   <Bell className="w-6 h-6 text-white" />
                </div>
                <div>
                   <h3 className="text-xl font-bold mb-1">Starting in 5 Minutes</h3>
                   <p className="text-indigo-100 font-medium line-clamp-2">{activeAlarm.summary}</p>
                </div>
                <button onClick={() => setActiveAlarm(null)} className="mt-2 text-indigo-600 bg-white hover:bg-indigo-50 px-6 py-2.5 rounded-xl font-bold transition-colors w-full">
                  Got it
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto px-4 md:px-8 pt-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 bg-white p-4 rounded-3xl shadow-sm border border-slate-100 gap-4">
           <div className="flex flex-col">
             <div className="flex items-center gap-3 mb-2">
               <div className="w-10 h-10 bg-teal-50 rounded-[1.25rem] flex items-center justify-center text-teal-600">
                 <Sun className="w-6 h-6" />
               </div>
               <div>
                  <h1 className="text-xl font-bold text-slate-800">FocusFlow AI</h1>
               </div>
             </div>
             <div className="flex items-center">
                <VisualGarden sunlight={sunlight} />
             </div>
           </div>
           
           <div className="flex items-center gap-4">
              <div className="flex flex-col items-end mr-2">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Sunlight Gathered</span>
                 <div className="flex items-center gap-2">
                   <Sun className="w-4 h-4 text-amber-500" />
                   <span className="font-bold text-amber-600 text-xl">{sunlight}</span>
                 </div>
              </div>
              <div className="w-px h-10 bg-slate-100"></div>
              <button onClick={() => setEmergencyMode(true)} className="w-12 h-12 bg-slate-50 rounded-[1.25rem] border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-red-500 transition-colors shadow-sm" title="Bad Brain Day Rescue">
                <LifeBuoy className="w-6 h-6" />
              </button>
           </div>
        </header>

        <section className="mb-12">
           <div className="flex items-center gap-2 mb-3 ml-2">
              <Zap className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Task Capture</span>
           </div>
           <form onSubmit={handleSmartCapture} className={`relative shadow-sm rounded-[2rem] bg-white border p-2 overflow-hidden transition-all ${isListening ? 'ring-4 ring-rose-500/20 border-rose-200' : 'focus-within:ring-4 ring-teal-500/20 border-slate-100'}`}>
             <input type="text" disabled={isTranscribing || isSmartCompiling} placeholder={isTranscribing ? "Transcribing speech..." : isSmartCompiling ? "Analyzing tasks..." : "List your thoughts... (separate with new lines or commas)"} value={captureInput} onChange={(e) => setCaptureInput(e.target.value)} className="w-full bg-transparent p-6 pr-20 text-xl font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-50" />
             <button type="button" onClick={handleToggleMic} disabled={isTranscribing || isSmartCompiling} className={`absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-[1.25rem] flex items-center justify-center transition-colors shadow-md ${isListening ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30 animate-pulse' : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20 disabled:opacity-50'}`} title="Voice Dictation">
                {isTranscribing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />}
             </button>
           </form>
           {captureInput.length > 0 && !isListening && !isTranscribing && (
              <motion.button disabled={isSmartCompiling} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} onClick={(e: any) => handleSmartCapture(e)} className="mt-4 px-6 py-3.5 bg-slate-800 text-white rounded-xl shadow-md font-bold text-sm hover:bg-slate-700 border border-slate-700 w-full flex justify-center items-center gap-2 transition-colors disabled:opacity-75">
                {isSmartCompiling ? <><Loader2 className="w-4 h-4 animate-spin"/> Parsing Tasks...</> : "Parse into Tasks"}
              </motion.button>
           )}
        </section>

        {/* Google Calendar Sync */}
        <section className="mb-12">
           <div className="flex items-center justify-between pl-2 mb-4">
               <div>
                 <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                   <CalendarIcon className="w-5 h-5 text-indigo-600"/> Auto-Scheduler & Calendar
                 </h2>
                 <p className="text-sm font-medium text-slate-400 mt-1">Sync Google Calendar to get automatic alarms & focus tasks.</p>
               </div>
               {!calendarToken ? (
                 <button onClick={handleConnectCalendar} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 font-bold text-sm rounded-xl hover:bg-indigo-100 transition-colors">
                    Connect Google Calendar
                 </button>
               ) : (
                 <div className="flex gap-2">
                    <button onClick={fetchCalendarEvents} disabled={isLoadingCalendar} className="p-2 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 rounded-lg hover:border-indigo-200 transition-colors" title="Refresh Calendar">
                       <RefreshCw className={`w-4 h-4 ${isLoadingCalendar ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={() => setCalendarToken(null)} className="px-3 py-2 text-slate-500 hover:text-red-600 text-sm font-semibold hover:bg-red-50 rounded-lg transition-colors">
                       Disconnect
                    </button>
                 </div>
               )}
           </div>
           
           {calendarToken && (
             <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {calendarEvents.length === 0 ? (
                  <div className="text-sm font-medium text-slate-400 py-4 px-2">No upcoming events today.</div>
                ) : (
                  calendarEvents.map((event, idx) => {
                     const isPast = event.start?.dateTime && new Date(event.start.dateTime) < new Date();
                     return (
                      <div key={idx} className={`flex-shrink-0 w-64 p-4 rounded-2xl border ${isPast ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-indigo-100 shadow-sm'} flex flex-col gap-3 group`}>
                         <div className="flex justify-between items-start">
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md">
                              {event.start?.dateTime ? new Date(event.start.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'All Day'}
                            </span>
                            {!isPast && (
                               <Bell className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                            )}
                         </div>
                         <span className="font-bold text-slate-800 line-clamp-2">{event.summary || "Busy"}</span>
                         {!isPast && (
                           <button onClick={() => addEventAsTask(event)} className="mt-auto pt-2 text-sm font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1">
                              <Plus className="w-4 h-4" /> Add as Focus Task
                           </button>
                         )}
                      </div>
                     );
                  })
                )}
             </div>
           )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-12">
           <section className="lg:col-span-12 flex flex-col gap-6">
              <div className="flex items-center justify-between pl-2">
                 <div className="flex items-baseline gap-4">
                   <h2 className="text-xl font-bold text-slate-800">Today's Focus</h2>
                   <span className="text-sm font-semibold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                     {activeToday.length} / 5 Max
                   </span>
                 </div>
                 
                 {activeToday.length > 1 && (
                   <button onClick={pickForMe} disabled={isSpinning} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 font-bold text-sm rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50">
                     <Dices className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`}/> Pick For Me
                   </button>
                 )}
              </div>
              
              {activeToday.length === 0 && (
                <div className="p-10 border-2 border-dashed border-slate-200 rounded-[2rem] text-center flex flex-col items-center justify-center gap-4 text-slate-400 bg-white/50">
                   <Target className="w-10 h-10 opacity-50" />
                   <p className="font-medium text-lg">Your focus board is perfectly clear.</p>
                </div>
              )}

              <AnimatePresence>
                {activeToday.map(task => (
                  <TaskCard
                    key={task.id} task={task} availableTasks={tasks} onComplete={() => completeTask(task.id)} onDelete={() => setTasks(prev => prev.filter(t => t.id !== task.id))}
                    onStatusChange={(status) => setTasks(prev => prev.map(t => t.id === task.id ? {...t, status} : t))}
                    onEnterHyperfocus={() => setHyperfocusTask(task)} onAddSubtask={(str) => setTasks(prev => prev.map(t => t.id === task.id ? {...t, subtasks: [...(t.subtasks||[]), {id: crypto.randomUUID(), text: str, completed: false}]} : t))}
                    onToggleSubtask={(subId) => setTasks(prev => prev.map(t => t.id === task.id ? {...t, subtasks: t.subtasks?.map(s => s.id === subId ? {...s, completed: !s.completed} : s)} : t))}
                    onSetEffort={(eff) => setTasks(prev => prev.map(t => t.id === task.id ? {...t, estimatedTime: eff} : t))}
                    onSetPriority={(p) => setTasks(prev => prev.map(t => t.id === task.id ? {...t, priority: p} : t))}
                    onUpdateDependencies={(deps) => setTasks(prev => prev.map(t => t.id === task.id ? {...t, dependencies: deps} : t))}
                    onUpdateRecurring={(rec) => setTasks(prev => prev.map(t => t.id === task.id ? {...t, recurring: rec} : t))}
                  />
                ))}
              </AnimatePresence>
           </section>
        </div>

        {/* Phase 2: Elastic Habit Tracking with Categories */}
        <section className="mb-16">
           <div className="flex flex-col sm:flex-row sm:items-end justify-between pl-2 mb-4 border-b border-slate-100 pb-4 gap-4">
               <div>
                 <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                   <Activity className="w-5 h-5 text-teal-600"/> Momentum Habits
                 </h2>
                 <p className="text-sm font-medium text-slate-400 mt-1">100% success at any tier. No broken streaks.</p>
               </div>
               <button onClick={() => setEditingHabit('new')} className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-600 font-bold text-sm rounded-xl border border-slate-200 hover:border-teal-300 hover:text-teal-600 shadow-sm transition-all shrink-0">
                  <Plus className="w-4 h-4"/> Add Habit
               </button>
           </div>

           {/* Category Filters */}
           <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide px-2">
             <button 
                onClick={() => setSelectedCategoryFilter(null)}
                className={`px-4 py-2 rounded-xl font-bold text-sm border whitespace-nowrap transition-colors ${selectedCategoryFilter === null ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-200'}`}
             >
               All Habits
             </button>
             {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryFilter(cat.id)}
                  className={`px-4 py-2 rounded-xl font-bold text-sm border whitespace-nowrap transition-colors ${selectedCategoryFilter === cat.id ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-200'}`}
                >
                  {cat.name}
                </button>
             ))}
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
              <AnimatePresence>
                {displayedHabits.map(habit => (
                  <HabitCard 
                     key={habit.id} 
                     habit={habit} 
                     category={categories.find(c => c.id === habit.categoryId)}
                     onLog={(tier, reward, boost) => handleLogHabit(habit.id, reward, boost)} 
                     onEdit={() => setEditingHabit(habit)} 
                  />
                ))}
              </AnimatePresence>
              {displayedHabits.length === 0 && (
                <div className="col-span-full py-8 text-center text-slate-400 font-medium">No habits found in this category.</div>
              )}
           </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
           <section className="lg:col-span-12 flex flex-col gap-6 mt-6">
              <div className="flex items-baseline justify-between pl-2">
                 <h2 className="text-xl font-bold text-slate-800">The Archive</h2>
                 <span className="text-sm font-semibold text-slate-400">
                   Auto-purges older items
                 </span>
              </div>

              <div className="bg-slate-100 rounded-[2rem] p-6 flex flex-col gap-4 border border-slate-200 shadow-inner">
                {activeBacklog.length === 0 && (
                  <p className="text-center font-medium text-slate-400 py-8">No overflowing thoughts.</p>
                )}
                
                <AnimatePresence>
                  {activeBacklog.map(task => (
                    <motion.div key={task.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 group transition-all ${task.dependencies?.some(dId => tasks.find(t => t.id === dId && !t.completed)) ? 'opacity-70 grayscale-[0.2]' : 'hover:border-slate-300'}`}>
                      <button disabled={task.dependencies?.some(dId => tasks.find(t => t.id === dId && !t.completed))} onClick={() => completeTask(task.id)} className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${task.dependencies?.some(dId => tasks.find(t => t.id === dId && !t.completed)) ? 'border-slate-200 bg-slate-50 cursor-not-allowed' : 'border-slate-200 hover:border-amber-500 hover:bg-amber-50'}`}>
                         {task.completed ? <Check className="w-3 h-3 text-amber-600" strokeWidth={3} /> : (task.dependencies?.some(dId => tasks.find(t => t.id === dId && !t.completed)) ? <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> : null)}
                      </button>
                      <div className="flex-1 flex flex-col pt-0.5">
                         <span className="text-base font-semibold text-slate-600 leading-snug">{task.text}</span>
                         <div className="flex gap-2">
                           {task.priority && (
                             <span className={`text-[10px] w-max font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${task.priority === 'high' ? 'text-rose-600 bg-rose-50 border-rose-200' : task.priority === 'medium' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-slate-600 bg-slate-100 border-slate-200'} shrink-0 mt-1`}>
                               {task.priority} Priority
                             </span>
                           )}
                           {task.dependencies && task.dependencies.some(dId => tasks.find(t => t.id === dId && !t.completed)) && (
                             <span className="text-[10px] w-max font-bold tracking-wider uppercase px-2 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-500 shrink-0 mt-1">
                               Blocked
                             </span>
                           )}
                           {task.recurring && (
                             <span className="text-[10px] flex items-center gap-1 w-max font-bold tracking-wider uppercase px-2 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-600 shrink-0 mt-1">
                               <RefreshCw className="w-3 h-3" /> Repeating
                             </span>
                           )}
                         </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button disabled={task.dependencies?.some(dId => tasks.find(t => t.id === dId && !t.completed))} onClick={() => { if (activeToday.length < 5) setTasks(prev => prev.map(t => t.id === task.id ? {...t, status: 'today'} : t)); else alert("Clear some focus tasks first to prevent overwhelm."); }} className={`p-1.5 rounded-lg transition-colors ${task.dependencies?.some(dId => tasks.find(t => t.id === dId && !t.completed)) ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-teal-600 bg-slate-50 hover:bg-teal-50'}`}>
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button onClick={() => setTasks(prev => prev.filter(t => t.id !== task.id))} className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
           </section>
        </div>
      </div>
    </div>
  );
}
