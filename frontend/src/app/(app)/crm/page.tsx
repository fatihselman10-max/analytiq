"use client";

import { useState } from "react";
import { Search, Upload, Filter, Users, TrendingUp, TrendingDown, ArrowRight, Phone, Mail, MessageSquare, Globe, ChevronRight, Building2 } from "lucide-react";
import Link from "next/link";

const SEGMENTS = [
  { id: 0, label: "Tümü", color: "gray" },
  { id: 1, label: "Satış + İletişim", color: "emerald" },
  { id: 2, label: "İletişim Var, Satış Yok", color: "blue" },
  { id: 3, label: "Büyük Firma, Ulaşılamıyor", color: "amber" },
  { id: 4, label: "Normal Firma, Ulaşılamıyor", color: "red" },
];

const COUNTRIES = ["Tümü", "Rusya", "Kazakistan", "Kırgızistan", "Özbekistan", "Gürcistan", "Ukrayna"];

const DEMO_CONTACTS = [
  { id: 1, name: "Anna Morozova", company: "VIPTEX", country: "Rusya", segment: 1, fair: "BTK 2025", phone: "+7 905 106 53 53", email: "anna@viptex.ru", instagram: "@viptex_official", lastContact: "22 Mar 2026", lastNote: "Yeni sezon numuneleri gönderildi, 3 model beğendi, sipariş bekleniyor", orders: "8609, 8733", channel: "WhatsApp" },
  { id: 2, name: "Oleg Petrov", company: "Elena Chezelle", country: "Rusya", segment: 1, fair: "VIPTEX 2025", phone: "+7 921 963 88 82", email: "oleg@chezelle.ru", instagram: "@elenachezelle", lastContact: "20 Mar 2026", lastNote: "Düzenli müşteri, her sezon sipariş veriyor. Yeni koleksiyon kataloğu istedi", orders: "8601, 7058, 7768", channel: "Telegram" },
  { id: 3, name: "Svetlana Sivaeva", company: "Terra", country: "Rusya", segment: 2, fair: "VIPTEX 2025", phone: "+7 916 106 03 20", email: "svetlana.terramd@mail.ru", instagram: "@terra_fashion", lastContact: "18 Mar 2026", lastNote: "Fiyat listesi gönderildi, ilgileniyor ama henüz sipariş vermedi", orders: "-", channel: "WhatsApp" },
  { id: 4, name: "Nadezdha Akulshina", company: "Tom Klaim", country: "Rusya", segment: 2, fair: "VIPTEX 2025", phone: "+7 910 467 61 66", email: "klaim_work@mail.ru", instagram: "@tom_klaim", lastContact: "15 Mar 2026", lastNote: "WhatsApp ile iletişim kuruyoruz, numune talep etti ama karar vermedi", orders: "-", channel: "WhatsApp" },
  { id: 5, name: "Lüdmila Tetsko", company: "Baihome", country: "Kırgızistan", segment: 2, fair: "VIPTEX 2025", phone: "+7 905 630 08 71", email: "", instagram: "@bai_home.kg", lastContact: "12 Mar 2026", lastNote: "Instagram üzerinden takip ediyor, Rusça tanıtım filmi gönderildi", orders: "-", channel: "Instagram" },
  { id: 6, name: "Alexandr", company: "Edit Production", country: "Rusya", segment: 3, fair: "VIPTEX 2025", phone: "+7 977 420 48 73", email: "", instagram: "@production.edit", lastContact: "10 Mar 2026", lastNote: "Büyük firma, sürekli pazarlama mesajı atılıyor ama cevap gelmiyor. Rusça tanıtım filmi gönderildi", orders: "-", channel: "WhatsApp" },
  { id: 7, name: "Irına Kurganova", company: "Kurganova Fashion", country: "Rusya", segment: 3, fair: "VIPTEX 2025", phone: "+7 903 779 29 65", email: "k.irina80@gmail.ru", instagram: "", lastContact: "8 Mar 2026", lastNote: "Özel gün mesajları gönderiliyor, henüz geri dönüş yok", orders: "-", channel: "Email" },
  { id: 8, name: "Daria", company: "Levchenko", country: "Rusya", segment: 4, fair: "VIPTEX 2025", phone: "+7 996 027 80 32", email: "", instagram: "", lastContact: "5 Mar 2026", lastNote: "Sürekli pazarlama yapılıyor, cevap gelmiyor", orders: "-", channel: "WhatsApp" },
  { id: 9, name: "Elza", company: "Elza Fashion", country: "Rusya", segment: 4, fair: "TS 2025", phone: "+7 985 893 98 06", email: "", instagram: "", lastContact: "1 Mar 2026", lastNote: "Rusça tanıtım filmi gönderildi, okundu ama cevap gelmedi", orders: "-", channel: "Telegram" },
  { id: 10, name: "Viktor", company: "Viktor Trade", country: "Rusya", segment: 4, fair: "TS 2025", phone: "+7 961 506 95 19", email: "", instagram: "", lastContact: "28 Şub 2026", lastNote: "İletişim kurulamıyor", orders: "-", channel: "VK" },
  { id: 11, name: "Olesya", company: "Nextex", country: "Rusya", segment: 2, fair: "TS 2025", phone: "+7 962 830 86 50", email: "ceo@nex-tex.ru", instagram: "@_olesia_petrova_", lastContact: "19 Mar 2026", lastNote: "Numune gönderildi, değerlendirme aşamasında", orders: "-", channel: "Instagram" },
  { id: 12, name: "Galina", company: "Galina Sochi", country: "Rusya", segment: 3, fair: "TS 2025", phone: "+7 918 405 31 34", email: "", instagram: "", lastContact: "22 Mar 2026", lastNote: "Arandı, meşguldü, tekrar aranacak", orders: "-", channel: "Phone" },
  { id: 13, name: "Kristina", company: "Kristina Boutique", country: "Rusya", segment: 1, fair: "TS 2025", phone: "+7 937 653 00 86", email: "", instagram: "@kristina_boutique", lastContact: "24 Mar 2026", lastNote: "Yeni sipariş verdi, 5 parça. Ödeme bekleniyor", orders: "8653, 8525", channel: "WhatsApp" },
  { id: 14, name: "Tatiana", company: "Perni Fashion", country: "Rusya", segment: 2, fair: "TS 2025", phone: "+7 919 460 74 61", email: "", instagram: "", lastContact: "17 Mar 2026", lastNote: "İlgileniyor ama bütçe sıkıntısı var, gelecek sezon için not düşüldü", orders: "-", channel: "Telegram" },
  { id: 15, name: "Alisa Serginetti", company: "VIPTEX", country: "Rusya", segment: 4, fair: "VIPTEX 2025", phone: "+7 967 375 59 95", email: "", instagram: "", lastContact: "25 Şub 2026", lastNote: "Toplu mesajlar atılıyor, cevap gelmiyor", orders: "-", channel: "WhatsApp" },
];

