"use client";

import { useState, useEffect } from "react";
import { Conversation, Tag } from "@/types";
import { OrgMember } from "@/types";
import { teamAPI, tagsAPI, conversationsAPI, contactsAPI, messagesAPI } from "@/lib/api";
import {
  Mail,
  MessageCircle,
  Instagram,
  Phone,
  Globe,
  User,
  ChevronDown,
  X,
  Plus,
  Tag as TagIcon,
  ShoppingBag,
  Package,
  Loader2,
  ExternalLink,
  Truck,
  Clock,
  Send,
  Copy,
  CheckCircle,
  Activity,
  ShoppingCart,
  CreditCard,
  UserPlus,
  ArrowRightLeft,
} from "lucide-react";

interface ContactPanelProps {
  conversation: Conversation;
  onUpdate: (id: number, updates: Partial<Conversation>) => void;
  onSendMessage?: (content: string) => void;
}

const channelLabels: Record<string, { label: string; icon: React.ElementType }> = {
  email: { label: "E-posta", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  instagram: { label: "Instagram", icon: Instagram },
  phone: { label: "Telefon", icon: Phone },
  web: { label: "Web", icon: Globe },
};

const statusOptions = [
  { value: "open", label: "Açık", className: "bg-green-100 text-green-700" },
  { value: "pending", label: "Beklemede", className: "bg-yellow-100 text-yellow-700" },
  { value: "resolved", label: "Çözüldü", className: "bg-blue-100 text-blue-700" },
  { value: "closed", label: "Kapalı", className: "bg-gray-100 text-gray-600" },
];

const priorityOptions = [
  { value: "low", label: "Düşük", className: "bg-gray-100 text-gray-600" },
  { value: "normal", label: "Normal", className: "bg-blue-100 text-blue-700" },
  { value: "high", label: "Yüksek", className: "bg-orange-100 text-orange-700" },
  { value: "urgent", label: "Acil", className: "bg-red-100 text-red-700" },
];

interface ShopifyFulfillment {
  status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  tracking_company: string | null;
  created_at: string;
}

interface ShopifyOrder {
  id: number;
  name: string;
  created_at: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  currency: string;
  line_items: { title: string; quantity: number }[];
  fulfillments: ShopifyFulfillment[];
  store?: "tr" | "ww";
}

// Extracts potential customer identifiers from recent chat messages.
// Handles Turkish patterns: "X adına", "adım/ismim X", "#1234", email, phone.
function extractIdentifiers(texts: string[]): {
  names: string[];
  orderNumbers: string[];
  emails: string[];
  phones: string[];
} {
  const names = new Set<string>();
  const orderNumbers = new Set<string>();
  const emails = new Set<string>();
  const phones = new Set<string>();

  const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  // Turkish capitalized word (1-4 words) followed by "adına"
  const nameAdinaRe = /([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){0,3})\s+adına/gi;
  // "adım/ismim/benim adım X Y" — capture 1-4 capitalized or lowercase words
  const nameIntroRe = /\b(?:ad[ıi]m|ismim|benim ad[ıi]m)\s+([A-Za-zÇĞİÖŞÜçğıöşü]+(?:\s+[A-Za-zÇĞİÖŞÜçğıöşü]+){0,3})/gi;
  // Order number: #1234 or "sipariş no/numarası 1234" or "1234 numaralı"
  const orderHashRe = /#(\d{3,7})\b/g;
  const orderTextRe = /(?:sipari[şs]\s*(?:no|numara[sı]?\s*[:=]?)\s*#?|(?:\d+)\s*numaral[ıi])\s*#?(\d{3,7})/gi;
  // Phone — Turkish + international, min 10 digits
  const phoneRe = /(?:\+?\d[\s\-().]?){10,}/g;

  const collect = (re: RegExp, text: string): RegExpMatchArray[] => {
    const out: RegExpMatchArray[] = [];
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    while ((m = r.exec(text)) !== null) {
      out.push(m);
      if (m.index === r.lastIndex) r.lastIndex++; // avoid zero-length infinite loop
    }
    return out;
  };

  for (const raw of texts) {
    if (!raw || raw.length < 3) continue;
    const text = raw.slice(0, 2000);

    collect(emailRe, text).forEach((m) => emails.add(m[0].toLowerCase()));
    collect(nameAdinaRe, text).forEach((m) => {
      const name = m[1].trim();
      if (name.length >= 3) names.add(name);
    });
    collect(nameIntroRe, text).forEach((m) => {
      const name = m[1].trim();
      if (name.length >= 3) names.add(name.replace(/\b\w/g, (c: string) => c.toUpperCase()));
    });
    collect(orderHashRe, text).forEach((m) => orderNumbers.add(m[1]));
    collect(orderTextRe, text).forEach((m) => { if (m[1]) orderNumbers.add(m[1]); });
    collect(phoneRe, text).forEach((m) => {
      const digits = m[0].replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 15) phones.add(digits);
    });
  }

  return {
    names: Array.from(names).slice(0, 5),
    orderNumbers: Array.from(orderNumbers).slice(0, 5),
    emails: Array.from(emails).slice(0, 5),
    phones: Array.from(phones).slice(0, 3),
  };
}

interface JourneyEvent {
  id: number;
  event_type: string;
  source: string;
  title: string;
  body: string;
  amount_cents?: number | null;
  currency?: string | null;
  external_id?: string | null;
  occurred_at: string;
  metadata?: Record<string, unknown>;
}

const eventMeta: Record<string, { label: string; dot: string; icon: React.ElementType }> = {
  signup:             { label: "Kayıt",          dot: "bg-sky-500",    icon: UserPlus },
  cart_updated:       { label: "Sepet",          dot: "bg-amber-500",  icon: ShoppingCart },
  checkout_started:   { label: "Checkout",       dot: "bg-amber-500",  icon: CreditCard },
  checkout_progress:  { label: "Checkout",       dot: "bg-amber-400",  icon: CreditCard },
  order_placed:       { label: "Sipariş",        dot: "bg-emerald-500",icon: ShoppingBag },
  order_paid:         { label: "Ödendi",         dot: "bg-emerald-600",icon: CheckCircle },
  order_fulfilled:    { label: "Kargolandı",     dot: "bg-blue-500",   icon: Truck },
  order_cancelled:    { label: "İptal",          dot: "bg-red-500",    icon: X },
  message_in:         { label: "Müşteri mesajı", dot: "bg-slate-400",  icon: MessageCircle },
  message_out:        { label: "Ajan cevabı",    dot: "bg-slate-300",  icon: ArrowRightLeft },
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "şimdi";
  if (diff < 3600) return `${Math.floor(diff / 60)}dk`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}g`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

function stageLabel(events: JourneyEvent[]): { label: string; className: string } | null {
  if (events.length === 0) return null;
  // Walk from most recent to find decisive stage
  for (const e of events) {
    switch (e.event_type) {
      case "order_fulfilled": return { label: "Kargoda",       className: "bg-blue-100 text-blue-700" };
      case "order_paid":      return { label: "Ödendi",        className: "bg-emerald-100 text-emerald-700" };
      case "order_placed":    return { label: "Sipariş",       className: "bg-emerald-100 text-emerald-700" };
      case "checkout_started":
      case "checkout_progress": return { label: "Checkout",    className: "bg-amber-100 text-amber-700" };
      case "cart_updated":    return { label: "Sepet",         className: "bg-amber-50 text-amber-600" };
      case "signup":          return { label: "Yeni kayıt",    className: "bg-sky-100 text-sky-700" };
    }
  }
  return { label: "Aktif",            className: "bg-slate-100 text-slate-600" };
}

export default function ContactPanel({ conversation, onUpdate, onSendMessage }: ContactPanelProps) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [showOrders, setShowOrders] = useState(true);
  const [journey, setJourney] = useState<JourneyEvent[]>([]);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [showJourney, setShowJourney] = useState(true);

  useEffect(() => {
    teamAPI.listMembers().then((res) => setMembers(res.data?.members || [])).catch(() => {});
    tagsAPI.list().then((res) => setAllTags(res.data?.tags || [])).catch(() => {});
  }, []);

  // Fetch unified journey (Shopify events + messages) for this contact
  useEffect(() => {
    const contactId = conversation.contact?.id;
    if (!contactId) { setJourney([]); return; }
    setJourneyLoading(true);
    contactsAPI.journey(contactId, 100)
      .then((res) => setJourney(res.data?.events || []))
      .catch(() => setJourney([]))
      .finally(() => setJourneyLoading(false));
  }, [conversation.contact?.id, conversation.id]);

  // Fetch Shopify orders across TR + EU stores.
  // Combines contact fields with identifiers extracted from recent chat messages
  // (name-in-chat, order numbers, email mentions, phone numbers).
  useEffect(() => {
    const contact = conversation.contact;
    if (!contact) { setOrders([]); return; }

    let cancelled = false;
    setOrdersLoading(true);

    (async () => {
      const names = new Set<string>();
      const emails = new Set<string>();
      const phones = new Set<string>();
      const orderNumbers = new Set<string>();

      if (contact.name && !/^ig_/i.test(contact.name)) names.add(contact.name);
      if (contact.email) emails.add(contact.email);
      if (contact.phone) phones.add(contact.phone);

      // Pull the last 30 messages of this conversation and mine them for identifiers
      try {
        const msgRes = await messagesAPI.list(conversation.id);
        const msgs = (msgRes.data?.messages || []) as Array<{ content?: string; sender_type?: string }>;
        const contactTexts = msgs
          .filter((m) => m.sender_type === "contact" && typeof m.content === "string")
          .slice(-30)
          .map((m) => m.content as string);
        const extracted = extractIdentifiers(contactTexts);
        extracted.names.forEach((n) => names.add(n));
        extracted.emails.forEach((e) => emails.add(e));
        extracted.phones.forEach((p) => phones.add(p));
        extracted.orderNumbers.forEach((o) => orderNumbers.add(o));
      } catch { /* message fetch failed — carry on with contact fields only */ }

      if (names.size === 0 && emails.size === 0 && phones.size === 0 && orderNumbers.size === 0) {
        if (!cancelled) { setOrders([]); setOrdersLoading(false); }
        return;
      }

      const params = new URLSearchParams({ action: "customer-orders" });
      if (names.size) params.set("names", Array.from(names).join(","));
      if (emails.size) params.set("emails", Array.from(emails).join(","));
      if (phones.size) params.set("phones", Array.from(phones).join(","));
      if (orderNumbers.size) params.set("order_numbers", Array.from(orderNumbers).join(","));

      try {
        const r = await fetch(`/api/shopify?${params.toString()}`);
        const data = await r.json();
        if (!cancelled) setOrders(data.orders || []);
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [conversation.id, conversation.contact?.id, conversation.contact?.email, conversation.contact?.name, conversation.contact?.phone]);

  const contact = conversation.contact;
  const channel = channelLabels[conversation.channel_type || "web"] || channelLabels.web;
  const ChannelIcon = channel.icon;

  const handleStatusChange = async (status: string) => {
    try {
      await conversationsAPI.update(conversation.id, { status });
      onUpdate(conversation.id, { status: status as Conversation["status"] });
    } catch {}
  };

  const handlePriorityChange = async (priority: string) => {
    try {
      await conversationsAPI.update(conversation.id, { priority });
      onUpdate(conversation.id, { priority: priority as Conversation["priority"] });
    } catch {}
  };

  const handleAssign = async (userId: number | null) => {
    try {
      if (userId) {
        await conversationsAPI.assign(conversation.id, userId);
        const member = members.find((m) => m.user_id === userId);
        onUpdate(conversation.id, {
          assigned_to: userId,
          assigned_user: member
            ? { id: member.user_id, email: member.email, full_name: member.full_name, avatar_url: member.avatar_url }
            : undefined,
        });
      } else {
        await conversationsAPI.update(conversation.id, { assigned_to: undefined });
        onUpdate(conversation.id, { assigned_to: null, assigned_user: undefined });
      }
    } catch {}
  };

  const handleAddTag = async (tagId: number) => {
    try {
      await conversationsAPI.addTag(conversation.id, tagId);
      const tag = allTags.find((t) => t.id === tagId);
      if (tag) {
        onUpdate(conversation.id, {
          tags: [...(conversation.tags || []), tag],
        });
      }
      setShowTagPicker(false);
    } catch {}
  };

  const handleRemoveTag = async (tagId: number) => {
    try {
      await conversationsAPI.removeTag(conversation.id, tagId);
      onUpdate(conversation.id, {
        tags: (conversation.tags || []).filter((t) => t.id !== tagId),
      });
    } catch {}
  };

  const currentStatus = statusOptions.find((s) => s.value === conversation.status) || statusOptions[0];
  const currentPriority = priorityOptions.find((p) => p.value === conversation.priority) || priorityOptions[1];
  const availableTags = allTags.filter(
    (t) => !(conversation.tags || []).some((ct) => ct.id === t.id)
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Contact Info */}
      <div className="p-5 border-b border-gray-200 text-center">
        {contact?.avatar_url ? (
          <img
            src={contact.avatar_url}
            alt={contact.name || ""}
            className="w-16 h-16 rounded-full object-cover mx-auto mb-3"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-semibold text-primary-700">
              {contact?.name?.charAt(0)?.toUpperCase() || "?"}
            </span>
          </div>
        )}
        <h3 className="text-base font-semibold text-gray-900">
          {contact?.name || "Bilinmeyen"}
        </h3>
        {contact?.email && (
          <p className="text-sm text-gray-500 mt-0.5">{contact.email}</p>
        )}
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <ChannelIcon className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">{channel.label}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 space-y-4">
        {/* Status */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
            Durum
          </label>
          <div className="relative">
            <select
              value={conversation.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className={`w-full appearance-none px-3 py-2 pr-8 text-sm font-medium rounded-lg border border-gray-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 ${currentStatus.className}`}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
            Öncelik
          </label>
          <div className="relative">
            <select
              value={conversation.priority}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className={`w-full appearance-none px-3 py-2 pr-8 text-sm font-medium rounded-lg border border-gray-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 ${currentPriority.className}`}
            >
              {priorityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Assigned Agent */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
            Atanan Temsilci
          </label>
          <div className="relative">
            <select
              value={conversation.assigned_to || ""}
              onChange={(e) =>
                handleAssign(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full appearance-none px-3 py-2 pr-8 text-sm rounded-lg border border-gray-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">Atanmamış</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
            Etiketler
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(conversation.tags || []).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                }}
              >
                {tag.name}
                <button
                  onClick={() => handleRemoveTag(tag.id)}
                  className="hover:opacity-70"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          {/* Add tag */}
          <div className="relative">
            {showTagPicker ? (
              <div className="border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 shadow-lg">
                <div className="max-h-40 overflow-y-auto p-1.5">
                  {availableTags.length === 0 && !showNewTag ? (
                    <p className="text-xs text-gray-400 p-2 text-center">
                      Tüm etiketler ekli
                    </p>
                  ) : (
                    availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => handleAddTag(tag.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs hover:bg-gray-50 dark:hover:bg-slate-800 text-left transition-colors"
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </button>
                    ))
                  )}
                </div>
                {/* Yeni etiket oluştur */}
                {showNewTag ? (
                  <div className="p-2 border-t border-gray-100 dark:border-slate-800 space-y-2">
                    <input value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Etiket adı..."
                      className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs" />
                    <div className="flex items-center gap-1.5">
                      {["#10b981", "#3b82f6", "#ef4444", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#7c3aed"].map(c => (
                        <button key={c} onClick={() => setNewTagColor(c)}
                          className={`w-5 h-5 rounded-full border-2 ${newTagColor === c ? "border-gray-900 dark:border-white" : "border-transparent"}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={async () => {
                        if (!newTagName.trim()) return;
                        try {
                          await tagsAPI.create({ name: newTagName.trim(), color: newTagColor });
                          const res = await tagsAPI.list();
                          setAllTags(res.data?.tags || []);
                          setNewTagName("");
                          setShowNewTag(false);
                        } catch {}
                      }} className="flex-1 px-2 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-medium">Oluştur</button>
                      <button onClick={() => setShowNewTag(false)} className="px-2 py-1.5 text-gray-400 text-[10px]">İptal</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex border-t border-gray-100 dark:border-slate-800">
                    <button onClick={() => setShowNewTag(true)}
                      className="flex-1 text-xs text-blue-600 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors font-medium">
                      + Yeni Etiket
                    </button>
                    <button onClick={() => setShowTagPicker(false)}
                      className="flex-1 text-xs text-gray-400 py-2 border-l border-gray-100 dark:border-slate-800 hover:text-gray-600">
                      Kapat
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowTagPicker(true)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Etiket ekle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Journey timeline (Shopify events + messages, unified) */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => setShowJourney(!showJourney)}
          className="flex items-center justify-between w-full mb-2"
        >
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Journey
            {(() => {
              const s = stageLabel(journey);
              return s ? (
                <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${s.className}`}>
                  {s.label}
                </span>
              ) : null;
            })()}
          </h4>
          <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${showJourney ? "rotate-180" : ""}`} />
        </button>
        {showJourney && (
          journeyLoading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          ) : journey.length === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-2">
              Henüz etkinlik yok
            </p>
          ) : (
            <div className="relative pl-3 space-y-2.5">
              <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-gray-200 dark:bg-slate-700" />
              {journey.slice(0, 30).map((e) => {
                const meta = eventMeta[e.event_type] || { label: e.event_type, dot: "bg-gray-400", icon: Activity };
                const amount = e.amount_cents != null
                  ? `${(e.amount_cents / 100).toFixed(2)}${e.currency ? ` ${e.currency}` : ""}`
                  : "";
                return (
                  <div key={e.id} className="relative flex items-start gap-2.5">
                    <span className={`absolute -left-3 top-1 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${meta.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-0.5">
                        <span className="uppercase tracking-wider font-medium text-gray-500">{meta.label}</span>
                        {e.source && e.source !== "shopify" && (
                          <span className="px-1 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-[9px]">{e.source}</span>
                        )}
                        <span className="ml-auto">{timeAgo(e.occurred_at)}</span>
                      </div>
                      <p className="text-[11px] text-gray-800 dark:text-gray-200 leading-snug truncate">
                        {e.title || e.body || "—"}
                      </p>
                      {amount && (
                        <p className="text-[10px] text-gray-500 mt-0.5">{amount}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {journey.length > 30 && (
                <p className="text-[10px] text-center text-gray-400 pt-1">+{journey.length - 30} etkinlik daha</p>
              )}
            </div>
          )
        )}
      </div>

      {/* Shopify Orders */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => setShowOrders(!showOrders)}
          className="flex items-center justify-between w-full mb-2"
        >
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5" />
            Siparis Gecmisi
          </h4>
          <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${showOrders ? "rotate-180" : ""}`} />
        </button>
        {showOrders && (
          ordersLoading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-2">
              Shopify&apos;da eslesme bulunamadi
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                <span>{orders.length} sipariş</span>
                <span className="font-medium text-gray-700">
                  {(() => {
                    const byCur: Record<string, number> = {};
                    for (const o of orders) {
                      const cur = (o.currency || "TRY").toUpperCase();
                      byCur[cur] = (byCur[cur] || 0) + parseFloat(o.total_price || "0");
                    }
                    return Object.entries(byCur)
                      .map(([cur, v]) => v.toLocaleString("tr-TR", { style: "currency", currency: cur, maximumFractionDigits: 0 }))
                      .join(" · ");
                  })()}
                </span>
              </div>
              {orders.slice(0, 5).map((order) => {
                const statusColors: Record<string, string> = {
                  paid: "bg-green-100 text-green-700",
                  pending: "bg-yellow-100 text-yellow-700",
                  refunded: "bg-red-100 text-red-700",
                  partially_refunded: "bg-orange-100 text-orange-700",
                };
                const latestFulfillment = order.fulfillments?.length > 0
                  ? order.fulfillments[order.fulfillments.length - 1]
                  : null;

                // Kargo durumu belirleme
                let shippingLabel = "";
                let shippingClass = "";
                if (order.fulfillment_status === "fulfilled" && latestFulfillment) {
                  shippingLabel = "Kargoya Verildi";
                  shippingClass = "bg-blue-100 text-blue-700";
                } else if (order.fulfillment_status === "partial") {
                  shippingLabel = "Kismi Kargo";
                  shippingClass = "bg-cyan-100 text-cyan-700";
                } else if (order.financial_status === "paid") {
                  shippingLabel = "Hazirlaniyor";
                  shippingClass = "bg-amber-100 text-amber-700";
                } else {
                  shippingLabel = "";
                }

                const storeBadge = order.store === "ww"
                  ? { label: "WW", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200" }
                  : { label: "TR", className: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200" };

                return (
                  <div key={`${order.store || "tr"}-${order.id}`} className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">{order.name}</span>
                        <span className={`px-1 py-0.5 rounded text-[9px] font-semibold ${storeBadge.className}`}>
                          {storeBadge.label}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {new Date(order.created_at).toLocaleDateString("tr-TR")}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${statusColors[order.financial_status] || "bg-gray-100 text-gray-600"}`}>
                        {order.financial_status === "paid" ? "Odendi" :
                         order.financial_status === "pending" ? "Bekliyor" :
                         order.financial_status === "refunded" ? "Iade" :
                         order.financial_status === "partially_refunded" ? "Kismi Iade" :
                         order.financial_status}
                      </span>
                      {shippingLabel && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${shippingClass}`}>
                          {shippingLabel}
                        </span>
                      )}
                      <span className="text-[10px] font-medium text-gray-700 ml-auto">
                        {parseFloat(order.total_price).toLocaleString("tr-TR")} TL
                      </span>
                    </div>

                    {/* Kargo takip bilgisi + hizli aksiyonlar */}
                    {latestFulfillment && latestFulfillment.tracking_number && (
                      <div className="mb-1.5 p-1.5 rounded bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                        <div className="flex items-center gap-1 text-[10px]">
                          <Truck className="h-3 w-3 text-blue-500 flex-shrink-0" />
                          <span className="text-blue-700 dark:text-blue-300 font-medium">
                            {latestFulfillment.tracking_company || "Kargo"}
                          </span>
                          <span className="text-blue-600 dark:text-blue-400 font-mono">
                            {latestFulfillment.tracking_number}
                          </span>
                          {latestFulfillment.tracking_url && (
                            <a href={latestFulfillment.tracking_url} target="_blank" rel="noopener noreferrer"
                              className="ml-auto text-blue-500 hover:text-blue-700">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        {/* Hizli aksiyonlar */}
                        {onSendMessage && (
                          <div className="flex gap-1 mt-1.5">
                            <button
                              onClick={() => {
                                const msg = `Merhaba! ${order.name} numarali siparissiniz kargoya verilmistir. 📦\n\nKargo: ${latestFulfillment.tracking_company || "Kargo"}\nTakip No: ${latestFulfillment.tracking_number}${latestFulfillment.tracking_url ? `\nTakip: ${latestFulfillment.tracking_url}` : ""}`;
                                onSendMessage(msg);
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 text-white text-[9px] font-medium hover:bg-blue-700 transition-colors"
                            >
                              <Send className="h-2.5 w-2.5" />
                              Takip Bilgisi Gonder
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(latestFulfillment.tracking_number || "");
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-200 text-gray-700 text-[9px] font-medium hover:bg-gray-300 transition-colors"
                            >
                              <Copy className="h-2.5 w-2.5" />
                              Kopyala
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Odendi ama kargoya verilmedi uyarisi */}
                    {order.financial_status === "paid" && !order.fulfillment_status && (
                      <div className="mb-1.5 p-1.5 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                        <p className="text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          Siparis hazirlaniyor, henuz kargoya verilmedi
                        </p>
                        {onSendMessage && (
                          <button
                            onClick={() => {
                              const msg = `Merhaba! ${order.name} numarali siparissiniz hazirlanmaktadir. Kargoya verildikten sonra takip bilginizi paylasacagiz. Tesekkurler! 🙏`;
                              onSendMessage(msg);
                            }}
                            className="flex items-center gap-1 mt-1.5 px-2 py-1 rounded-md bg-amber-500 text-white text-[9px] font-medium hover:bg-amber-600 transition-colors"
                          >
                            <Send className="h-2.5 w-2.5" />
                            Hazirlaniyor Bilgisi Gonder
                          </button>
                        )}
                      </div>
                    )}

                    <div className="text-[10px] text-gray-500 space-y-0.5">
                      {order.line_items?.slice(0, 2).map((item, i) => (
                        <p key={i} className="truncate">
                          <Package className="h-2.5 w-2.5 inline mr-1" />
                          {item.quantity}x {item.title}
                        </p>
                      ))}
                      {(order.line_items?.length || 0) > 2 && (
                        <p className="text-gray-400">+{order.line_items.length - 2} urun daha</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {orders.length > 5 && (
                <p className="text-[10px] text-center text-gray-400">+{orders.length - 5} siparis daha</p>
              )}
            </div>
          )
        )}
      </div>

      {/* Conversation details */}
      <div className="mt-auto p-4 border-t border-gray-200">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Detaylar
        </h4>
        <dl className="space-y-2 text-xs">
          <div className="flex justify-between">
            <dt className="text-gray-400">Oluşturulma</dt>
            <dd className="text-gray-600">
              {new Date(conversation.created_at).toLocaleDateString("tr-TR")}
            </dd>
          </div>
          {conversation.first_response_at && (
            <div className="flex justify-between">
              <dt className="text-gray-400">İlk Yanıt</dt>
              <dd className="text-gray-600">
                {new Date(conversation.first_response_at).toLocaleDateString("tr-TR")}
              </dd>
            </div>
          )}
          {conversation.resolved_at && (
            <div className="flex justify-between">
              <dt className="text-gray-400">Çözüm</dt>
              <dd className="text-gray-600">
                {new Date(conversation.resolved_at).toLocaleDateString("tr-TR")}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-400">Konuşma ID</dt>
            <dd className="text-gray-600">#{conversation.id}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
