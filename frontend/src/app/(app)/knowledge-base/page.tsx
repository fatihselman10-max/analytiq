"use client";

import { useState, useEffect } from "react";
import { kbAPI } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

import {
  BookOpen, Plus, Trash2, Search, Loader2, X, Edit3, Eye, FileText, FolderPlus, ChevronDown,
} from "lucide-react";

interface Category {
  id: number; name: string; description: string; icon: string; article_count: number;
}
interface Article {
  id: number; category_id: number | null; title: string; slug: string; content: string;
  status: string; view_count: number; helpful_count: number; not_helpful_count: number;
  category_name: string; author_name: string; updated_at: string;
}

export default function KnowledgeBasePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const { organization } = useAuthStore();

  // Editor state
  const [editing, setEditing] = useState<Article | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [edTitle, setEdTitle] = useState("");
  const [edContent, setEdContent] = useState("");
  const [edCatId, setEdCatId] = useState<number | null>(null);
  const [edStatus, setEdStatus] = useState("draft");
  const [saving, setSaving] = useState(false);

  // Category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");

  useEffect(() => { if (!organization) return; fetchAll(); }, [organization]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [catRes, artRes] = await Promise.all([kbAPI.listCategories(), kbAPI.listArticles()]);
      setCategories(catRes.data.categories || []);
      setArticles(artRes.data.articles || []);
    } catch {}
    setLoading(false);
  };

  const fetchArticles = async () => {
    try {
      const params: Record<string, string> = {};
      if (filterCat) params.category_id = filterCat;
      if (filterStatus) params.status = filterStatus;
      if (search) params.search = search;
      const { data } = await kbAPI.listArticles(params);
      setArticles(data.articles || []);
    } catch {}
  };

  useEffect(() => { fetchArticles(); }, [filterCat, filterStatus, search]);

  const openNewArticle = () => {
    setEditing(null);
    setEdTitle(""); setEdContent(""); setEdCatId(null); setEdStatus("draft");
    setShowEditor(true);
  };

  const openEditArticle = async (a: Article) => {
    try {
      const { data } = await kbAPI.getArticle(a.id);
      const art = data.article;
      setEditing(art);
      setEdTitle(art.title); setEdContent(art.content); setEdCatId(art.category_id); setEdStatus(art.status);
      setShowEditor(true);
    } catch {}
  };

  const handleSaveArticle = async () => {
    if (!edTitle.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await kbAPI.updateArticle(editing.id, { title: edTitle, content: edContent, category_id: edCatId, status: edStatus });
      } else {
        await kbAPI.createArticle({ title: edTitle, content: edContent, category_id: edCatId, status: edStatus });
      }
      setShowEditor(false);
      fetchAll();
    } catch {}
    setSaving(false);
  };

  const handleDeleteArticle = async (id: number) => {
    try { await kbAPI.deleteArticle(id); setArticles(articles.filter(a => a.id !== id)); } catch {}
  };

  const handleCreateCategory = async () => {
    if (!catName.trim()) return;
    try {
      await kbAPI.createCategory({ name: catName, description: catDesc });
      setCatName(""); setCatDesc(""); setShowCatForm(false);
      const { data } = await kbAPI.listCategories();
      setCategories(data.categories || []);
    } catch {}
  };

  const handleDeleteCategory = async (id: number) => {
    try { await kbAPI.deleteCategory(id); setCategories(categories.filter(c => c.id !== id)); } catch {}
  };

  const formatDate = (s: string) => {
    const d = new Date(s);
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="p-4 sm:p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bilgi Bankası</h1>
          <p className="text-sm text-gray-500 mt-1">Yardım makaleleri ve SSS yönetimi</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCatForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
            <FolderPlus className="h-4 w-4" /> Kategori
          </button>
          <button onClick={openNewArticle}
            className="flex items-center gap-1.5 px-4 py-2 text-sm btn-gradient">
            <Plus className="h-4 w-4" /> Yeni Makale
          </button>
        </div>
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {categories.map(cat => (
            <div key={cat.id} onClick={() => setFilterCat(filterCat === String(cat.id) ? "" : String(cat.id))}
              className={`card p-4 cursor-pointer group transition-all ${filterCat === String(cat.id) ? "ring-2 ring-blue-500 bg-blue-50/50" : "card-hover"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{cat.name}</h3>
                  {cat.description && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{cat.description}</p>}
                  <p className="text-xs text-gray-500 mt-1">{cat.article_count} makale</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white"
            placeholder="Makale ara..." />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white">
          <option value="">Tüm Durumlar</option>
          <option value="draft">Taslak</option>
          <option value="published">Yayında</option>
        </select>
      </div>

      {/* Articles */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Henüz makale yok</p>
          <p className="text-sm text-gray-400 mt-1">İlk makalenizi oluştürün.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map(a => (
            <div key={a.id} className="card p-4 flex items-center gap-4 card-hover cursor-pointer" onClick={() => openEditArticle(a)}>
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{a.title}</h3>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                    a.status === "published" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {a.status === "published" ? "Yayında" : "Taslak"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                  {a.category_name && <span>{a.category_name}</span>}
                  <span>{formatDate(a.updated_at)}</span>
                  <span><Eye className="h-3 w-3 inline mr-0.5" />{a.view_count}</span>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteArticle(a.id); }}
                className="p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Article Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? "Makaleyi Düzenle" : "Yeni Makale"}
              </h2>
              <button onClick={() => setShowEditor(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <input type="text" value={edTitle} onChange={(e) => setEdTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-semibold"
                placeholder="Makale Başlığı" />
              <div className="flex gap-3">
                <select value={edCatId ?? ""} onChange={(e) => setEdCatId(e.target.value ? Number(e.target.value) : null)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">
                  <option value="">Kategorisiz</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={edStatus} onChange={(e) => setEdStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">
                  <option value="draft">Taslak</option>
                  <option value="published">Yayınla</option>
                </select>
              </div>
              <textarea value={edContent} onChange={(e) => setEdContent(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm min-h-[300px] resize-y"
                placeholder="Makale içeriğini yazın... (Markdown desteklenir)" />
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowEditor(false)} className="px-4 py-2 text-sm text-gray-600">İptal</button>
              <button onClick={handleSaveArticle} disabled={saving || !edTitle.trim()}
                className="flex items-center gap-2 px-5 py-2.5 text-sm btn-gradient disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Güncelle" : "Oluştur"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Form Modal */}
      {showCatForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Yeni Kategori</h2>
            <div className="space-y-3">
              <input type="text" value={catName} onChange={(e) => setCatName(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="Kategori adı" />
              <input type="text" value={catDesc} onChange={(e) => setCatDesc(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="Açıklama (opsiyonel)" />
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowCatForm(false)} className="px-4 py-2 text-sm text-gray-600">İptal</button>
              <button onClick={handleCreateCategory} disabled={!catName.trim()}
                className="px-5 py-2.5 text-sm btn-gradient disabled:opacity-50">Oluştur</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