const segmentColors: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  2: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  3: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  4: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const channelIcons: Record<string, string> = {
  WhatsApp: "🟢", Telegram: "🔵", Instagram: "🟣", Email: "📧", VK: "🔷", Phone: "📞",
};

export default function CRMPage() {
  const [activeSegment, setActiveSegment] = useState(0);
  const [country, setCountry] = useState("Tümü");
  const [search, setSearch] = useState("");

  const filtered = DEMO_CONTACTS.filter(c => {
    if (activeSegment > 0 && c.segment !== activeSegment) return false;
    if (country !== "Tümü" && c.country !== country) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.company.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const segmentCounts = SEGMENTS.map(s => s.id === 0
    ? DEMO_CONTACTS.length
    : DEMO_CONTACTS.filter(c => c.segment === s.id).length
  );

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Müşteri CRM</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Toplam {DEMO_CONTACTS.length} müşteri, {DEMO_CONTACTS.filter(c => c.segment === 1).length} aktif satış</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all">
            <Upload className="h-4 w-4" /> Excel İçe Aktar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium shadow-md shadow-blue-600/20 hover:shadow-lg transition-all">
            <Users className="h-4 w-4" /> Yeni Müşteri
          </button>
        </div>
      </div>

      {/* Segment Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {SEGMENTS.map((seg, i) => (
          <button
            key={seg.id}
            onClick={() => setActiveSegment(seg.id)}
            className={`p-4 rounded-xl border transition-all text-left ${
              activeSegment === seg.id
                ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950 shadow-sm"
                : "border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-200 dark:hover:border-slate-700"
            }`}
          >
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{segmentCounts[i]}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{seg.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Müşteri veya firma ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
          />
        </div>
        <select
          value={country}
          onChange={e => setCountry(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500"
        >
          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Contact Table */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Müşteri</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Segment</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Fuar</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Kanal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden xl:table-cell">Son Not</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Son İletişim</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(contact => (
                <tr key={contact.id} className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-sm font-semibold text-slate-600 dark:text-slate-300">
                        {contact.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{contact.name}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {contact.company} · {contact.country}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${segmentColors[contact.segment]}`}>
                      {contact.segment}. Segment
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-gray-600 dark:text-slate-400">{contact.fair}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm">{channelIcons[contact.channel] || ""} {contact.channel}</span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs truncate">{contact.lastNote}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 dark:text-slate-400">{contact.lastContact}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/crm/${contact.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-all">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
