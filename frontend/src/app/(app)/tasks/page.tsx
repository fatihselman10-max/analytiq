"use client";

import { useState, useEffect } from "react";
import {
  Plus, Calendar, Flag, X, Trash2, MessageSquare, ChevronRight, Check,
  Users, BarChart3, Clock, Target, AlertCircle, CheckCircle, Search,
  Palette, FileText, Truck, Headphones, Megaphone, Code, Filter,
  TrendingUp, ArrowUpRight, ArrowDownRight, Edit3, Save,
} from "lucide-react";

type Priority = "high" | "normal" | "low";
type TaskStatus = "todo" | "in_progress" | "done";

type Task = {
  id: number;
  title: string;
  assignee: string;
  department: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
  createdAt: string;
  completedAt?: string;
  tags: string[];
  notes: string[];
  kpiWeight: number; // 1-5 importance
};

const DEPARTMENTS = [
  { key: "all", label: "Tümü", icon: Users, color: "text-gray-600" },
  { key: "creative", label: "Kreatif", icon: Palette, color: "text-pink-600" },
  { key: "content", label: "Content", icon: FileText, color: "text-violet-600" },
  { key: "operations", label: "Operasyon", icon: Truck, color: "text-blue-600" },
  { key: "support", label: "Müşteri Destek", icon: Headphones, color: "text-emerald-600" },
  { key: "marketing", label: "Pazarlama", icon: Megaphone, color: "text-orange-600" },
  { key: "tech", label: "Teknik", icon: Code, color: "text-cyan-600" },
];

const DEPARTMENT_COLORS: Record<string, string> = {
  creative: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  content: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  operations: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  support: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  marketing: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  tech: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
};

