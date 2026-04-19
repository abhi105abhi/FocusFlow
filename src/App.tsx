import React, { useState, useEffect, useRef } from 'react';
import { Mic, Check, Clock, Maximize2, Play, Pause, Minimize2, Sun, LifeBuoy, ArrowDown, ArrowUp, Trash2, Volume2, VolumeX, Sprout, TreePine, Flower2, Target } from 'lucide-react';
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
  status: 'today' | 'backlog';
  estimatedTime?: EffortSize | null;
  subtasks?: Subtask[];
}

const TIME_MAP: Record<EffortSize, number> = { short: 15, medium: 45, deep: 90 };
const BANKRUPTCY_HR = 48; // Auto-purge backlog after 48h

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

// 1. Time Sweep Visualizer
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
        <circle
          cx="128" cy="128" r={radius}
          className={isOvertime ? "stroke-orange-100" : "stroke-slate-100"}
          strokeWidth="12" fill="transparent"
        />
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
            <span className="text-4xl font-bold text-slate-800">+{Math.floor(absRemaining/60)}:{(absRemaining%60).toString().padStart(2,'0')}</span>
          </>
        ) : (
          <span className="text-4xl font-bold text-slate-800">{Math.floor(absRemaining/60)}:{(absRemaining%60).toString().padStart(2,'0')}</span>
        )}
      </div>
    </div>
  );
}

