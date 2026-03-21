"use client";

import { useState, useEffect } from "react";
import { channelsAPI } from "@/lib/api";
import { Channel } from "@/types";
import {
  Settings, Check, Copy, X, Zap, MessageCircle, Instagram, Send as SendIcon,
  Facebook, Twitter, Globe, Mail, MessageSquare, HelpCircle, ExternalLink,
} from "lucide-react";

const WEBHOOK_BASE = "https://repliq-production-e4aa.up.railway.app/api/v1/webhooks";

interface ChannelConfig {
  type: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  iconColor: string;
  description: string;
  fields: { key: string; label: string; placeholder: string; type?: string; help?: string }[];
  hasWebhook: boolean;
}

const CHANNEL_CONFIGS: ChannelConfig[] = [
  {
    type: "whatsapp", label: "WhatsApp", icon: MessageCircle,
    color: "text-green-600", bgColor: "bg-green-50", iconColor: "text-green-600",
    description: "WhatsApp Business API ile müşteri mesajlarını alın",
    fields: [
      { key: "token", label: "Access Token", placeholder: "EAAxxxxxxx...", help: "Meta Business Suite > WhatsApp > API Setup sayfasından alabilirsiniz" },
      { key: "phone_id", label: "Phone Number ID", placeholder: "1234567890", help: "WhatsApp Business hesabınızdaki telefon numarası ID'si" },
      { key: "verify_token", label: "Verify Token", placeholder: "my-verify-token", help: "Webhook doğrulama için özel bir token belirleyin" },
    ],
    hasWebhook: true,
  },
  {
    type: "instagram", label: "Instagram", icon: Instagram,
    color: "text-pink-600", bgColor: "bg-pink-50", iconColor: "text-pink-600",
    description: "Instagram Direct mesajlarını yanıtlayın",
    fields: [
      { key: "token", label: "Access Token", placeholder: "IGQVxxxxxxx...", help: "Meta Developer Portal > Instagram Basic Display API'den alabilirsiniz" },
      { key: "app_secret", label: "App Secret", placeholder: "xxxxxxxxxxxxxxx", help: "Meta App Dashboard > Settings > Basic > App Secret" },
    ],
    hasWebhook: true,
  },
  {
    type: "telegram", label: "Telegram", icon: SendIcon,
    color: "text-blue-500", bgColor: "bg-blue-50", iconColor: "text-blue-500",
    description: "Telegram bot ile müşteri desteği verin",
    fields: [
      { key: "bot_token", label: "Bot Token", placeholder: "123456:ABC-DEF1234...", help: "@BotFather ile bot oluşturun ve token alın" },
    ],
    hasWebhook: true,
  },
  {
    type: "facebook", label: "Facebook Messenger", icon: Facebook,
    color: "text-blue-600", bgColor: "bg-blue-50", iconColor: "text-blue-600",
    description: "Facebook sayfa mesajlarını yönetin",
    fields: [
      { key: "page_token", label: "Page Access Token", placeholder: "EAAxxxxxxx...", help: "Meta Business Suite > Sayfa Ayarları > Mesajlar" },
      { key: "app_secret", label: "App Secret", placeholder: "xxxxxxxxxxxxxxx", help: "Meta App Dashboard > Settings > Basic" },
    ],
    hasWebhook: true,
  },
  {
    type: "twitter", label: "Twitter / X", icon: Twitter,
    color: "text-sky-500", bgColor: "bg-sky-50", iconColor: "text-sky-500",
    description: "Twitter DM mesajlarını yanıtlayın",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "xxxxxxxxxxxxxxx", help: "Twitter Developer Portal > Keys and Tokens" },
      { key: "api_secret", label: "API Secret", placeholder: "xxxxxxxxxxxxxxx", help: "Twitter Developer Portal > Keys and Tokens" },
      { key: "bearer_token", label: "Bearer Token", placeholder: "AAAAAAAAAAAAAAAAAAAAAxxxxxxx", help: "Twitter Developer Portal > Bearer Token" },
    ],
    hasWebhook: true,
  },
  {
    type: "vk", label: "VK", icon: Globe,
    color: "text-blue-600", bgColor: "bg-blue-50", iconColor: "text-blue-600",
    description: "VK topluluk mesajlarını yönetin",
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "vk1.a.xxxxxxx", help: "VK Community Settings > API Usage > Access Token" },
      { key: "group_id", label: "Group ID", placeholder: "123456789", help: "VK topluluk sayfanızın ID numarası" },
      { key: "secret_key", label: "Secret Key", placeholder: "xxxxxxxxxxxxxxx", help: "Callback API > Secret Key" },
    ],
    hasWebhook: true,
  },
  {
    type: "email", label: "E-posta", icon: Mail,
    color: "text-gray-600", bgColor: "bg-gray-50", iconColor: "text-gray-500",
    description: "Destek e-postalarınızı bu panelden yönetin",
    fields: [
      { key: "smtp_host", label: "SMTP Host", placeholder: "smtp.gmail.com" },
      { key: "smtp_port", label: "SMTP Port", placeholder: "587", type: "number" },
      { key: "smtp_user", label: "SMTP Kullanıcı", placeholder: "destek@sirket.com" },
      { key: "smtp_password", label: "SMTP Şifre", placeholder: "••••••••", type: "password" },
      { key: "imap_host", label: "IMAP Host", placeholder: "imap.gmail.com" },
      { key: "imap_port", label: "IMAP Port", placeholder: "993", type: "number" },
      { key: "imap_user", label: "IMAP Kullanıcı", placeholder: "destek@sirket.com" },
      { key: "imap_password", label: "IMAP Şifre", placeholder: "••••••••", type: "password" },
    ],
    hasWebhook: false,
  },
  {
    type: "livechat", label: "Canlı Destek", icon: MessageSquare,
    color: "text-purple-600", bgColor: "bg-purple-50", iconColor: "text-purple-600",
    description: "Web sitenize canlı destek widget'ı ekleyin",
    fields: [],
    hasWebhook: true,
  },
];

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConfig, setSelectedConfig] = useState<ChannelConfig | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [channelName, setChannelName] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadChannels = async () => {
    try {
      const { data } = await channelsAPI.list();
      setChannels(data?.channels || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadChannels(); }, []);

  const getConnectedChannel = (type: string) => channels.find((c) => c.type === type);

  const openConfig = (config: ChannelConfig) => {
    const existing = getConnectedChannel(config.type);
    setSelectedConfig(config);
    setChannelName(existing?.name || `${config.label} Kanalı`);
    setCredentials({});
    setCopied(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConfig) return;
    setSaving(true);
    try {
      const existing = getConnectedChannel(selectedConfig.type);
      if (existing) {
        await channelsAPI.update(existing.id, { name: channelName, credentials });
      } else {
        await channelsAPI.create({ type: selectedConfig.type, name: channelName, credentials });
      }
      setSelectedConfig(null);
      loadChannels();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (id: number) => {
    if (!confirm("Bu kanalı kaldırmak istediğinize emin misiniz?")) return;
    await channelsAPI.delete(id);
    loadChannels();
  };

  const handleToggle = async (channel: Channel) => {
    await channelsAPI.update(channel.id, { is_active: !channel.is_active });
    loadChannels();
  };

  const copyWebhook = (type: string) => {
    navigator.clipboard.writeText(`${WEBHOOK_BASE}/${type}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kanallar</h1>
        <p className="text-gray-500 mt-1">Sosyal medya ve mesajlaşma kanallarınızı bağlayarak mesajları tek panelden yönetin</p>
      </div>

      {/* Channel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {CHANNEL_CONFIGS.map((config) => {
          const connected = getConnectedChannel(config.type);
          const Icon = config.icon;
          return (
            <div key={config.type} className="card card-hover p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-xl ${config.bgColor} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${config.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm">{config.label}</h3>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{config.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                {connected ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${connected.is_active ? "bg-green-500" : "bg-gray-300"}`} />
                      <span className={`text-xs font-medium ${connected.is_active ? "text-green-600" : "text-gray-400"}`}>
                        {connected.is_active ? "Bağlı" : "Pasif"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleToggle(connected)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${connected.is_active ? "bg-green-500" : "bg-gray-300"}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${connected.is_active ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                      <button onClick={() => openConfig(config)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                        <Settings className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => openConfig(config)}
                    className="w-full py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all flex items-center justify-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    Bağla
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Help Section */}
      <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-white shadow-sm">
            <HelpCircle className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Kanal bağlantısı nasıl kurulur?</h3>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              Her kanalın üzerindeki <strong>&quot;Bağla&quot;</strong> butonuna tıklayarak ilgili platformun API bilgilerini girin.
              Webhook URL&apos;sini ilgili platformun ayarlarına yapıştırmanız yeterlidir.
              Bağlantı kurulduktan sonra o kanaldaki mesajlar otomatik olarak gelen kutunuza düşecektir.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Bağlantı kurmakta sorun yaşıyorsanız <a href="mailto:destek@repliq.io" className="text-blue-600 font-medium hover:underline">destek@repliq.io</a> adresinden bize ulaşabilirsiniz.
            </p>
          </div>
        </div>
      </div>

      {/* Connection Modal */}
      {selectedConfig && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${selectedConfig.bgColor} flex items-center justify-center`}>
                <selectedConfig.icon className={`h-5 w-5 ${selectedConfig.iconColor}`} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">{selectedConfig.label}</h2>
                <p className="text-xs text-gray-400">{selectedConfig.description}</p>
              </div>
              <button onClick={() => setSelectedConfig(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Kanal Adı</label>
                <input value={channelName} onChange={(e) => setChannelName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm" required placeholder="Örneğin: Destek WhatsApp" />
              </div>

              {selectedConfig.hasWebhook && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Webhook URL</label>
                  <div className="flex items-center gap-2">
                    <input value={`${WEBHOOK_BASE}/${selectedConfig.type}`} readOnly
                      className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-600 font-mono text-xs" />
                    <button type="button" onClick={() => copyWebhook(selectedConfig.type)}
                      className={`p-2.5 rounded-xl transition-all ${copied ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">Bu URL&apos;yi {selectedConfig.label} webhook ayarlarınıza yapıştırın</p>
                </div>
              )}

              {selectedConfig.type === "livechat" && (
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <p className="text-sm text-purple-800 font-medium mb-2">Widget Entegrasyonu</p>
                  <p className="text-xs text-purple-600 mb-3">Aşağıdaki kodu web sitenizin {"<body>"} etiketinin sonuna ekleyin:</p>
                  <pre className="bg-white rounded-lg p-3 text-xs text-gray-700 overflow-x-auto border border-purple-100">
{`<script src="https://repliq-mu.vercel.app/widget.js"
  data-org="YOUR_ORG_SLUG">
</script>`}
                  </pre>
                </div>
              )}

              {selectedConfig.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}</label>
                  <input type={field.type || "text"} value={credentials[field.key] || ""}
                    onChange={(e) => setCredentials({ ...credentials, [field.key]: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder={field.placeholder} />
                  {field.help && <p className="text-xs text-gray-400 mt-1">{field.help}</p>}
                </div>
              ))}

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                {getConnectedChannel(selectedConfig.type) && (
                  <button type="button"
                    onClick={() => { handleDisconnect(getConnectedChannel(selectedConfig.type)!.id); setSelectedConfig(null); }}
                    className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors">
                    Bağlantıyı Kes
                  </button>
                )}
                <div className="flex items-center gap-3 ml-auto">
                  <button type="button" onClick={() => setSelectedConfig(null)}
                    className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-medium text-gray-600">
                    İptal
                  </button>
                  <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm btn-gradient disabled:opacity-50">
                    {saving ? "Kaydediliyor..." : getConnectedChannel(selectedConfig.type) ? "Güncelle" : "Bağla"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
