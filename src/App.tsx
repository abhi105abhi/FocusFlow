import React, { useState, useEffect } from 'react';
import { Ghost, Trash2, Zap, Target, Check, Crown, Clock, Maximize2, Play, Pause, Minimize2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

type EffortSize = 'short' | 'medium' | 'deep';

interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  
  // Primary specifics
  isFrog?: boolean;
  estimatedTime?: EffortSize | null;
  subtasks?: Subtask[];
}

const TIME_MAP: Record<EffortSize, number> = { short: 15, medium: 45, deep: 90 };
const BANKRUPTCY_MS = 48 * 60 * 60 * 1000; // 48 hours in MS

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

function HyperfocusOverlay({ 
  task, 
  onClose, 
  onComplete 
}: { 
  task: Task; 
  onClose: () => void; 
  onComplete: () => void; 
}) {
  // Start with estimation or default 25m
  const defaultSeconds = task.estimatedTime ? TIME_MAP[task.estimatedTime] * 60 : 25 * 60;
  const [timeLeft, setTimeLeft] = useState(defaultSeconds);
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="fixed inset-0 z-[100] bg-[#020202] text-white flex flex-col items-center justify-center p-8 backdrop-blur-3xl"
    >
      <button onClick={onClose} className="absolute top-8 right-8 text-white/30 hover:text-white transition-colors">
        <Minimize2 className="w-8 h-8" />
      </button>

      <div className="absolute top-12 flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-500 uppercase tracking-[0.3em] text-xs font-bold animate-pulse">
        <Target className="w-4 h-4" /> Hyperfocus Active
      </div>

      <div className="max-w-2xl text-center flex flex-col items-center gap-12">
        <h2 className="text-4xl md:text-5xl font-medium text-white/90 leading-tight">
          {task.text}
        </h2>

        <div className="font-mono text-8xl md:text-9xl font-black text-emerald-500 tracking-tighter drop-shadow-[0_0_40px_rgba(16,185,129,0.3)]">
          {m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
        </div>

        <div className="flex gap-6 items-center">
          <button 
            onClick={() => setIsRunning(!isRunning)}
            className="w-16 h-16 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
          >
            {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
          </button>
          
          <button 
            onClick={onComplete}
            className="px-8 py-5 bg-emerald-500 text-[#050505] uppercase tracking-widest font-black rounded flex items-center gap-3 hover:bg-emerald-400 hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] transition-all"
          >
            <Check className="w-6 h-6" strokeWidth={3} />
            Task Completed
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function PrimaryTaskItem({
  task,
  isActive,
  onToggleComplete,
  onToggleActive,
  onDelete,
  onSetFrog,
  onSetEffort,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onEnterHyperfocus
}: {
  task: Task;
  isActive: boolean;
  onToggleComplete: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onSetFrog: () => void;
  onSetEffort: (effort: EffortSize | null) => void;
  onAddSubtask: (text: string) => void;
  onToggleSubtask: (subId: string) => void;
  onDeleteSubtask: (subId: string) => void;
  onEnterHyperfocus: () => void;
}) {
  const [subInput, setSubInput] = useState('');

  const submitSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (subInput.trim()) {
      onAddSubtask(subInput.trim());
      setSubInput('');
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group bg-white/5 border-l-4 p-4 md:p-6 flex flex-col transition-all cursor-default ${
        task.isFrog ? 'border-emerald-500 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.05)]' :
        isActive ? 'border-white/50 bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]' : 
        'border-emerald-500/20 hover:border-emerald-500/40 cursor-pointer'
      }`}
      onClick={!isActive ? onToggleActive : undefined}
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1 flex-1 pr-4">
          <div className="flex items-center gap-3">
            {task.isFrog && <Crown className="w-4 h-4 text-emerald-500" />}
            <span className={`text-lg font-medium transition-colors ${task.completed ? 'line-through text-white/40' : task.isFrog ? 'text-emerald-400' : 'text-white/90'}`}>
              {task.text}
            </span>
          </div>
          
          <div className="flex items-center gap-3 mt-1">
            {task.estimatedTime && (
              <span className="text-[10px] font-mono tracking-widest uppercase text-emerald-500/80 bg-emerald-500/10 px-2 py-0.5 rounded">
                size: {task.estimatedTime} ({TIME_MAP[task.estimatedTime]}m)
              </span>
            )}
            {!isActive && !task.completed && (
              <span className="text-[10px] uppercase tracking-widest text-white/40 opacity-0 transition-opacity group-hover:opacity-100">
                Tap to expand & focus
              </span>
            )}
            {task.subtasks && task.subtasks.length > 0 && !isActive && (
              <span className="text-[10px] uppercase tracking-widest text-white/30">
                {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} Steps
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isActive && (
            <button
              onClick={(e) => { e.stopPropagation(); onSetFrog(); }}
              className={`p-2 transition-colors rounded ${task.isFrog ? 'text-emerald-500 bg-emerald-500/10' : 'text-white/30 hover:text-emerald-400 hover:bg-white/5'}`}
              title="Pin as daily priority"
            >
              <Crown className="w-4 h-4" />
            </button>
          )}
          {isActive && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-2 text-white/30 hover:text-red-400 transition-colors rounded hover:bg-white/5"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}
            className={`w-8 h-8 rounded border flex items-center justify-center transition-colors shrink-0 ml-2 ${
              task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-white/20 hover:bg-emerald-500 hover:border-emerald-500 group-hover:border-white/40'
            }`}
          >
            {task.completed ? (
              <Check className="w-4 h-4 text-[#050505]" strokeWidth={3} />
            ) : (
              <div className="w-3 h-3 border-2 border-white/20 rounded-sm"></div>
            )}
          </button>
        </div>
      </div>

      {isActive && !task.completed && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }} 
          animate={{ height: 'auto', opacity: 1 }} 
          className="mt-6 flex flex-col gap-6 border-t border-white/10 pt-6 overflow-hidden"
        >
          
          {/* Hyperfocus Button */}
          <button 
            onClick={onEnterHyperfocus}
            className="w-full py-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500 hover:text-[#050505] transition-all flex items-center justify-center gap-3 rounded text-xs font-bold tracking-[0.2em] uppercase"
          >
            <Maximize2 className="w-4 h-4" /> Enter Hyperfocus
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sizing */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40"><Clock className="w-3 h-3 inline mr-1" /> Estimate Size</span>
              <div className="flex gap-2">
                {(['short', 'medium', 'deep'] as EffortSize[]).map(size => (
                  <button
                    key={size}
                    onClick={() => onSetEffort(task.estimatedTime === size ? null : size)}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded border transition-colors ${
                      task.estimatedTime === size ? 'bg-white text-black border-white' : 'border-white/10 text-white/50 hover:border-white/30'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Subtasks (Breakdown) */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40">Task Breakdown</span>
              <div className="flex flex-col gap-2">
                {task.subtasks?.map(sub => (
                  <div key={sub.id} className="flex items-start gap-3 group/sub">
                    <button 
                      onClick={() => onToggleSubtask(sub.id)}
                      className={`mt-0.5 w-4 h-4 rounded-sm border flex shrink-0 items-center justify-center ${sub.completed ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/20 hover:border-white/50'}`}
                    >
                      {sub.completed && <Check className="w-3 h-3" strokeWidth={3} />}
                    </button>
                    <span className={`text-sm flex-1 break-words ${sub.completed ? 'text-white/30 line-through' : 'text-white/80'}`}>{sub.text}</span>
                    <button onClick={() => onDeleteSubtask(sub.id)} className="opacity-0 group-hover/sub:opacity-100 text-white/20 hover:text-red-400 p-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <form onSubmit={submitSubtask} className="flex mt-1">
                <input
                  type="text"
                  placeholder="Drop a micro-step..."
                  value={subInput}
                  onChange={e => setSubInput(e.target.value)}
                  className="bg-transparent border-b border-white/20 pb-2 text-sm text-white focus:outline-none focus:border-emerald-500 w-full placeholder:text-white/20"
                />
              </form>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function SecondaryTaskItem({
  task,
  onToggleComplete,
  onDelete
}: {
  task: Task;
  onToggleComplete: () => void;
  onDelete: () => void;
}) {
  const ageMs = Date.now() - task.createdAt;
  const ageHrs = ageMs / (1000 * 60 * 60);
  
  const isAging = ageHrs > 24;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`p-4 border rounded flex flex-col transition-colors group ${
        isAging ? 'bg-[#0a0a0a] border-white/5 opacity-60' : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'
      }`}
    >
      <div className="flex justify-between items-center">
        <span className={`text-sm flex-1 break-words pr-2 ${task.completed ? 'line-through text-white/20' : isAging ? 'text-white/40' : 'text-white/60'}`}>
          {task.text}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-white/30 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={onToggleComplete}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors shrink-0 ${
              task.completed ? 'bg-amber-500 border border-amber-500 text-[#050505]' : 'border-[1.5px] border-white/20 hover:border-amber-500'
            }`}
          >
            {task.completed && <Check className="w-4 h-4" strokeWidth={3} />}
          </button>
        </div>
      </div>
      
      {!task.completed && isAging && (
        <div className="mt-3 text-[9px] uppercase tracking-widest font-bold text-amber-500/50 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> Fading: Pending Auto-Purge
        </div>
      )}
    </motion.div>
  );
}

// --- Main Application ---

export default function App() {
  const [primaryTasks, setPrimaryTasks] = useLocalStorage<Task[]>('primaryTasks', []);
  const [secondaryTasks, setSecondaryTasks] = useLocalStorage<Task[]>('secondaryTasks', []);
  const [activeTaskId, setActiveTaskId] = useLocalStorage<string | null>('activeTaskId', null);
  const [ghostMode, setGhostMode] = useLocalStorage('ghostMode', false);
  const [hyperfocusTask, setHyperfocusTask] = useState<Task | null>(null);

  const [primaryInput, setPrimaryInput] = useState('');
  const [secondaryInput, setSecondaryInput] = useState('');

  // Dump Bankruptcy Auto-Purge
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setSecondaryTasks(prev => prev.filter(t => t.completed || (now - t.createdAt) < BANKRUPTCY_MS));
    }, 60 * 1000); // Check every minute
    return () => clearInterval(interval);
  }, [setSecondaryTasks]);

  // Handlers - Primary
  const addPrimary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryInput.trim()) return;
    const newTask: Task = { id: crypto.randomUUID(), text: primaryInput.trim(), completed: false, createdAt: Date.now(), subtasks: [] };
    setPrimaryTasks(prev => [newTask, ...prev]);
    setPrimaryInput('');
    if (!activeTaskId) setActiveTaskId(newTask.id);
  };

  const togglePrimaryComplete = (id: string) => {
    setPrimaryTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed, isFrog: false } : t));
    if (activeTaskId === id) setActiveTaskId(null);
  };

  const deletePrimary = (id: string) => {
    setPrimaryTasks(prev => prev.filter(t => t.id !== id));
    if (activeTaskId === id) setActiveTaskId(null);
  };

  const setFrog = (id: string) => {
    setPrimaryTasks(prev => prev.map(t => ({ ...t, isFrog: t.id === id ? !t.isFrog : false })));
  };

  const setEffort = (id: string, effort: EffortSize | null) => {
    setPrimaryTasks(prev => prev.map(t => t.id === id ? { ...t, estimatedTime: effort } : t));
  };

  const addSubtask = (taskId: string, text: string) => {
    setPrimaryTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const subs = t.subtasks || [];
      return { ...t, subtasks: [...subs, { id: crypto.randomUUID(), text, completed: false }] };
    }));
  };

  const toggleSubtask = (taskId: string, subId: string) => {
    setPrimaryTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      return { ...t, subtasks: t.subtasks?.map(s => s.id === subId ? { ...s, completed: !s.completed } : s) };
    }));
  };

  const deleteSubtask = (taskId: string, subId: string) => {
    setPrimaryTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      return { ...t, subtasks: t.subtasks?.filter(s => s.id !== subId) };
    }));
  };

  const handleHyperfocusComplete = () => {
    if (hyperfocusTask) {
      togglePrimaryComplete(hyperfocusTask.id);
    }
    setHyperfocusTask(null);
  };

  // Handlers - Secondary
  const addSecondary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secondaryInput.trim()) return;
    const newTask: Task = { id: crypto.randomUUID(), text: secondaryInput.trim(), completed: false, createdAt: Date.now() };
    setSecondaryTasks(prev => [newTask, ...prev]);
    setSecondaryInput('');
  };

  const toggleSecondaryComplete = (id: string) => {
    setSecondaryTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteSecondary = (id: string) => {
    setSecondaryTasks(prev => prev.filter(t => t.id !== id));
  };

  // Computations
  const activeTasks = [...primaryTasks.filter(t => !t.completed)].sort((a, b) => (a.isFrog === b.isFrog ? 0 : a.isFrog ? -1 : 1));
  const completedTasks = primaryTasks.filter(t => t.completed);

  const totalMinutes = activeTasks.reduce((acc, t) => acc + (t.estimatedTime ? TIME_MAP[t.estimatedTime] : 0), 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeEstimateStr = totalMinutes > 0 ? `${hours > 0 ? `${hours}h ` : ''}${mins}m` : '0m';

  return (
    <div className="min-h-screen bg-[#050505] text-slate-100 font-sans p-4 md:p-8 flex flex-col gap-6 selection:bg-emerald-500/30 w-full overflow-x-hidden">
      
      <AnimatePresence>
        {hyperfocusTask && (
          <HyperfocusOverlay 
            task={hyperfocusTask} 
            onClose={() => setHyperfocusTask(null)} 
            onComplete={handleHyperfocusComplete} 
          />
        )}
      </AnimatePresence>

      {/* Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-sm flex items-center justify-center">
            <div className="w-4 h-4 bg-[#050505]"></div>
          </div>
          <h1 className="text-xl font-bold tracking-tight uppercase">FocusFlow <span className="text-emerald-500">ADHD</span></h1>
        </div>

        <div className="flex items-center gap-4 md:gap-8 flex-wrap">
          {totalMinutes > 0 && (
            <div className="hidden sm:flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10">
              <Clock className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/50">Total Workload: <span className="text-emerald-400 font-bold">{timeEstimateStr}</span></span>
            </div>
          )}

          {/* Ghost Mode Toggle */}
          <div 
            onClick={() => setGhostMode(!ghostMode)}
            className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/20 cursor-pointer hover:bg-white/10 transition-colors"
          >
            <span className="text-[10px] uppercase font-bold tracking-tighter opacity-50">Ghost Mode</span>
            <button className={`w-10 h-5 rounded-full relative transition-colors ${ghostMode ? 'bg-emerald-600' : 'bg-white/10'}`}>
              <motion.div 
                layout
                className="absolute top-1 w-3 h-3 bg-white rounded-full"
                initial={false}
                animate={{ right: ghostMode ? '4px' : '24px' }}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Grid */}
      <main className="grid grid-cols-1 md:grid-cols-12 gap-8 flex-1">
        
        {/* Primary Column */}
        <motion.section
          layout
          className={`flex flex-col gap-4 ${ghostMode ? 'md:col-span-12 md:max-w-3xl md:mx-auto w-full' : 'md:col-span-7'}`}
        >
          <div className="flex justify-between items-end mb-2">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-500">Active Primary Tasks</h2>
            <span className="text-[10px] text-white/40 uppercase">{activeTasks.length} Items</span>
          </div>

          <form onSubmit={addPrimary} className="mb-2">
            <input
              type="text"
              placeholder="Add new primary focus..."
              value={primaryInput}
              onChange={(e) => setPrimaryInput(e.target.value)}
              className="w-full bg-[#111] border border-white/10 p-4 text-sm focus:border-emerald-500 outline-none text-white placeholder:text-white/30 transition-colors"
            />
          </form>

          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {activeTasks.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-12 flex justify-center items-center h-full border border-dashed border-white/10 text-white/30 text-xs uppercase tracking-widest"
                >
                  Your focus list is clear.
                </motion.div>
              )}
              {activeTasks.map(task => (
                <PrimaryTaskItem
                  key={task.id}
                  task={task}
                  isActive={activeTaskId === task.id}
                  onToggleComplete={() => togglePrimaryComplete(task.id)}
                  onToggleActive={() => setActiveTaskId(activeTaskId === task.id ? null : task.id)}
                  onDelete={() => deletePrimary(task.id)}
                  onSetFrog={() => setFrog(task.id)}
                  onSetEffort={(eff) => setEffort(task.id, eff)}
                  onAddSubtask={(t) => addSubtask(task.id, t)}
                  onToggleSubtask={(subId) => toggleSubtask(task.id, subId)}
                  onDeleteSubtask={(subId) => deleteSubtask(task.id, subId)}
                  onEnterHyperfocus={() => setHyperfocusTask(task)}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* Completed Primary Tasks */}
          {completedTasks.length > 0 && (
            <div className="mt-8 border-t border-white/10 pt-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4">Completed Focus</h3>
              <div className="flex flex-col gap-2 opacity-60 hover:opacity-100 transition-opacity">
                <AnimatePresence>
                  {completedTasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between p-4 bg-white/5 border-l-4 border-emerald-500/20">
                      <span className="text-sm line-through text-white/40 flex-1">{task.text}</span>
                      <div className="flex gap-2">
                        <button onClick={() => deletePrimary(task.id)} className="text-white/20 hover:text-red-400 p-2"><Trash2 className="w-4 h-4" /></button>
                        <button onClick={() => togglePrimaryComplete(task.id)} className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center shrink-0"><Check className="w-4 h-4 text-black" strokeWidth={3} /></button>
                      </div>
                    </div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </motion.section>

        {/* Secondary Column (Brain Dump) */}
        <AnimatePresence>
          {!ghostMode && (
            <motion.section
              layout
              initial={{ opacity: 0, filter: 'blur(8px)', x: 20 }}
              animate={{ opacity: 1, filter: 'blur(0px)', x: 0 }}
              exit={{ opacity: 0, filter: 'blur(8px)', x: 20, scale: 0.95 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="md:col-span-5 md:border-l md:border-white/10 md:pl-8 flex flex-col gap-4"
            >
              <div className="flex justify-between items-end mb-2">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-amber-500">Brain Dump</h2>
                <span className="text-[10px] text-white/40 uppercase">Auto-purges after 48h</span>
              </div>

              <div className="flex flex-col gap-2">
                <AnimatePresence>
                  {secondaryTasks.filter(t => !t.completed).length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="py-8 flex justify-center items-center border border-dashed border-white/10 text-white/30 text-xs uppercase tracking-widest"
                    >
                      Mind is clear.
                    </motion.div>
                  )}
                  {secondaryTasks.filter(t => !t.completed).map(task => (
                    <SecondaryTaskItem
                      key={task.id}
                      task={task}
                      onToggleComplete={() => toggleSecondaryComplete(task.id)}
                      onDelete={() => deleteSecondary(task.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>

              <div className="mt-auto pt-4 border-t border-white/10">
                <form onSubmit={addSecondary} className="relative group flex flex-col">
                  <input
                    type="text"
                    placeholder="Dump distracting thought..."
                    value={secondaryInput}
                    onChange={(e) => setSecondaryInput(e.target.value)}
                    className="w-full bg-[#111] border border-white/10 p-4 text-sm focus:border-amber-500 outline-none text-white placeholder:text-white/30 transition-colors"
                  />
                </form>
              </div>

              {/* Completed Secondary Tasks */}
              {secondaryTasks.some(t => t.completed) && (
                <div className="mt-4 border-white/10">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3">Dumped & Done</h3>
                  <div className="flex flex-col gap-2 opacity-50 hover:opacity-100 transition-opacity">
                    <AnimatePresence>
                      {secondaryTasks.filter(t => t.completed).map(task => (
                         <div key={task.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded">
                           <span className="text-sm line-through text-white/30 flex-1">{task.text}</span>
                           <div className="flex gap-2">
                             <button onClick={() => deleteSecondary(task.id)} className="text-white/20 hover:text-red-400 p-1"><Trash2 className="w-3 h-3" /></button>
                             <button onClick={() => toggleSecondaryComplete(task.id)} className="w-6 h-6 bg-amber-500 rounded flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-black" strokeWidth={3} /></button>
                           </div>
                         </div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

    </div>
  );
}