// 2. Integrated Focus Room
function HyperfocusOverlay({ task, onClose, onComplete }: { task: Task; onClose: () => void; onComplete: (reward: number) => void; }) {
  const defaultSeconds = task.estimatedTime ? TIME_MAP[task.estimatedTime] * 60 : 25 * 60;
  const [timeLeft, setTimeLeft] = useState(defaultSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const [isNoiseActive, setIsNoiseActive] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // Integrated Brown Noise Generator for Ambient Focus
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
    gainNode.gain.value = 0.03; // Soft, ambient volume
    
    noiseource.connect(gainNode);
    gainNode.connect(ctx.destination);
    noiseource.start(0);

    return () => {
      noiseource.stop();
      ctx.close();
    };
  }, [isNoiseActive]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#FAFAFA] text-slate-800 flex flex-col md:flex-row shadow-2xl"
    >
      <button onClick={onClose} className="absolute top-8 right-8 text-slate-400 hover:text-slate-800 z-50 transition-colors">
        <Minimize2 className="w-8 h-8" />
      </button>

      {/* Ambient Body Doubling Avatar panel */}
      <div className="flex-1 bg-slate-50 flex flex-col items-center justify-center p-8 border-r border-slate-200">
        <div className="w-64 h-64 bg-slate-200 rounded-[2rem] mb-8 relative overflow-hidden shadow-inner flex items-center justify-center border-4 border-white">
          <motion.div 
            animate={{ y: [0, -4, 0] }} 
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="w-32 h-40 bg-slate-300 rounded-t-3xl absolute bottom-0 flex flex-col items-center"
          >
            <div className="w-16 h-16 rounded-full bg-slate-400 -mt-8 shadow-sm"></div>
          </motion.div>
          <div className="absolute bottom-4 left-4 bg-white/90 px-3 py-1.5 rounded-lg shadow-sm">
            <span className="text-xs font-bold text-slate-500">Virtual Partner Active</span>
          </div>
        </div>
        
        <button 
          onClick={() => setIsNoiseActive(!isNoiseActive)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${isNoiseActive ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-white border-slate-200 text-slate-500'}`}
        >
          {isNoiseActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span className="text-sm font-semibold">{isNoiseActive ? "Brown Noise ON" : "Soundscape OFF"}</span>
        </button>
      </div>

      {/* Task Execution Panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Subtle Confetti Container for Completion */}
        <div className="max-w-md w-full flex flex-col items-center text-center z-10">
            <h2 className="text-2xl font-bold text-slate-800 leading-relaxed mb-10">
              {task.text}
            </h2>
            
            <TimeSweep totalSeconds={defaultSeconds} remainingSeconds={timeLeft} />

            <div className="flex gap-6 items-center mt-6">
              <button 
                onClick={() => setIsRunning(!isRunning)} 
                className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
                aria-label={isRunning ? "Pause focus timer" : "Resume focus timer"}
              >
                {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
              </button>
              
              <button 
                onClick={() => {
                  const base = 15;
                  const isJackpot = Math.random() < 0.15; // 15% chance for a dopamine spike jackpot
                  const multiplier = isJackpot ? 4 : (0.8 + Math.random() * 0.4);
                  const earned = Math.floor(base * multiplier);
                  onComplete(earned);
                }}
                className="px-8 py-5 bg-teal-600 text-white font-bold rounded-2xl flex items-center gap-3 hover:bg-teal-700 shadow-md shadow-teal-600/20 transition-all"
              >
                <Check className="w-6 h-6" strokeWidth={3} />
                Task Completed
              </button>
            </div>
        </div>
      </div>
    </motion.div>
  );
}

// 3. Emergency Mode (Executive Paralysis Rescue)
function EmergencyMode({ onClose }: { onClose: () => void }) {
  const gentleTasks = [
    "Drink a glass of water right now.",
    "Take 3 deep, slow breaths.",
    "Stand up and stretch your arms for 10 seconds.",
    "Step outside or look out a window for 1 minute."
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

// 4. Task Item Component
function TaskCard({ 
  task, 
  onComplete, 
  onDelete, 
  onStatusChange, 
  onEnterHyperfocus,
  onAddSubtask,
  onToggleSubtask,
  onSetEffort
}: { 
  task: Task; 
  onComplete: () => void; 
  onDelete: () => void; 
  onStatusChange: (status: 'today' | 'backlog') => void;
  onEnterHyperfocus: () => void;
  onAddSubtask: (text: string) => void;
  onToggleSubtask: (subId: string) => void;
  onSetEffort: (effort: EffortSize | null) => void;
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-white rounded-2xl p-5 shadow-sm border ${task.status === 'today' ? 'border-teal-100 hover:border-teal-200' : 'border-slate-100 hover:border-slate-200'} transition-all`}
    >
      <div className="flex gap-4 items-start">
        <button
          onClick={onComplete}
          aria-label="Complete task"
          className="mt-1 w-7 h-7 rounded-lg border-2 border-slate-200 hover:border-teal-500 hover:bg-teal-50 flex items-center justify-center transition-colors shrink-0"
        >
          {task.completed && <Check className="w-4 h-4 text-teal-600" strokeWidth={3} />}
        </button>
        
        <div className="flex-1 flex flex-col cursor-pointer" onClick={() => setExpanded(!expanded)}>
           <span className="text-lg font-bold text-slate-800 leading-snug">{task.text}</span>
           <div className="flex items-center gap-3 mt-2">
             {task.estimatedTime && (
               <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md">
                 {task.estimatedTime} ({TIME_MAP[task.estimatedTime]}m)
               </span>
             )}
             {task.subtasks && task.subtasks.length > 0 && (
               <span className="text-xs font-medium text-slate-400">
                 {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks
               </span>
             )}
             {!expanded && <span className="text-xs text-slate-300 ml-auto mr-2">Tap to expand</span>}
           </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange(task.status === 'today' ? 'backlog' : 'today'); }}
            className="p-2 text-slate-400 hover:text-slate-700 transition-colors rounded-lg hover:bg-slate-50"
            title={task.status === 'today' ? "Move to Archive" : "Move to Today"}
          >
            {task.status === 'today' ? <ArrowDown className="w-5 h-5" /> : <ArrowUp className="w-5 h-5" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
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
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-6 pt-5 border-t border-slate-100 flex flex-col gap-5"
          >
            <button 
              onClick={onEnterHyperfocus}
              className="w-full py-4 bg-teal-50 text-teal-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-teal-100 transition-colors"
            >
              <Maximize2 className="w-5 h-5" /> Start Focus Room Session
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* Subtasks (Micro-steps) */}
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
                    <input
                      type="text"
                      placeholder="Add a micro-step..."
                      value={subInput}
                      onChange={e => setSubInput(e.target.value)}
                      className="bg-transparent border-b border-slate-200 pb-2 text-base text-slate-700 focus:outline-none focus:border-teal-500 w-full placeholder:text-slate-400"
                    />
                  </form>
               </div>

               {/* Time Sizing */}
               <div className="flex flex-col gap-3">
                  <span className="text-sm font-bold text-slate-600">Estimate Effort</span>
                  <div className="flex flex-col gap-2">
                    {(['short', 'medium', 'deep'] as EffortSize[]).map(size => (
                      <button
                        key={size}
                        onClick={() => onSetEffort(task.estimatedTime === size ? null : size)}
                        className={`py-3 px-4 font-semibold text-sm rounded-xl border text-left transition-colors ${
                          task.estimatedTime === size ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {size.charAt(0).toUpperCase() + size.slice(1)} Task ({TIME_MAP[size]} mins)
                      </button>
                    ))}
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
  // Convert sunlight into plants (1 plant per 30 sunlight, max 10 plants displayed)
  const plantCount = Math.min(Math.floor(sunlight / 30), 10);
  const elements = [];
  
  for (let i = 0; i < plantCount; i++) {
    // Alternate plant types for visual variety
    if (i % 3 === 0) {
      elements.push(<TreePine key={i} className="text-teal-600 w-8 h-8 drop-shadow-sm" />);
    } else if (i % 2 === 0) {
      elements.push(<Flower2 key={i} className="text-pink-400 w-6 h-6 mb-1 drop-shadow-sm" />);
    } else {
      elements.push(<Sprout key={i} className="text-teal-400 w-5 h-5 mb-1" />);
    }
  }

  return (
    <div className="flex items-end gap-3 h-10 px-4 min-w-[200px]">
      <AnimatePresence>
        {elements.length > 0 ? (
          elements.map((el, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 12 }}
            >
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


// --- Main Application ---
export default function App() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('ff_v2_tasks', []);
  const [sunlight, setSunlight] = useLocalStorage<number>('ff_v2_sunlight', 0);
  
  const [captureInput, setCaptureInput] = useState('');
  const [hyperfocusTask, setHyperfocusTask] = useState<Task | null>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Auto-purge backlog items older than 48h
  useEffect(() => {
    const purgeThreshold = BANKRUPTCY_HR * 60 * 60 * 1000;
    const interval = setInterval(() => {
      const now = Date.now();
      setTasks(prev => prev.filter(t => t.completed || (now - t.createdAt) < purgeThreshold));
    }, 60 * 1000); 
    return () => clearInterval(interval);
  }, [setTasks]);

  // Voice recording logic via Web Speech API
  const handleMicClick = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser doesn't support the raw Speech Recognition API.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.interimResults = true;
    recognition.continuous = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join('');
      setCaptureInput(transcript);
    };
    
    if (!isListening) {
      recognition.start();
    } else {
      recognition.stop();
    }
  };

  // The AI Compiler Mock & Capture
  const handleCapture = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!captureInput.trim()) return;
    
    // Simulate natural language parsing for multiple tasks (e.g. separated by "and", "then", or ",")
    const phrases = captureInput.split(/(?:\band\b|\bthen\b|,)/i).map(s => s.trim()).filter(s => s.length > 2);
    
    // The Rule of Three/Five Constraint
    let todayCount = tasks.filter(t => !t.completed && t.status === 'today').length;
    
    const newTasks: Task[] = phrases.map((text) => {
      let assignedStatus: 'today' | 'backlog' = 'today';
      if (todayCount >= 5) {
        assignedStatus = 'backlog';
      } else {
        todayCount++;
      }
      
      return {
        id: crypto.randomUUID(),
        text: text.charAt(0).toUpperCase() + text.slice(1),
        completed: false,
        createdAt: Date.now(),
        status: assignedStatus,
        subtasks: []
      };
    });
    
    setTasks(prev => [...newTasks, ...prev]);
    setCaptureInput('');
  };

  // Operations
  const completeTask = (id: string, extraReward: number = 0) => {
    let reward = extraReward;
    if (reward === 0) {
      // Base variable ratio logic if not coming from hyperfocus multiplier
      reward = Math.floor(15 * (Math.random() < 0.15 ? 4 : (0.8 + Math.random() * 0.4)));
    }
    setSunlight(prev => prev + reward);
    
    // Auto remove completed tasks after a brief delay for UI satisfaction
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: true } : t));
    setTimeout(() => {
      setTasks(prev => prev.filter(t => t.id !== id));
    }, 2000);
  };

  const activeToday = tasks.filter(t => !t.completed && t.status === 'today').sort((a,b) => b.createdAt - a.createdAt);
  const activeBacklog = tasks.filter(t => !t.completed && t.status === 'backlog').sort((a,b) => b.createdAt - a.createdAt);

  return (
    <div className="min-h-screen pb-24 w-full overflow-x-hidden selection:bg-teal-200">
      
      <AnimatePresence>
        {hyperfocusTask && (
          <HyperfocusOverlay 
            task={hyperfocusTask} 
            onClose={() => setHyperfocusTask(null)} 
            onComplete={(reward) => {
              completeTask(hyperfocusTask.id, reward);
              setHyperfocusTask(null);
            }} 
          />
        )}
        {emergencyMode && (
          <EmergencyMode onClose={() => setEmergencyMode(false)} />
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto px-4 md:px-8 pt-8">
        {/* Header Ribbon with Integrated Garden */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 bg-white p-4 rounded-3xl shadow-sm border border-slate-100 gap-4">
           <div className="flex flex-col">
             <div className="flex items-center gap-3 mb-2">
               <div className="w-10 h-10 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600">
                 <Sun className="w-6 h-6" />
               </div>
               <div>
                  <h1 className="text-xl font-bold text-slate-800">FocusFlow</h1>
               </div>
             </div>
             
             {/* The Interactive Plant Visualization */}
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
              <button 
                onClick={() => setEmergencyMode(true)}
                className="w-12 h-12 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-red-500 transition-colors shadow-sm"
                title="Bad Brain Day Rescue"
              >
                <LifeBuoy className="w-6 h-6" />
              </button>
           </div>
        </header>

        {/* Phase 1: The Frictionless Voice/Text Dump */}
        <section className="mb-16">
           <form onSubmit={handleCapture} className={`relative shadow-sm rounded-[2rem] bg-white border p-2 overflow-hidden transition-all ${isListening ? 'ring-4 ring-rose-500/20 border-rose-200' : 'focus-within:ring-4 ring-teal-500/20 border-slate-100'}`}>
             <input
               type="text"
               placeholder="What is buzzing in your head?"
               value={captureInput}
               onChange={(e) => setCaptureInput(e.target.value)}
               className="w-full bg-transparent p-6 pr-20 text-xl font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none"
             />
             <button 
                type="button" 
                onClick={handleMicClick}
                className={`absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-2xl flex items-center justify-center transition-colors shadow-md ${
                  isListening 
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30 animate-pulse' 
                  : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20'
                }`}
                title="Voice Dictation"
             >
                <Mic className="w-6 h-6" />
             </button>
           </form>
           {captureInput.length > 0 && !isListening && (
              <motion.button 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={(e: any) => handleCapture(e)}
                className="mt-4 px-6 py-3 bg-slate-800 text-white rounded-xl shadow-md font-semibold text-sm hover:bg-slate-700 border border-slate-700 w-full"
              >
                Process Thoughts (Hit Enter)
              </motion.button>
           )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
           
           {/* Primary: Must-Do Today (Limited) */}
           <section className="lg:col-span-7 flex flex-col gap-6">
              <div className="flex items-baseline justify-between pl-2">
                 <h2 className="text-xl font-bold text-slate-800">Today's Focus</h2>
                 <span className="text-sm font-semibold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200">
                   {activeToday.length} / 5 Max
                 </span>
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
                    key={task.id}
                    task={task}
                    onComplete={() => completeTask(task.id)}
                    onDelete={() => setTasks(prev => prev.filter(t => t.id !== task.id))}
                    onStatusChange={(status) => setTasks(prev => prev.map(t => t.id === task.id ? {...t, status} : t))}
                    onEnterHyperfocus={() => setHyperfocusTask(task)}
                    onAddSubtask={(str) => setTasks(prev => prev.map(t => t.id === task.id ? {...t, subtasks: [...(t.subtasks||[]), {id: crypto.randomUUID(), text: str, completed: false}]} : t))}
                    onToggleSubtask={(subId) => setTasks(prev => prev.map(t => t.id === task.id ? {...t, subtasks: t.subtasks?.map(s => s.id === subId ? {...s, completed: !s.completed} : s)} : t))}
                    onSetEffort={(eff) => setTasks(prev => prev.map(t => t.id === task.id ? {...t, estimatedTime: eff} : t))}
                  />
                ))}
              </AnimatePresence>
           </section>

           {/* Secondary: The Archive / Backlog */}
           <section className="lg:col-span-5 flex flex-col gap-6">
              <div className="flex items-baseline justify-between pl-2">
                 <h2 className="text-xl font-bold text-slate-800">The Archive</h2>
                 <span className="text-sm font-semibold text-slate-400">
                   Auto-purges
                 </span>
              </div>

              <div className="bg-slate-100 rounded-[2rem] p-6 flex flex-col gap-4 border border-slate-200 shadow-inner">
                {activeBacklog.length === 0 && (
                  <p className="text-center font-medium text-slate-400 py-8">No overflowing thoughts.</p>
                )}
                
                <AnimatePresence>
                  {activeBacklog.map(task => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 group hover:border-slate-300 transition-colors"
                    >
                      <button onClick={() => completeTask(task.id)} className="mt-0.5 w-6 h-6 rounded-lg border-2 border-slate-200 hover:border-amber-500 hover:bg-amber-50 flex items-center justify-center shrink-0">
                         {task.completed && <Check className="w-3 h-3 text-amber-600" strokeWidth={3} />}
                      </button>
                      <span className="text-base font-semibold text-slate-600 flex-1 leading-snug">{task.text}</span>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            if (activeToday.length < 5) setTasks(prev => prev.map(t => t.id === task.id ? {...t, status: 'today'} : t));
                            else alert("Clear some focus tasks first to prevent overwhelm.");
                          }}
                          className="p-1.5 text-slate-400 hover:text-teal-600 bg-slate-50 hover:bg-teal-50 rounded-lg"
                          title="Move to Today"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setTasks(prev => prev.filter(t => t.id !== task.id))}
                          className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-lg"
                        >
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
