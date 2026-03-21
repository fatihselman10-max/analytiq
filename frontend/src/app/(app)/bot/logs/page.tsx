"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { botAPI } from "@/lib/api";
import { BotLog } from "@/types";
import { ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

export default function BotLogsPage() {
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await botAPI.listLogs();
        setLogs(data?.logs || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/bot" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Bot Log Kayıtları</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Kural</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Eşleşen Kelime</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Aksiyon</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Görüşme</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Zaman</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">
                    {log.rule_name || "Silinmiş Kural"}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                      {log.matched_keyword}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{log.action}</td>
                  <td className="py-3 px-4 text-gray-600">
                    {log.conversation_id ? `#${log.conversation_id}` : "-"}
                  </td>
                  <td className="py-3 px-4 text-gray-400">
                    {formatDistanceToNow(new Date(log.created_at), {
                      addSuffix: true,
                      locale: tr,
                    })}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    Henüz log kaydı yok
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
