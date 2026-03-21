"use client";

import { useState, useEffect } from "react";
import { contactsAPI } from "@/lib/api";
import { Contact } from "@/types";
import { Search, UserCircle } from "lucide-react";

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

  const loadContacts = async () => {
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
    loadContacts();
  }, [search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Kişiler</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Kişi ara..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
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
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedContact(contact)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-700 text-sm font-medium">
                          {contact.name?.charAt(0) || "?"}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {contact.name || "İsimsiz"}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{contact.email || "-"}</td>
                  <td className="py-3 px-4 text-gray-600">{contact.phone || "-"}</td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
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

      {/* Contact detail modal */}
      {selectedContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
                <UserCircle className="h-8 w-8 text-primary-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{selectedContact.name || "İsimsiz"}</h2>
                <p className="text-sm text-gray-500">
                  {CHANNEL_LABELS[selectedContact.channel_type] || selectedContact.channel_type}
                </p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">E-posta</span>
                <span className="text-gray-900">{selectedContact.email || "-"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Telefon</span>
                <span className="text-gray-900">{selectedContact.phone || "-"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">External ID</span>
                <span className="text-gray-900 text-xs font-mono">{selectedContact.external_id || "-"}</span>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setSelectedContact(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
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