const PRIORITY_CONFIG: Record<Priority, { color: string; label: string; bg: string }> = {
  high: { color: "text-red-500", label: "Yüksek", bg: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  normal: { color: "text-blue-500", label: "Normal", bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  low: { color: "text-gray-400", label: "Düşük", bg: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: "Yapılacak", color: "border-gray-300 dark:border-slate-600" },
  in_progress: { label: "Devam Ediyor", color: "border-blue-400 dark:border-blue-600" },
  done: { label: "Tamamlandı", color: "border-emerald-400 dark:border-emerald-600" },
};

const STORAGE_KEY = "repliq_tasks";

const DEFAULT_TASKS: Task[] = [
  // Kreatif
  { id: 1, title: "Yeni sezon lookbook fotoğraf çekimi", assignee: "Merve K.", department: "creative", priority: "high", status: "in_progress", dueDate: "2026-04-02", createdAt: "2026-03-25", tags: ["Fotoğraf"], notes: ["Stüdyo ayarlandı, 15 kombin hazır"], kpiWeight: 5 },
  { id: 2, title: "Instagram Reels - 5 adet ürün tanıtım videosu", assignee: "Merve K.", department: "creative", priority: "normal", status: "todo", dueDate: "2026-04-05", createdAt: "2026-03-28", tags: ["Video", "Instagram"], notes: [], kpiWeight: 4 },
  { id: 3, title: "Web sitesi banner tasarımı - Bahar kampanyası", assignee: "Merve K.", department: "creative", priority: "normal", status: "done", dueDate: "2026-03-28", createdAt: "2026-03-22", completedAt: "2026-03-27", tags: ["Tasarım"], notes: ["3 varyant hazırlandı"], kpiWeight: 3 },
  // Content
  { id: 4, title: "Blog yazısı - Bahar trendleri 2026", assignee: "Selin T.", department: "content", priority: "normal", status: "in_progress", dueDate: "2026-04-01", createdAt: "2026-03-26", tags: ["Blog"], notes: ["Taslak hazır, son kontrol yapılacak"], kpiWeight: 3 },
  { id: 5, title: "142 ürün açıklamasını SEO uyumlu güncelle", assignee: "Selin T.", department: "content", priority: "high", status: "todo", dueDate: "2026-04-10", createdAt: "2026-03-28", tags: ["SEO", "Ürün"], notes: [], kpiWeight: 5 },
  { id: 6, title: "E-posta kampanya metni - Hoş geldin serisi", assignee: "Selin T.", department: "content", priority: "normal", status: "done", dueDate: "2026-03-27", createdAt: "2026-03-20", completedAt: "2026-03-26", tags: ["E-posta"], notes: ["3 e-posta tamamlandı"], kpiWeight: 4 },
  // Operasyon
  { id: 7, title: "Bekleyen 18 siparişi kargoya ver", assignee: "Elif A.", department: "operations", priority: "high", status: "in_progress", dueDate: "2026-03-29", createdAt: "2026-03-29", tags: ["Kargo"], notes: ["12 tanesi paketlendi"], kpiWeight: 5 },
  { id: 8, title: "Stok sayımı - depo kontrolü", assignee: "Elif A.", department: "operations", priority: "normal", status: "todo", dueDate: "2026-04-03", createdAt: "2026-03-28", tags: ["Stok"], notes: [], kpiWeight: 4 },
  { id: 9, title: "Tedarikçi sipariş takibi - tükenen ürünler", assignee: "Elif A.", department: "operations", priority: "high", status: "todo", dueDate: "2026-03-31", createdAt: "2026-03-28", tags: ["Tedarik"], notes: ["5 ürün tükenmiş, tedarikçiye mail atıldı"], kpiWeight: 5 },
  // Müşteri Destek
  { id: 10, title: "Açık müşteri şikayetlerini çöz (8 adet)", assignee: "Dilara A.", department: "support", priority: "high", status: "in_progress", dueDate: "2026-03-30", createdAt: "2026-03-28", tags: ["Şikayet"], notes: ["5 tanesi cevaplandı, 3 bekliyor"], kpiWeight: 5 },
  { id: 11, title: "İade talepleri - beden değişim sürecini başlat", assignee: "Dilara A.", department: "support", priority: "normal", status: "todo", dueDate: "2026-03-31", createdAt: "2026-03-29", tags: ["İade"], notes: [], kpiWeight: 3 },
  { id: 12, title: "Bot cevap şablonlarını güncelle", assignee: "Dilara A.", department: "support", priority: "low", status: "done", dueDate: "2026-03-28", createdAt: "2026-03-24", completedAt: "2026-03-28", tags: ["Bot"], notes: ["15 şablon güncellendi"], kpiWeight: 3 },
  // Pazarlama
  { id: 13, title: "Meta Ads - yeni kampanya kur (Bahar)", assignee: "Akif D.", department: "marketing", priority: "high", status: "in_progress", dueDate: "2026-04-01", createdAt: "2026-03-27", tags: ["Reklam", "Meta"], notes: ["Hedefleme hazır, görseller bekleniyor"], kpiWeight: 5 },
  { id: 14, title: "Google Ads hesabı aç ve ilk kampanyayı kur", assignee: "Akif D.", department: "marketing", priority: "normal", status: "todo", dueDate: "2026-04-07", createdAt: "2026-03-29", tags: ["Reklam", "Google"], notes: [], kpiWeight: 4 },
  { id: 15, title: "Influencer iş birliği - 3 mikro influencer bul", assignee: "Akif D.", department: "marketing", priority: "normal", status: "todo", dueDate: "2026-04-10", createdAt: "2026-03-29", tags: ["Influencer"], notes: [], kpiWeight: 3 },
  // Teknik
  { id: 16, title: "Site hız optimizasyonu - görsel sıkıştırma", assignee: "Fatih S.", department: "tech", priority: "normal", status: "todo", dueDate: "2026-04-05", createdAt: "2026-03-29", tags: ["Performans"], notes: [], kpiWeight: 3 },
  { id: 17, title: "WhatsApp Business API entegrasyonu", assignee: "Fatih S.", department: "tech", priority: "high", status: "in_progress", dueDate: "2026-04-03", createdAt: "2026-03-25", tags: ["Entegrasyon"], notes: ["Twilio hesabı kuruldu"], kpiWeight: 5 },
];

function daysBetween(a: string, b: string) {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

function isOverdue(task: Task) {
  if (task.status === "done") return false;
  return new Date(task.dueDate) < new Date(new Date().toISOString().slice(0, 10));
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeDept, setActiveDept] = useState("all");
  const [activeView, setActiveView] = useState<"board" | "kpi">("board");
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [newNote, setNewNote] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [editingTask, setEditingTask] = useState<number | null>(null);
  const [newTask, setNewTask] = useState({
    title: "", assignee: "", department: "operations", priority: "normal" as Priority, dueDate: "", kpiWeight: 3,
  });

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setTasks(JSON.parse(saved)); } catch { setTasks(DEFAULT_TASKS); }
    } else {
      setTasks(DEFAULT_TASKS);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (tasks.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const updateTask = (id: number, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const moveStatus = (id: number, to: TaskStatus) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, status: to, completedAt: to === "done" ? new Date().toISOString().slice(0, 10) : undefined } : t
    ));
  };

  const deleteTask = (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    setExpandedTask(null);
  };

  const addNote = (id: number) => {
    if (!newNote.trim()) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, notes: [...t.notes, newNote.trim()] } : t));
    setNewNote("");
  };

  const addTask = () => {
    if (!newTask.title.trim()) return;
    const task: Task = {
      id: Date.now(),
      title: newTask.title,
      assignee: newTask.assignee || "Atanmadı",
      department: newTask.department,
      priority: newTask.priority,
      status: "todo",
      dueDate: newTask.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      createdAt: new Date().toISOString().slice(0, 10),
      tags: [],
      notes: [],
      kpiWeight: newTask.kpiWeight,
    };
    setTasks(prev => [task, ...prev]);
    setNewTask({ title: "", assignee: "", department: "operations", priority: "normal", dueDate: "", kpiWeight: 3 });
    setShowAdd(false);
  };

  // Filters
  const deptTasks = activeDept === "all" ? tasks : tasks.filter(t => t.department === activeDept);
  const filteredTasks = deptTasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.assignee.toLowerCase().includes(search.toLowerCase())) return false;
    if (assigneeFilter !== "all" && t.assignee !== assigneeFilter) return false;
    return true;
  });

  const byStatus = (s: TaskStatus) => filteredTasks.filter(t => t.status === s);
  const allAssignees = Array.from(new Set(tasks.map(t => t.assignee))).sort();
  const deptAssignees = Array.from(new Set(deptTasks.map(t => t.assignee))).sort();

  // KPI calculations
  const today = new Date().toISOString().slice(0, 10);
  const totalDone = deptTasks.filter(t => t.status === "done").length;
  const totalActive = deptTasks.length;
  const overdueCount = deptTasks.filter(t => isOverdue(t)).length;
  const onTimeDone = deptTasks.filter(t => t.status === "done" && t.completedAt && t.completedAt <= t.dueDate).length;
  const onTimeRate = totalDone > 0 ? Math.round((onTimeDone / totalDone) * 100) : 0;
  const avgCompletionDays = (() => {
    const done = deptTasks.filter(t => t.status === "done" && t.completedAt);
    if (done.length === 0) return 0;
    return Math.round(done.reduce((s, t) => s + daysBetween(t.createdAt, t.completedAt!), 0) / done.length);
  })();

  // Per-assignee KPI
  const assigneeKPIs = deptAssignees.map(name => {
    const personal = deptTasks.filter(t => t.assignee === name);
    const done = personal.filter(t => t.status === "done");
    const onTime = done.filter(t => t.completedAt && t.completedAt <= t.dueDate);
    const overdue = personal.filter(t => isOverdue(t));
    const inProgress = personal.filter(t => t.status === "in_progress");
    const todo = personal.filter(t => t.status === "todo");
    const kpiScore = personal.length > 0
      ? Math.round((done.reduce((s, t) => s + t.kpiWeight, 0) / personal.reduce((s, t) => s + t.kpiWeight, 0)) * 100)
      : 0;
    const dept = personal[0]?.department || "";
    return { name, total: personal.length, done: done.length, onTime: onTime.length, overdue: overdue.length, inProgress: inProgress.length, todo: todo.length, kpiScore, dept };
  });

  // Per-department KPI
  const deptKPIs = DEPARTMENTS.filter(d => d.key !== "all").map(d => {
    const dt = tasks.filter(t => t.department === d.key);
    const done = dt.filter(t => t.status === "done");
    const overdue = dt.filter(t => isOverdue(t));
    const completion = dt.length > 0 ? Math.round((done.length / dt.length) * 100) : 0;
    return { ...d, total: dt.length, done: done.length, overdue: overdue.length, completion };
  }).filter(d => d.total > 0);

  const TaskCard = ({ task }: { task: Task }) => {
    const overdue = isOverdue(task);
    const expanded = expandedTask === task.id;
    const deptInfo = DEPARTMENTS.find(d => d.key === task.department);
    return (
      <div className={`bg-white dark:bg-slate-900 border rounded-xl p-3 transition-all ${overdue ? "border-red-300 dark:border-red-800" : "border-gray-100 dark:border-slate-800"} ${expanded ? "ring-2 ring-blue-300 dark:ring-blue-700" : ""}`}>
        <div className="flex items-start justify-between mb-1.5">
          <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight flex-1 mr-2">{task.title}</p>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {task.status !== "done" && (
              <button onClick={() => moveStatus(task.id, task.status === "todo" ? "in_progress" : "done")}
                className="p-1 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded" title="İlerlet">
                {task.status === "in_progress" ? <Check className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            )}
            <button onClick={() => deleteTask(task.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded" title="Sil">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-2">
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${DEPARTMENT_COLORS[task.department] || "bg-gray-100 text-gray-600"}`}>
            {deptInfo?.label || task.department}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${PRIORITY_CONFIG[task.priority].bg}`}>
            {PRIORITY_CONFIG[task.priority].label}
          </span>
          {overdue && <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Gecikmiş</span>}
          {task.tags.map(tag => (
            <span key={tag} className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 rounded text-[9px] text-gray-500">{tag}</span>
          ))}
        </div>

        {/* Notes */}
        {task.notes.length > 0 && (
          <div className="mb-2">
            {(expanded ? task.notes : task.notes.slice(0, 1)).map((note, i) => (
              <p key={i} className="text-[10px] text-gray-500 bg-amber-50 dark:bg-amber-950/20 px-2 py-1 rounded mb-0.5">{note}</p>
            ))}
            {task.notes.length > 1 && !expanded && (
              <button onClick={() => setExpandedTask(task.id)} className="text-[10px] text-blue-500">+{task.notes.length - 1} not</button>
            )}
          </div>
        )}

        {expanded && (
          <div className="mb-2">
            <div className="flex gap-1.5">
              <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Not ekle..."
                className="flex-1 px-2 py-1 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-[11px]"
                onKeyDown={e => e.key === "Enter" && addNote(task.id)} />
              <button onClick={() => addNote(task.id)} className="px-2 py-1 bg-blue-600 text-white rounded-lg text-[10px]">Ekle</button>
            </div>
            {/* Status change */}
            <div className="flex gap-1.5 mt-2">
              {(["todo", "in_progress", "done"] as TaskStatus[]).map(s => (
                <button key={s} onClick={() => moveStatus(task.id, s)}
                  className={`flex-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${task.status === s ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500 hover:bg-gray-200"}`}>
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
              <span className="text-[9px] text-white font-bold">{task.assignee.charAt(0)}</span>
            </div>
            <span className="text-[10px] text-gray-500">{task.assignee}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setExpandedTask(expanded ? null : task.id)} className="p-0.5 text-gray-400 hover:text-blue-500">
              <MessageSquare className="h-3 w-3" />
            </button>
            {Array.from({ length: task.kpiWeight }, (_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            ))}
            <Calendar className={`h-3 w-3 ${overdue ? "text-red-500" : "text-gray-400"}`} />
            <span className={`text-[10px] ${overdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
              {new Date(task.dueDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Görevler</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {byStatus("todo").length} yapılacak · {byStatus("in_progress").length} devam ediyor · {byStatus("done").length} tamamlandı
            {overdueCount > 0 && <span className="text-red-500 ml-1">· {overdueCount} gecikmiş</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button onClick={() => setActiveView("board")} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeView === "board" ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"}`}>Pano</button>
            <button onClick={() => setActiveView("kpi")} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeView === "kpi" ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"}`}>KPI</button>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Yeni Görev
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Target className="h-3.5 w-3.5 text-blue-500" /><span className="text-[10px] text-gray-500">Toplam</span></div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{totalActive}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><CheckCircle className="h-3.5 w-3.5 text-emerald-500" /><span className="text-[10px] text-gray-500">Tamamlanan</span></div>
          <p className="text-lg font-bold text-emerald-600">{totalDone}</p>
          <p className="text-[10px] text-gray-400">{totalActive > 0 ? Math.round((totalDone / totalActive) * 100) : 0}%</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Clock className="h-3.5 w-3.5 text-violet-500" /><span className="text-[10px] text-gray-500">Zamanında</span></div>
          <p className="text-lg font-bold text-violet-600">%{onTimeRate}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><AlertCircle className="h-3.5 w-3.5 text-red-500" /><span className="text-[10px] text-gray-500">Gecikmiş</span></div>
          <p className="text-lg font-bold text-red-600">{overdueCount}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="h-3.5 w-3.5 text-amber-500" /><span className="text-[10px] text-gray-500">Ort. Tamamlama</span></div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{avgCompletionDays} gün</p>
        </div>
      </div>

      {/* Department Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0 mb-4">
        {DEPARTMENTS.map(d => {
          const count = d.key === "all" ? tasks.length : tasks.filter(t => t.department === d.key).length;
          if (d.key !== "all" && count === 0) return null;
          const Icon = d.icon;
          return (
            <button key={d.key} onClick={() => { setActiveDept(d.key); setAssigneeFilter("all"); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${activeDept === d.key ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-slate-600" : "bg-gray-50 dark:bg-slate-800/50 text-gray-500 hover:bg-gray-100"}`}>
              <Icon className={`h-3.5 w-3.5 ${activeDept === d.key ? d.color : ""}`} />
              {d.label}
              <span className="ml-0.5 text-[10px] opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* New Task Form */}
      {showAdd && (
        <div className="card p-4 mb-4 border-2 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Yeni Görev</h3>
            <button onClick={() => setShowAdd(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
            <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="Görev başlığı..."
              className="lg:col-span-2 px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
            <input value={newTask.assignee} onChange={e => setNewTask(p => ({ ...p, assignee: e.target.value }))} placeholder="Sorumlu..."
              className="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
            <select value={newTask.department} onChange={e => setNewTask(p => ({ ...p, department: e.target.value }))}
              className="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm">
              {DEPARTMENTS.filter(d => d.key !== "all").map(d => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value as Priority }))}
                className="flex-1 px-2 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm">
                <option value="high">Yüksek</option><option value="normal">Normal</option><option value="low">Düşük</option>
              </select>
              <input type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))}
                className="px-2 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
            </div>
            <div className="flex gap-2">
              <select value={newTask.kpiWeight} onChange={e => setNewTask(p => ({ ...p, kpiWeight: parseInt(e.target.value) }))}
                className="flex-1 px-2 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm">
                <option value={1}>KPI: 1</option><option value={2}>KPI: 2</option><option value={3}>KPI: 3</option><option value={4}>KPI: 4</option><option value={5}>KPI: 5</option>
              </select>
              <button onClick={addTask} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">Ekle</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PANO GÖRÜNÜMÜ ==================== */}
      {activeView === "board" && (
        <>
          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Görev veya sorumlu ara..."
                className="w-full pl-8 pr-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-xs" />
            </div>
            {deptAssignees.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto">
                <button onClick={() => setAssigneeFilter("all")}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap ${assigneeFilter === "all" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500"}`}>
                  Tümü
                </button>
                {deptAssignees.map(a => (
                  <button key={a} onClick={() => setAssigneeFilter(a)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap ${assigneeFilter === a ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500"}`}>
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Kanban Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {(["todo", "in_progress", "done"] as TaskStatus[]).map(status => {
              const statusTasks = byStatus(status);
              const conf = STATUS_CONFIG[status];
              return (
                <div key={status} className={`rounded-xl p-3 min-h-[200px] ${status === "todo" ? "bg-gray-50 dark:bg-slate-800/50" : status === "in_progress" ? "bg-blue-50 dark:bg-blue-950/20" : "bg-emerald-50 dark:bg-emerald-950/20"}`}>
                  <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${conf.color}`}>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{conf.label}</h3>
                    <span className="w-6 h-6 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-slate-300">{statusTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {statusTasks.map(task => <TaskCard key={task.id} task={task} />)}
                    {statusTasks.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-6">Görev yok</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ==================== KPI GÖRÜNÜMÜ ==================== */}
      {activeView === "kpi" && (
        <div className="space-y-4">
          {/* Departman KPI Tablosu */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-500" /> Departman Performansı
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-800">
                    <th className="text-left py-2 font-medium text-gray-500">Departman</th>
                    <th className="text-right py-2 font-medium text-gray-500">Toplam</th>
                    <th className="text-right py-2 font-medium text-gray-500">Biten</th>
                    <th className="text-right py-2 font-medium text-gray-500">Geciken</th>
                    <th className="text-right py-2 font-medium text-gray-500">Tamamlama</th>
                    <th className="py-2 px-4 w-40"></th>
                  </tr>
                </thead>
                <tbody>
                  {deptKPIs.map(d => {
                    const Icon = d.icon;
                    return (
                      <tr key={d.key} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer"
                        onClick={() => { setActiveDept(d.key); setActiveView("board"); }}>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${d.color}`} />
                            <span className="font-medium text-gray-900 dark:text-white">{d.label}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right text-gray-600">{d.total}</td>
                        <td className="py-2.5 text-right text-emerald-600 font-medium">{d.done}</td>
                        <td className="py-2.5 text-right">
                          {d.overdue > 0 ? <span className="text-red-600 font-medium">{d.overdue}</span> : <span className="text-gray-400">0</span>}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${d.completion >= 70 ? "bg-emerald-100 text-emerald-700" : d.completion >= 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                            %{d.completion}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${d.completion >= 70 ? "bg-emerald-500" : d.completion >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${d.completion}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Kişi Bazlı KPI */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-500" /> Kişi Performansı
            </h3>
            <div className="space-y-3">
              {assigneeKPIs.map(a => {
                const deptColor = DEPARTMENT_COLORS[a.dept] || "bg-gray-100 text-gray-600";
                const deptLabel = DEPARTMENTS.find(d => d.key === a.dept)?.label || "";
                return (
                  <div key={a.name} className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    onClick={() => { setAssigneeFilter(a.name); setActiveView("board"); }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                          <span className="text-xs text-white font-bold">{a.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{a.name}</p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${deptColor}`}>{deptLabel}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-900 dark:text-white">%{a.kpiScore}</p>
                          <p className="text-[9px] text-gray-400">KPI Skoru</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      <div className="text-center p-1.5 rounded-lg bg-white dark:bg-slate-900">
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{a.total}</p>
                        <p className="text-[8px] text-gray-400">Toplam</p>
                      </div>
                      <div className="text-center p-1.5 rounded-lg bg-white dark:bg-slate-900">
                        <p className="text-xs font-bold text-gray-500">{a.todo}</p>
                        <p className="text-[8px] text-gray-400">Bekliyor</p>
                      </div>
                      <div className="text-center p-1.5 rounded-lg bg-white dark:bg-slate-900">
                        <p className="text-xs font-bold text-blue-600">{a.inProgress}</p>
                        <p className="text-[8px] text-gray-400">Devam</p>
                      </div>
                      <div className="text-center p-1.5 rounded-lg bg-white dark:bg-slate-900">
                        <p className="text-xs font-bold text-emerald-600">{a.done}</p>
                        <p className="text-[8px] text-gray-400">Biten</p>
                      </div>
                      <div className="text-center p-1.5 rounded-lg bg-white dark:bg-slate-900">
                        <p className={`text-xs font-bold ${a.overdue > 0 ? "text-red-600" : "text-gray-400"}`}>{a.overdue}</p>
                        <p className="text-[8px] text-gray-400">Geciken</p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${a.total > 0 ? (a.done / a.total) * 100 : 0}%` }} />
                      <div className="h-full bg-blue-500" style={{ width: `${a.total > 0 ? (a.inProgress / a.total) * 100 : 0}%` }} />
                      {a.overdue > 0 && <div className="h-full bg-red-500" style={{ width: `${(a.overdue / a.total) * 100}%` }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Geciken Görevler */}
          {overdueCount > 0 && (
            <div className="card p-5 border-l-4 border-l-red-500">
              <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Geciken Görevler ({overdueCount})
              </h3>
              <div className="space-y-2">
                {deptTasks.filter(t => isOverdue(t)).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(t => {
                  const daysLate = daysBetween(t.dueDate, today);
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg bg-red-50 dark:bg-red-950/10">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{t.title}</p>
                        <p className="text-[10px] text-gray-400">{t.assignee} · {DEPARTMENTS.find(d => d.key === t.department)?.label}</p>
                      </div>
                      <span className="text-[10px] font-bold text-red-600 flex-shrink-0">{daysLate} gün gecikmiş</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
