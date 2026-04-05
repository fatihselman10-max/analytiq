"use client";

import { useState, useEffect } from "react";
import { teamAPI } from "@/lib/api";
import { OrgMember } from "@/types";
import { useAuthStore } from "@/store/auth";
import { Plus, Trash2, Shield, UserCircle } from "lucide-react";


export default function TeamPage() {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "", role: "agent" });
  const { role: currentRole, organization } = useAuthStore();

  const isAdmin = currentRole === "owner" || currentRole === "admin";

  const loadMembers = async () => {
    try {
      const { data } = await teamAPI.listMembers();
      setMembers(data?.members || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!organization) return;
    loadMembers();
  }, [organization]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    await teamAPI.invite(inviteForm);
    setShowInvite(false);
    setInviteForm({ email: "", full_name: "", role: "agent" });
    loadMembers();
  };

  const handleRoleChange = async (userId: number, role: string) => {
    await teamAPI.updateMember(userId, role);
    loadMembers();
  };

  const handleRemove = async (userId: number) => {
    if (!confirm("Bu üyeliği kaldırmak istediğinize emin misiniz?")) return;
    await teamAPI.deleteMember(userId);
    loadMembers();
  };

  const ROLE_BADGES: Record<string, string> = {
    owner: "bg-purple-50 text-purple-700",
    admin: "bg-blue-50 text-blue-700",
    agent: "bg-gray-100 text-gray-600",
  };

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
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Ekip</h1>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Davet Et
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="divide-y divide-gray-100">
          {members.map((member) => (
            <div key={member.user_id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-700 font-medium">
                  {member.full_name.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900">{member.full_name}</h3>
                <p className="text-sm text-gray-500">{member.email}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_BADGES[member.role] || ROLE_BADGES.agent}`}>
                {member.role === "owner" ? "Sahip" : member.role === "admin" ? "Admin" : "Ajan"}
              </span>
              {isAdmin && member.role !== "owner" && (
                <div className="flex items-center gap-1">
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                  >
                    <option value="admin">Admin</option>
                    <option value="agent">Ajan</option>
                  </select>
                  <button
                    onClick={() => handleRemove(member.user_id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Ekip Üyesi Davet Et</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
                <input
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="admin">Admin</option>
                  <option value="agent">Ajan</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Davet Et
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
