"use client";

import { useState } from "react";
import { Plus, Calendar, Flag, X, GripVertical, MoreHorizontal, Trash2, MessageSquare, ChevronRight } from "lucide-react";

type Task = {
  id: number;
  title: string;
  assignee: string;
  priority: "high" | "normal" | "low";
  dueDate: string;
  tags: string[];
  notes: string[];
};

type Column = "todo" | "in_progress" | "done";

const initialTasks: Record<Column, Task[]> = {
  todo: [
    { id: 1, title: "Tükenen ürünlerin stok güncellemesi yap", assignee: "Elif A.", priority: "high", dueDate: "29 Mar 2026", tags: ["Stok"], notes: ["Saten Midi Etek ve Denim Ceket tükenmiş durumda"] },
    { id: 2, title: "Instagram DM'lerdeki beden sorularına standart cevap hazırla", assignee: "Dilara A.", priority: "normal", dueDate: "30 Mar 2026", tags: ["Instagram", "Destek"], notes: [] },
    { id: 3, title: "Yaz koleksiyonu ürün fotoğrafları çekilecek", assignee: "Akif D.", priority: "normal", dueDate: "1 Nis 2026", tags: ["Pazarlama"], notes: ["Stüdyo rezervasyonu yapıldı"] },
  ],
  in_progress: [
    { id: 4, title: "Kargoya verilmemiş siparişleri hazırla (12 adet)", assignee: "Elif A.", priority: "high", dueDate: "28 Mar 2026", tags: ["Kargo"], notes: ["8 tanesi paketlendi, 4 tane kaldı"] },
    { id: 5, title: "İade edilen siparişlerin incelemesini tamamla", assignee: "Dilara A.", priority: "normal", dueDate: "28 Mar 2026", tags: ["İade"], notes: ["2 tanesi beden değişimi, 1 tanesi kusurlu ürün"] },
    { id: 6, title: "Instagram hikâye içerik planı hazırla (haftalık)", assignee: "Akif D.", priority: "normal", dueDate: "29 Mar 2026", tags: ["Sosyal Medya"], notes: [] },
  ],
  done: [
    { id: 7, title: "Yeni sezon ürün açıklamalarını güncelle", assignee: "Dilara A.", priority: "normal", dueDate: "25 Mar 2026", tags: ["İçerik"], notes: ["142 ürünün tamamı güncellendi"] },
    { id: 8, title: "Shopify entegrasyonu kur ve test et", assignee: "Akif D.", priority: "high", dueDate: "24 Mar 2026", tags: ["Teknik"], notes: ["Repliq paneline bağlandı, veriler geliyor"] },
    { id: 9, title: "Müşteri memnuniyet anketini gönder", assignee: "Elif A.", priority: "normal", dueDate: "22 Mar 2026", tags: ["Destek"], notes: ["38 yanıt geldi, ortalama 4.3/5"] },
    { id: 10, title: "Fiyat güncellemesi - bahar indirimi", assignee: "Akif D.", priority: "high", dueDate: "20 Mar 2026", tags: ["Fiyat"], notes: [] },
  ],
};

const priorityConfig: Record<string, { color: string; label: string }> = {
  high: { color: "text-red-500", label: "Yüksek" },
  normal: { color: "text-blue-500", label: "Normal" },
  low: { color: "text-gray-400", label: "Düşük" },
};

