"use client";

import { useState } from "react";
import { Plus, Calendar, User, Flag, CheckCircle2, Clock, ArrowRight, GripVertical, MoreHorizontal, Megaphone } from "lucide-react";

const DEMO_TASKS = {
  todo: [
    { id: 1, title: "Segment 4 Rusya müşterilerine takip mesajı gönder", assignee: "Ahmet Y.", priority: "high", dueDate: "28 Mar 2026", campaign: "Fuar Sonrası Takip", tags: ["WhatsApp", "Rusya"] },
    { id: 2, title: "Nextex - Olesya ile numune değerlendirme görüşmesi", assignee: "Mehmet K.", priority: "normal", dueDate: "27 Mar 2026", campaign: null, tags: ["Telegram"] },
    { id: 3, title: "Yaz sezonu kampanya şablonu hazırla (Rusça + Türkçe)", assignee: "Ahmet Y.", priority: "normal", dueDate: "30 Mar 2026", campaign: null, tags: ["Kampanya"] },
  ],
  in_progress: [
    { id: 4, title: "VIPTEX fuarı müşteri Excel listesini güncelle", assignee: "Mehmet K.", priority: "high", dueDate: "26 Mar 2026", campaign: null, tags: ["CRM"] },
    { id: 5, title: "Rusça tanıtım filmi 2. versiyonu gönder - Segment 3", assignee: "Ahmet Y.", priority: "normal", dueDate: "29 Mar 2026", campaign: "Rusça Tanıtım v2", tags: ["Telegram", "VK"] },
    { id: 6, title: "Tom Klaim - Nadezdha ile sipariş görüşmesi", assignee: "Mehmet K.", priority: "high", dueDate: "26 Mar 2026", campaign: null, tags: ["WhatsApp"] },
  ],
  done: [
    { id: 7, title: "8 Mart özel gün tebriği kampanyası gönder", assignee: "Ahmet Y.", priority: "normal", dueDate: "8 Mar 2026", campaign: "8 Mart Tebriği", tags: ["WhatsApp", "Tümü"] },
    { id: 8, title: "Anna Morozova - VIPTEX numune kargola", assignee: "Mehmet K.", priority: "high", dueDate: "20 Mar 2026", campaign: null, tags: ["Kargo"] },
    { id: 9, title: "Yeni sezon koleksiyon kataloğu hazırla", assignee: "Ahmet Y.", priority: "normal", dueDate: "15 Mar 2026", campaign: null, tags: ["Pazarlama"] },
    { id: 10, title: "Segment 2 müşterilere fiyat listesi gönder", assignee: "Mehmet K.", priority: "normal", dueDate: "12 Mar 2026", campaign: "Fiyat Listesi", tags: ["Email"] },
  ],
};

const priorityConfig: Record<string, { color: string; label: string }> = {
  high: { color: "text-red-500", label: "Yüksek" },
  normal: { color: "text-blue-500", label: "Normal" },
  low: { color: "text-gray-400", label: "Düşük" },
};

const columns = [
  { key: "todo", label: "Yapılacak", color: "border-gray-300 dark:border-slate-600", bgColor: "bg-gray-50 dark:bg-slate-800/50" },
  { key: "in_progress", label: "Devam Ediyor", color: "border-blue-400 dark:border-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/30" },
  { key: "done", label: "Tamamlandı", color: "border-emerald-400 dark:border-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950/30" },
];

export default function TasksPage() {
  const [view, setView] = useState<"kanban" | "list">("kanban");

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Görevler</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {DEMO_TASKS.todo.length} yapılacak, {DEMO_TASKS.in_progress.length} devam ediyor, {DEMO_TASKS.done.length} tamamlandı
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button onClick={() => setView("kanban")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === "kanban" ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-slate-400"}`}>
              Kanban
            </button>
            <button onClick={() => setView("list")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === "list" ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-slate-400"}`}>
              Liste
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium shadow-md shadow-blue-600/20 hover:shadow-lg transition-all">
            <Plus className="h-4 w-4" /> Yeni Görev
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      {view === "kanban" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {columns.map(col => {
            const tasks = DEMO_TASKS[col.key as keyof typeof DEMO_TASKS];
            return (
              <div key={col.key} className={`rounded-xl ${col.bgColor} p-3`}>
                <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${col.color}`}>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{col.label}</h3>
                  <span className="w-6 h-6 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-slate-300">{tasks.length}</span>
                </div>
                <div className="space-y-2">
                  {tasks.map(task => (
                    <div key={task.id} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-3 hover:shadow-sm transition-all cursor-pointer group">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight pr-2">{task.title}</p>
                        <button className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition-all">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                      {task.campaign && (
                        <div className="flex items-center gap-1 mb-2">
                          <Megaphone className="h-3 w-3 text-orange-500" />
                          <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">{task.campaign}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {task.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded text-xs text-gray-500 dark:text-slate-400">{tag}</span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                            <span className="text-[9px] text-white font-bold">{task.assignee.charAt(0)}</span>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-slate-400">{task.assignee}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Flag className={`h-3 w-3 ${priorityConfig[task.priority].color}`} />
                          <span className="text-xs text-gray-400 dark:text-slate-500">{task.dueDate}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Görev</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Atanan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Durum</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {[...DEMO_TASKS.todo.map(t => ({...t, status: "todo"})), ...DEMO_TASKS.in_progress.map(t => ({...t, status: "in_progress"})), ...DEMO_TASKS.done.map(t => ({...t, status: "done"}))].map(task => (
                <tr key={task.id} className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50/50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{task.title}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-gray-600 dark:text-slate-400">{task.assignee}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      task.status === "done" ? "bg-emerald-100 text-emerald-700" : task.status === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {task.status === "done" ? "Tamamlandı" : task.status === "in_progress" ? "Devam Ediyor" : "Yapılacak"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">{task.dueDate}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
