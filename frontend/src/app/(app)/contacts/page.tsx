"use client";

import { useState, useEffect } from "react";
import { contactsAPI } from "@/lib/api";
import { Contact } from "@/types";
import { Search, UserCircle } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { isDemoOrg, DEMO_CONTACTS } from "@/lib/demo-data";

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  telegram: "Telegram",
  facebook: "Facebook",
  twitter: "Twitter/X",
  vk: "VK",
  email: "E-posta",
  livechat: "LiveChat",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const { organization } = useAuthStore();
  const isDemo = isDemoOrg(organization?.name);

  const loadContacts = async () => {
    if (isDemo) {
      let filtered = DEMO_CONTACTS as any as Contact[];
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(c => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q));
      }
      setContacts(filtered);
      setLoading(false);
      return;
    }
    try {
      const { data } = await contactsAPI.list({ search: search || undefined });
      setContacts(data?.contacts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!organization) return;
    loadContacts();
  }, [search, isDemo, organization]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Kişiler</h1>
        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">{contacts.length} kişi</span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Kişi ara..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Desktop: Table */}
      <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Kişi</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">E-posta</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Telefon</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Kanal</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
                  onClick={() => setSelectedContact(contact)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                        <span className="text-primary-700 dark:text-primary-300 text-sm font-medium">
                          {contact.name?.charAt(0) || "?"}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {contact.name || "İsimsiz"}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-slate-400">{contact.email || "-"}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-slate-400">{contact.phone || "-"}</td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400">
                      {CHANNEL_LABELS[contact.channel_type] || contact.channel_type || "-"}
                    </span>
                  </td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">
                    {search ? "Sonuç bulunamadı" : "Henüz kişi yok"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: Card List */}
      <div className="lg:hidden space-y-2">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="card p-3 flex items-center gap-3 active:bg-gray-50 dark:active:bg-slate-800 cursor-pointer"
            onClick={() => setSelectedContact(contact)}
          >
            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center flex-shrink-0">
              <span className="text-primary-700 dark:text-primary-300 text-sm font-semibold">
                {contact.name?.charAt(0) || "?"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{contact.name || "İsimsiz"}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{contact.email || contact.phone || "-"}</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 flex-shrink-0">
              {CHANNEL_LABELS[contact.channel_type] || contact.channel_type || "-"}
            </span>
          </div>
        ))}
        {contacts.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            {search ? "Sonuç bulunamadı" : "Henüz kişi yok"}
          </div>
        )}
      </div>

      {/* Contact detail modal */}
      {selectedContact && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50" onClick={() => setSelectedContact(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl lg:rounded-xl p-5 lg:p-6 w-full lg:max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Drag handle for mobile */}
            <div className="lg:hidden w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                <UserCircle className="h-8 w-8 text-primary-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedContact.name || "İsimsiz"}</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {CHANNEL_LABELS[selectedContact.channel_type] || selectedContact.channel_type}
                </p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                <span className="text-gray-500 dark:text-slate-400">E-posta</span>
                <span className="text-gray-900 dark:text-white text-right truncate ml-4">{selectedContact.email || "-"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                <span className="text-gray-500 dark:text-slate-400">Telefon</span>
                <span className="text-gray-900 dark:text-white">{selectedContact.phone || "-"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                <span className="text-gray-500 dark:text-slate-400">External ID</span>
                <span className="text-gray-900 dark:text-white text-xs font-mono truncate ml-4">{selectedContact.external_id || "-"}</span>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setSelectedContact(null)}
                className="px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 w-full lg:w-auto"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