const columnConfig = [
  { key: "todo" as Column, label: "Yapılacak", color: "border-gray-300 dark:border-slate-600", bgColor: "bg-gray-50 dark:bg-slate-800/50" },
  { key: "in_progress" as Column, label: "Devam Ediyor", color: "border-blue-400 dark:border-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/30" },
  { key: "done" as Column, label: "Tamamlandı", color: "border-emerald-400 dark:border-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950/30" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState(initialTasks);
  const [dragItem, setDragItem] = useState<{ id: number; from: Column } | null>(null);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [newNote, setNewNote] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", assignee: "", priority: "normal" as "high" | "normal" | "low", dueDate: "" });

  const handleDragStart = (id: number, from: Column) => {
    setDragItem({ id, from });
  };

  const handleDrop = (to: Column) => {
    if (!dragItem || dragItem.from === to) return;
    const task = tasks[dragItem.from].find(t => t.id === dragItem.id);
    if (!task) return;
    setTasks(prev => ({
      ...prev,
      [dragItem.from]: prev[dragItem.from].filter(t => t.id !== dragItem.id),
      [to]: [...prev[to], task],
    }));
    setDragItem(null);
  };

  const handleDelete = (id: number, col: Column) => {
    setTasks(prev => ({ ...prev, [col]: prev[col].filter(t => t.id !== id) }));
    setExpandedTask(null);
  };

  const moveTask = (id: number, from: Column, to: Column) => {
    const task = tasks[from].find(t => t.id === id);
    if (!task) return;
    setTasks(prev => ({
      ...prev,
      [from]: prev[from].filter(t => t.id !== id),
      [to]: [...prev[to], task],
    }));
  };

  const addNote = (id: number, col: Column) => {
    if (!newNote.trim()) return;
    setTasks(prev => ({
      ...prev,
      [col]: prev[col].map(t => t.id === id ? { ...t, notes: [...t.notes, newNote.trim()] } : t),
    }));
    setNewNote("");
  };

  const addTask = () => {
    if (!newTask.title.trim()) return;
    const task: Task = {
      id: Date.now(),
      title: newTask.title,
      assignee: newTask.assignee || "Atanmadı",
      priority: newTask.priority,
      dueDate: newTask.dueDate || "-",
      tags: [],
      notes: [],
    };
    setTasks(prev => ({ ...prev, todo: [task, ...prev.todo] }));
    setNewTask({ title: "", assignee: "", priority: "normal", dueDate: "" });
    setShowAdd(false);
  };

  const totalTasks = tasks.todo.length + tasks.in_progress.length + tasks.done.length;

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Görevler</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {tasks.todo.length} yapılacak, {tasks.in_progress.length} devam ediyor, {tasks.done.length} tamamlandı
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition-all">
          <Plus className="h-4 w-4" /> Yeni Görev
        </button>
      </div>

      {/* Yeni Görev Formu */}
      {showAdd && (
        <div className="card p-4 mb-4 border-2 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Yeni Görev Ekle</h3>
            <button onClick={() => setShowAdd(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="Görev başlığı..."
              className="lg:col-span-2 px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
            <input value={newTask.assignee} onChange={e => setNewTask(p => ({ ...p, assignee: e.target.value }))} placeholder="Atanan kişi..."
              className="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
            <div className="flex gap-2">
              <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value as any }))}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm">
                <option value="high">Yüksek</option><option value="normal">Normal</option><option value="low">Düşük</option>
              </select>
              <button onClick={addTask} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">Ekle</button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {columnConfig.map(col => (
          <div key={col.key}
            className={`rounded-xl ${col.bgColor} p-3 min-h-[300px]`}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(col.key)}>
            <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${col.color}`}>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{col.label}</h3>
              <span className="w-6 h-6 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-slate-300">
                {tasks[col.key].length}
              </span>
            </div>
            <div className="space-y-2">
              {tasks[col.key].map(task => (
                <div key={task.id}
                  draggable
                  onDragStart={() => handleDragStart(task.id, col.key)}
                  className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-3 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <GripVertical className="h-3.5 w-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{task.title}</p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {col.key !== "done" && (
                        <button onClick={() => moveTask(task.id, col.key, col.key === "todo" ? "in_progress" : "done")}
                          className="p-1 text-emerald-500 hover:text-emerald-600" title="İlerlet">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(task.id, col.key)} className="p-1 text-red-400 hover:text-red-600" title="Sil">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {task.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded text-[10px] text-gray-500 dark:text-slate-400">{tag}</span>
                    ))}
                  </div>

                  {/* Notlar */}
                  {task.notes.length > 0 && (
                    <div className="mb-2">
                      {(expandedTask === task.id ? task.notes : task.notes.slice(0, 1)).map((note, i) => (
                        <p key={i} className="text-[10px] text-gray-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-950/20 px-2 py-1 rounded mb-0.5">{note}</p>
                      ))}
                      {task.notes.length > 1 && expandedTask !== task.id && (
                        <button onClick={() => setExpandedTask(task.id)} className="text-[10px] text-blue-500 hover:text-blue-600">+{task.notes.length - 1} not daha</button>
                      )}
                    </div>
                  )}

                  {/* Not Ekleme */}
                  {expandedTask === task.id && (
                    <div className="flex gap-1.5 mb-2">
                      <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Not ekle..."
                        className="flex-1 px-2 py-1 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-[11px]"
                        onKeyDown={e => e.key === "Enter" && addNote(task.id, col.key)} />
                      <button onClick={() => addNote(task.id, col.key)} className="px-2 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-medium">Ekle</button>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                        <span className="text-[9px] text-white font-bold">{task.assignee.charAt(0)}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-slate-400">{task.assignee}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)} className="p-0.5 text-gray-400 hover:text-blue-500">
                        <MessageSquare className="h-3 w-3" />
                      </button>
                      <Flag className={`h-3 w-3 ${priorityConfig[task.priority].color}`} />
                      <span className="text-[10px] text-gray-400 dark:text-slate-500">{task.dueDate}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
