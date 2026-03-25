"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { channelsAPI, aiBotAPI, teamAPI } from "@/lib/api";
import {
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Users,
  Bot,
  Globe,
  Rocket,
  Instagram,
  Mail,
  Send,
  MessagesSquare,
  Plus,
  X,
  Loader2,
} from "lucide-react";

const CHANNEL_OPTIONS = [
  { type: "whatsapp", name: "WhatsApp", icon: "💬", color: "#25D366", desc: "WhatsApp Business API ile bağlayın" },
  { type: "instagram", name: "Instagram", icon: "📸", color: "#E4405F", desc: "Instagram DM mesajlarını alın" },
  { type: "telegram", name: "Telegram", icon: "✈️", color: "#0088cc", desc: "Telegram Bot Token ile bağlayın" },
  { type: "email", name: "E-posta", icon: "📧", color: "#6B7280", desc: "IMAP/SMTP ile e-posta entegrasyonu" },
  { type: "facebook", name: "Facebook", icon: "👤", color: "#1877F2", desc: "Facebook Messenger mesajları" },
  { type: "livechat", name: "LiveChat", icon: "💻", color: "#8B5CF6", desc: "Web sitenize canlı sohbet ekleyin" },
];

const STEPS = [
  { id: "welcome", label: "Hoş Geldiniz", icon: Sparkles },
  { id: "channel", label: "Kanal Bağla", icon: Globe },
  { id: "aibot", label: "AI Bot", icon: Bot },
  { id: "team", label: "Takım", icon: Users },
  { id: "done", label: "Hazır!", icon: Rocket },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, organization, isAuthenticated, loadFromStorage } = useAuthStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Channel step
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [channelName, setChannelName] = useState("");

  // AI Bot step
  const [botForm, setBotForm] = useState({
    brand_name: "",
    brand_description: "",
    brand_tone: "friendly",
  });

  // Team step
  const [invites, setInvites] = useState([{ email: "", full_name: "", role: "agent" }]);
  const [inviteResults, setInviteResults] = useState<{ email: string; ok: boolean }[]>([]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (!isAuthenticated && !localStorage.getItem("token")) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (organization) {
      setBotForm((f) => ({ ...f, brand_name: organization.name }));
    }
  }, [organization]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const handleChannelCreate = async () => {
    if (!selectedChannel || !channelName.trim()) return;
    setLoading(true);
    try {
      await channelsAPI.create({ type: selectedChannel, name: channelName.trim() });
    } catch {
      // Kanal oluşturma hatası - sessizce geç
    }
    setLoading(false);
    next();
  };

  const handleBotSave = async () => {
    if (!botForm.brand_name.trim()) {
      next();
      return;
    }
    setLoading(true);
    try {
      await aiBotAPI.saveConfig({
        brand_name: botForm.brand_name,
        brand_description: botForm.brand_description,
        brand_tone: botForm.brand_tone,
        products_services: "",
        faq: "",
        policies: "",
        greeting_message: "",
        fallback_message: "",
        custom_instructions: "",
      });
    } catch {
      // Hata - sessizce geç
    }
    setLoading(false);
    next();
  };

  const handleInvites = async () => {
    const validInvites = invites.filter((i) => i.email.trim() && i.full_name.trim());
    if (validInvites.length === 0) {
      next();
      return;
    }
    setLoading(true);
    const results: { email: string; ok: boolean }[] = [];
    for (const inv of validInvites) {
      try {
        await teamAPI.invite(inv);
        results.push({ email: inv.email, ok: true });
      } catch {
        results.push({ email: inv.email, ok: false });
      }
    }
    setInviteResults(results);
    setLoading(false);
    next();
  };

  const finish = () => {
    localStorage.setItem("onboarding_done", "true");
    router.push("/inbox");
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0f1a]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-lg">Repliq</span>
        </div>
        <button
          onClick={finish}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Atla ve panele git
        </button>
      </div>

      {/* Progress */}
      <div className="max-w-3xl mx-auto w-full px-6 pt-8">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex items-center gap-2 flex-shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < step
                      ? "bg-blue-600 text-white"
                      : i === step
                        ? "bg-blue-500/20 border-2 border-blue-500 text-blue-400"
                        : "bg-white/5 border border-white/10 text-gray-500"
                  }`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={`text-xs hidden sm:block ${
                    i <= step ? "text-white" : "text-gray-500"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 rounded ${
                    i < step ? "bg-blue-600" : "bg-white/10"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-xl w-full animate-fade-in">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-8">
                <Sparkles className="h-10 w-10 text-blue-400" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-4">
                Hoş Geldiniz, {user?.full_name?.split(" ")[0]}!
              </h1>
              <p className="text-gray-400 text-lg mb-2">
                <span className="text-white font-semibold">{organization?.name}</span> için Repliq hesabınız hazır.
              </p>
              <p className="text-gray-500 mb-10">
                Birkaç adımda size en iyi deneyimi sunmak için ayarlarınızı yapalım. Bu sadece 2 dakikanızı alacak.
              </p>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-10">
                {[
                  { icon: Globe, label: "Kanal Bağla" },
                  { icon: Bot, label: "AI Bot Kur" },
                  { icon: Users, label: "Takım Davet Et" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 text-center"
                  >
                    <item.icon className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                    <span className="text-xs text-gray-300">{item.label}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={next}
                className="group inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/25"
              >
                Başlayalım
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {/* Step 1: Channel */}
          {step === 1 && (
            <div>
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <Globe className="h-7 w-7 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">İlk Kanalınızı Bağlayın</h2>
                <p className="text-gray-400">
                  Müşterilerinizin size ulaştığı kanalı seçin. Daha sonra daha fazla ekleyebilirsiniz.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {CHANNEL_OPTIONS.map((ch) => (
                  <button
                    key={ch.type}
                    onClick={() => {
                      setSelectedChannel(ch.type);
                      if (!channelName) setChannelName(ch.name);
                    }}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedChannel === ch.type
                        ? "bg-blue-500/10 border-blue-500/40"
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <span className="text-2xl block mb-2">{ch.icon}</span>
                    <span className="text-sm font-medium block">{ch.name}</span>
                    <span className="text-[11px] text-gray-500 block mt-0.5">{ch.desc}</span>
                  </button>
                ))}
              </div>

              {selectedChannel && (
                <div className="mb-6 animate-fade-in">
                  <label className="block text-sm text-gray-400 mb-1.5">Kanal Adı</label>
                  <input
                    type="text"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
                    placeholder="Örn: Mağaza Instagram"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <button
                  onClick={prev}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Geri
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={next}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Şimdilik Atla
                  </button>
                  <button
                    onClick={handleChannelCreate}
                    disabled={!selectedChannel || !channelName.trim() || loading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-all"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Kanalı Ekle
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: AI Bot */}
          {step === 2 && (
            <div>
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <Bot className="h-7 w-7 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">AI Bot'u Ayarlayın</h2>
                <p className="text-gray-400">
                  Markanız hakkında temel bilgileri girin. AI botunuz müşterilerinize otomatik yanıt versin.
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Marka Adı</label>
                  <input
                    type="text"
                    value={botForm.brand_name}
                    onChange={(e) => setBotForm({ ...botForm, brand_name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
                    placeholder="Markanızın adı"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Marka Açıklaması</label>
                  <textarea
                    value={botForm.brand_description}
                    onChange={(e) => setBotForm({ ...botForm, brand_description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all resize-none"
                    placeholder="Markanız ne iş yapar? Hangi ürün/hizmetleri sunarsınız?"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">İletişim Tonu</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "friendly", label: "Samimi", emoji: "😊" },
                      { value: "professional", label: "Profesyonel", emoji: "💼" },
                      { value: "casual", label: "Rahat", emoji: "✌️" },
                    ].map((tone) => (
                      <button
                        key={tone.value}
                        onClick={() => setBotForm({ ...botForm, brand_tone: tone.value })}
                        className={`p-3 rounded-xl border text-center transition-all text-sm ${
                          botForm.brand_tone === tone.value
                            ? "bg-blue-500/10 border-blue-500/40 text-white"
                            : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                        }`}
                      >
                        <span className="text-lg block mb-1">{tone.emoji}</span>
                        {tone.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 mb-8">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-300">
                      AI Bot'unuz 1.000 ücretsiz token ile başlar. Daha fazla detay (ürünler, SSS, politikalar) daha sonra <span className="text-white font-medium">Bot</span> sayfasından eklenebilir.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={prev}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Geri
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={next}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Şimdilik Atla
                  </button>
                  <button
                    onClick={handleBotSave}
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-all"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Kaydet ve Devam Et
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Team */}
          {step === 3 && (
            <div>
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-7 w-7 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Takımınızı Davet Edin</h2>
                <p className="text-gray-400">
                  Destek ekibinizi şimdi davet edin veya daha sonra ekleyin.
                </p>
              </div>

              <div className="space-y-3 mb-4">
                {invites.map((inv, idx) => (
                  <div key={idx} className="flex gap-2 animate-fade-in">
                    <input
                      type="text"
                      value={inv.full_name}
                      onChange={(e) => {
                        const updated = [...invites];
                        updated[idx].full_name = e.target.value;
                        setInvites(updated);
                      }}
                      className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-blue-500/50 outline-none transition-all"
                      placeholder="Ad Soyad"
                    />
                    <input
                      type="email"
                      value={inv.email}
                      onChange={(e) => {
                        const updated = [...invites];
                        updated[idx].email = e.target.value;
                        setInvites(updated);
                      }}
                      className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-blue-500/50 outline-none transition-all"
                      placeholder="E-posta adresi"
                    />
                    <select
                      value={inv.role}
                      onChange={(e) => {
                        const updated = [...invites];
                        updated[idx].role = e.target.value;
                        setInvites(updated);
                      }}
                      className="w-28 px-2 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-blue-500/50 outline-none transition-all"
                    >
                      <option value="agent" className="bg-gray-900">Ajan</option>
                      <option value="admin" className="bg-gray-900">Admin</option>
                    </select>
                    {invites.length > 1 && (
                      <button
                        onClick={() => setInvites(invites.filter((_, i) => i !== idx))}
                        className="w-10 flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {invites.length < 5 && (
                <button
                  onClick={() =>
                    setInvites([...invites, { email: "", full_name: "", role: "agent" }])
                  }
                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors mb-8"
                >
                  <Plus className="h-4 w-4" />
                  Bir kişi daha ekle
                </button>
              )}

              <div className="flex items-center justify-between">
                <button
                  onClick={prev}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Geri
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={next}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Şimdilik Atla
                  </button>
                  <button
                    onClick={handleInvites}
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-all"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Davetleri Gönder
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/20 flex items-center justify-center mx-auto mb-8">
                <Rocket className="h-10 w-10 text-green-400" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-4">
                Her Şey Hazır!
              </h1>
              <p className="text-gray-400 text-lg mb-10">
                <span className="text-white font-semibold">{organization?.name}</span> artık Repliq ile müşteri desteği vermeye hazır.
                Gelen kutunuzdan mesajlara yanıt vermeye başlayabilirsiniz.
              </p>

              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-10">
                {[
                  { icon: MessagesSquare, label: "Gelen Kutusu", desc: "Mesajları görüntüle", href: "/inbox" },
                  { icon: Globe, label: "Kanallar", desc: "Kanal ekle/düzenle", href: "/channels" },
                  { icon: Bot, label: "AI Bot", desc: "Bot'u yapılandır", href: "/bot" },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      localStorage.setItem("onboarding_done", "true");
                      router.push(item.href);
                    }}
                    className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-4 text-center transition-all group"
                  >
                    <item.icon className="h-6 w-6 text-blue-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium block">{item.label}</span>
                    <span className="text-[11px] text-gray-500 block mt-0.5">{item.desc}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={finish}
                className="group inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg shadow-blue-600/25"
              >
                Panele Git
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
