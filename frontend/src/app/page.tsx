"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare,
  ArrowRight,
  Zap,
  Bot,
  BarChart3,
  Users,
  Shield,
  Globe,
  ChevronDown,
  ChevronRight,
  Check,
  Instagram,
  Mail,
  Send,
  MessagesSquare,
  Headphones,
  Clock,
  Star,
  Sparkles,
} from "lucide-react";

const channelLogos: Record<string, React.ReactNode> = {
  WhatsApp: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
  ),
  Instagram: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#E4405F"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
  ),
  Telegram: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#0088cc"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
  ),
  Facebook: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
  ),
  "Twitter/X": (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
  ),
  "E-posta": (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#6B7280" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
  ),
  LiveChat: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#8B5CF6" strokeWidth="2"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
  ),
};

const channels = [
  { name: "WhatsApp", color: "#25D366" },
  { name: "Instagram", color: "#E4405F" },
  { name: "Telegram", color: "#0088cc" },
  { name: "Facebook", color: "#1877F2" },
  { name: "Twitter/X", color: "#1DA1F2" },
  { name: "E-posta", color: "#6B7280" },
  { name: "LiveChat", color: "#8B5CF6" },
];

const features = [
  {
    icon: MessagesSquare,
    title: "Birleşik Gelen Kutusu",
    desc: "WhatsApp, Instagram, Telegram, E-posta ve daha fazlası. Tüm kanallarınızı tek panelden yönetin.",
  },
  {
    icon: Bot,
    title: "AI Destekli Bot",
    desc: "Claude AI ile otomatik müşteri yanıtı. Markanıza özel eğitilmiş akıllı asistan.",
  },
  {
    icon: Zap,
    title: "Anında Yanıtlar",
    desc: "Hazır yanıt şablonları ve anahtar kelime botları ile saniyeler içinde cevap verin.",
  },
  {
    icon: BarChart3,
    title: "Detaylı Raporlar",
    desc: "Ajan performansı, kanal dağılımı, mesaj analizleri ve trend raporları.",
  },
  {
    icon: Users,
    title: "Takım Yönetimi",
    desc: "Rol tabanlı erişim kontrolü. Konuşmaları atama, notlar ekleme ve takip.",
  },
  {
    icon: Shield,
    title: "Güvenli Altyapı",
    desc: "JWT kimlik doğrulama, şifrelenmiş iletişim ve güvenli veri depolama.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "0",
    period: "sonsuza dek",
    desc: "Küçük işletmeler için",
    features: [
      "2 kanal bağlantısı",
      "1.000 mesaj/ay",
      "1 takım üyesi",
      "Anahtar kelime botu",
      "Temel raporlar",
    ],
    cta: "Ücretsiz Başla",
    popular: false,
  },
  {
    name: "Pro",
    price: "49",
    period: "/ay",
    desc: "Büyüyen markalar için",
    features: [
      "Sınırsız kanal",
      "10.000 mesaj/ay",
      "5 takım üyesi",
      "AI Bot (5.000 token)",
      "Gelişmiş raporlar",
      "Öncelik desteği",
    ],
    cta: "Pro'ya Geç",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "149",
    period: "/ay",
    desc: "Büyük ekipler için",
    features: [
      "Sınırsız kanal",
      "Sınırsız mesaj",
      "Sınırsız takım üyesi",
      "AI Bot (50.000 token)",
      "API erişimi",
      "SLA garantisi",
      "Özel entegrasyonlar",
    ],
    cta: "İletişime Geç",
    popular: false,
  },
];

const faqs = [
  {
    q: "Repliq'i kurmak ne kadar sürer?",
    a: "Kayıt olduktan sonra 5 dakika içinde ilk kanalınızı bağlayabilir ve müşterilerinizden mesaj almaya başlayabilirsiniz.",
  },
  {
    q: "Hangi kanallar destekleniyor?",
    a: "WhatsApp, Instagram, Telegram, Facebook Messenger, Twitter/X DM, VK, E-posta ve web sitesi canlı sohbet desteklenmektedir.",
  },
  {
    q: "AI Bot nasıl çalışır?",
    a: "Claude AI altyapısı ile çalışan botumuz, markanız hakkındaki bilgileri öğrenir ve müşterilerinize doğal, tutarlı yanıtlar üretir.",
  },
  {
    q: "Ücretsiz plan sınırı nedir?",
    a: "Starter planı sonsuza dek ücretsizdir. 2 kanal, ayda 1.000 mesaj ve 1 takım üyesi ile başlayabilirsiniz.",
  },
  {
    q: "Verilerim güvende mi?",
    a: "Tüm veriler şifrelenmiş bağlantı üzerinden iletilir ve güvenli sunucularda saklanır. KVKK uyumlu altyapı kullanıyoruz.",
  },
];

const stats = [
  { value: "8+", label: "Desteklenen Kanal" },
  { value: "%90", label: "Daha Hızlı Yanıt" },
  { value: "7/24", label: "AI Asistan" },
  { value: "1dk", label: "Kurulum Süresi" },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border border-gray-700/50 rounded-xl overflow-hidden transition-all"
      onClick={() => setOpen(!open)}
    >
      <button className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors">
        <span className="font-medium text-white pr-4">{q}</span>
        <ChevronDown
          className={`h-5 w-5 text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 text-gray-400 leading-relaxed animate-fade-in">
          {a}
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // If already logged in, redirect to inbox
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/dashboard");
      return;
    }
    setReady(true);

    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0f1a]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white overflow-x-hidden">
      {/* Navbar */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#0a0f1a]/90 backdrop-blur-xl border-b border-white/10 shadow-lg"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">Repliq</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Özellikler
              </a>
              <a
                href="#channels"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Kanallar
              </a>
              <a
                href="#pricing"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Fiyatlandırma
              </a>
              <a
                href="#faq"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                SSS
              </a>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/auth/login"
                className="text-sm text-gray-300 hover:text-white transition-colors px-4 py-2"
              >
                Giriş Yap
              </Link>
              <Link
                href="/auth/register"
                className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/30"
              >
                Ücretsiz Başla
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 sm:pt-40 pb-20 sm:pb-32">
        {/* Background effects */}
        <div className="absolute inset-0 hero-glow" />
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px] animate-pulse-slow" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm mb-8 animate-fade-in">
            <Sparkles className="h-4 w-4" />
            <span>AI destekli müşteri hizmetleri platformu</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight mb-6 animate-slide-up">
            Müşteri Desteğini
            <br />
            <span className="text-gradient">Yeniden Tanımlayın</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-slide-up">
            Tüm mesajlaşma kanallarınızı tek bir panelde birleştirin.
            AI ile destekleyin, takımınızla koordine edin, müşterilerinizi mutlu edin.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-slide-up">
            <Link
              href="/auth/register"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-2xl shadow-blue-600/25 hover:shadow-blue-500/40"
            >
              Ücretsiz Deneyin
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white px-8 py-4 rounded-xl font-medium text-lg transition-all"
            >
              Nasıl Çalışır?
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 max-w-3xl mx-auto animate-fade-in">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-gradient">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mock UI Preview */}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-blue-500/10">
            {/* Browser chrome */}
            <div className="bg-gray-900/80 backdrop-blur-sm px-4 py-3 flex items-center gap-2 border-b border-white/10">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 text-center">
                <div className="inline-flex items-center gap-2 bg-white/5 rounded-lg px-4 py-1 text-xs text-gray-400">
                  <Shield className="h-3 w-3 text-green-400" />
                  repliqsupport.com/inbox
                </div>
              </div>
            </div>
            {/* App mockup */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-1">
              <div className="flex h-[300px] sm:h-[420px] bg-[#f8fafc] rounded-lg overflow-hidden">
                {/* Sidebar */}
                <div className="hidden sm:block w-16 bg-white border-r border-gray-100 p-3 space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  {[MessagesSquare, Users, BarChart3, Bot, Headphones].map(
                    (Icon, i) => (
                      <div
                        key={i}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto ${i === 0 ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:bg-gray-50"}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    )
                  )}
                </div>
                {/* Conversation List */}
                <div className="w-72 bg-white border-r border-gray-100 p-3 hidden md:block">
                  <div className="mb-3">
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-400">
                      Konuşmalarda ara...
                    </div>
                  </div>
                  {[
                    {
                      name: "Ayşe Yılmaz",
                      msg: "Sipariş durumumu öğrenebilir miyim?",
                      ch: "instagram",
                      color: "#E4405F",
                      time: "2dk",
                      unread: true,
                    },
                    {
                      name: "Mehmet Kaya",
                      msg: "İade işlemi başlatmak istiyorum",
                      ch: "whatsapp",
                      color: "#25D366",
                      time: "5dk",
                      unread: true,
                    },
                    {
                      name: "Zeynep Demir",
                      msg: "Teşekkür ederim, çok yardımcı oldunuz!",
                      ch: "email",
                      color: "#6B7280",
                      time: "12dk",
                      unread: false,
                    },
                    {
                      name: "Can Öztürk",
                      msg: "Beden değişikliği mümkün mü?",
                      ch: "telegram",
                      color: "#0088cc",
                      time: "28dk",
                      unread: false,
                    },
                  ].map((c, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl mb-1 cursor-pointer ${i === 0 ? "bg-blue-50/80 border border-blue-100" : "hover:bg-gray-50"}`}
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                        {c.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-900 truncate">
                            {c.name}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {c.time}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: c.color }}
                          />
                          <span className="text-[11px] text-gray-500 truncate">
                            {c.msg}
                          </span>
                        </div>
                      </div>
                      {c.unread && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                      )}
                    </div>
                  ))}
                </div>
                {/* Message Thread */}
                <div className="flex-1 flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-xs font-bold text-white">
                        A
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          Ayşe Yılmaz
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#E4405F]" />
                          <span className="text-[10px] text-gray-400">
                            Instagram
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Açık
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 p-4 space-y-3 bg-gray-50/50">
                    <div className="flex gap-2">
                      <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm border border-gray-100 max-w-xs">
                        <p className="text-sm text-gray-800">
                          Merhaba, geçen hafta verdiğim siparişin durumunu öğrenebilir miyim? Sipariş numaram #4521
                        </p>
                        <span className="text-[10px] text-gray-400 mt-1 block">
                          14:23
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-xs shadow-sm">
                        <div className="flex items-center gap-1 mb-1">
                          <Bot className="h-3 w-3" />
                          <span className="text-[10px] opacity-75">
                            AI Asistan
                          </span>
                        </div>
                        <p className="text-sm">
                          Merhaba Ayşe Hanım! Sipariş #4521 kargoya verilmiş, yarın teslim edilecek. Takip kodunuz: TR98765
                        </p>
                        <span className="text-[10px] opacity-75 mt-1 block">
                          14:23 - 2sn
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Glow effect behind the mockup */}
          <div className="absolute -inset-4 -z-10 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 rounded-3xl blur-3xl" />
        </div>
      </section>

      {/* Channel Logos Section */}
      <section id="channels" className="py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500 uppercase tracking-wider mb-8">
            Tüm kanallarınız, tek bir çatı altında
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {channels.map((ch) => (
              <div
                key={ch.name}
                className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              >
                {channelLogos[ch.name]}
                <span className="text-sm font-medium text-gray-300">
                  {ch.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              İhtiyacınız Olan Her Şey,{" "}
              <span className="text-gradient">Tek Platformda</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Müşteri desteğini profesyonelce yönetmek için ihtiyacınız olan tüm araçlar.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="feature-card group">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                  <f.icon className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 sm:py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              3 Adımda <span className="text-gradient">Başlatın</span>
            </h2>
            <p className="text-gray-400">
              Dakikalar içinde kurulumu tamamlayın ve müşterilerinize yanıt vermeye başlayın.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                title: "Kayıt Olun",
                desc: "Ücretsiz hesabınızı oluştürün ve organizasyonunuzu ayarlayın.",
                icon: Users,
              },
              {
                step: "02",
                title: "Kanalları Bağlayın",
                desc: "WhatsApp, Instagram veya diğer kanallarınızı entegre edin.",
                icon: Globe,
              },
              {
                step: "03",
                title: "Yanıt Vermeye Başlayın",
                desc: "Gelen kutunuzdan tüm müşterilere anında yanıt verin.",
                icon: Headphones,
              },
            ].map((s) => (
              <div key={s.step} className="text-center group">
                <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 mb-6 group-hover:scale-110 transition-transform">
                  <s.icon className="h-7 w-7 text-blue-400" />
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-lg bg-blue-600 text-xs font-bold flex items-center justify-center shadow-lg">
                    {s.step}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Showcase */}
      <section className="py-20 sm:py-32 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-indigo-600/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm mb-6">
                <Bot className="h-4 w-4" />
                AI Destekli
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Müşterilerinize{" "}
                <span className="text-gradient">7/24 Destek</span> Verin
              </h2>
              <p className="text-gray-400 mb-8 leading-relaxed">
                Claude AI altyapısı ile çalışan akıllı botumuz, markanızı öğrenir
                ve müşterilerinizin sorularına doğal, insani yanıtlar üretir.
                Anahtar kelime botları ile basit soruları anında cevaplayın.
              </p>
              <div className="space-y-4">
                {[
                  "Markanıza özel eğitilmiş AI",
                  "Anahtar kelime tabanlı hızlı yanıtlar",
                  "Token bazlı esnek kullanım",
                  "Tüm kanallarla uyumlu",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Check className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                    <span className="text-gray-300 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* AI Chat Demo */}
            <div className="relative">
              <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/10">
                  <Bot className="h-5 w-5 text-blue-400" />
                  <span className="font-medium">Repliq AI Asistan</span>
                  <span className="ml-auto text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                    Aktif
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                      <p className="text-sm text-gray-200">
                        Kargo süresi ne kadar?
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <div className="bg-blue-600/80 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                      <p className="text-sm">
                        Merhaba! Kargo sürelerimiz şehrinize göre değişiklik gösterebilir. İstanbul içi siparişler 1-2 iş gününde, diğer şehirler için 2-4 iş gününde teslim edilmektedir. Siparişinizi verdikten sonra size bir takip numarası iletiyoruz.
                      </p>
                      <div className="flex items-center gap-1 mt-2">
                        <Sparkles className="h-3 w-3 text-blue-300" />
                        <span className="text-[10px] text-blue-200">
                          AI tarafından oluşturuldu - 1.2sn
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                      <p className="text-sm text-gray-200">
                        İade politikanız nedir?
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <div className="bg-blue-600/80 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                      <p className="text-sm">
                        14 gün içinde, etiketi çıkarılmamış ve kullanılmamış ürünleri iade edebilirsiniz. İade kargo ücreti tarafımıza aittir. İade talebinizi bu kanaldan başlatabilirsiniz!
                      </p>
                      <div className="flex items-center gap-1 mt-2">
                        <Sparkles className="h-3 w-3 text-blue-300" />
                        <span className="text-[10px] text-blue-200">
                          AI tarafından oluşturuldu - 0.8sn
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -inset-4 -z-10 bg-blue-600/10 rounded-3xl blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 sm:py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Basit ve Şeffaf{" "}
              <span className="text-gradient">Fiyatlandırma</span>
            </h2>
            <p className="text-gray-400">
              İşletmenizin büyüklüğüne göre doğru planı seçin. İstediğiniz zaman yükseltebilirsiniz.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 transition-all ${
                  plan.popular
                    ? "bg-gradient-to-b from-blue-600/20 to-indigo-600/10 border-2 border-blue-500/30 scale-105"
                    : "bg-white/5 border border-white/10 hover:border-white/20"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-blue-600/30">
                      En Popüler
                    </span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                  <p className="text-sm text-gray-400">{plan.desc}</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold">
                    {plan.price === "0" ? "Ücretsiz" : `$${plan.price}`}
                  </span>
                  {plan.price !== "0" && (
                    <span className="text-gray-400 text-sm">{plan.period}</span>
                  )}
                  {plan.price === "0" && (
                    <span className="text-gray-400 text-sm block mt-1">
                      {plan.period}
                    </span>
                  )}
                </div>
                <div className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      <span className="text-sm text-gray-300">{f}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/auth/register"
                  className={`block text-center py-3 rounded-xl font-medium text-sm transition-all ${
                    plan.popular
                      ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25"
                      : "bg-white/10 hover:bg-white/15 text-white border border-white/10"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 sm:py-32 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Sıkça Sorulan <span className="text-gradient">Sorular</span>
            </h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-32 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 hero-glow" />
        <div className="absolute inset-0 grid-bg" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Müşteri Desteğinde
            <br />
            <span className="text-gradient">Yeni Dönemine Başlayın</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto mb-10">
            Binlerce işletme Repliq ile müşterilerine daha hızlı, daha akıllı
            destek veriyor. Siz de şimdi katılın.
          </p>
          <Link
            href="/auth/register"
            className="group inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-xl font-semibold text-lg transition-all shadow-2xl shadow-blue-600/25 hover:shadow-blue-500/40"
          >
            Ücretsiz Hesap Oluştur
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="text-sm text-gray-500 mt-4">
            Kredi kartı gerektirmez. 30 saniyede kayıt.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-4 gap-8">
            <div className="sm:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold">Repliq</span>
              </div>
              <p className="text-sm text-gray-500">
                AI destekli çok kanallı müşteri hizmetleri platformu.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-3">Ürün</h4>
              <div className="space-y-2">
                {["Özellikler", "Fiyatlandırma", "Kanallar", "AI Bot"].map(
                  (item) => (
                    <a
                      key={item}
                      href="#"
                      className="block text-sm text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {item}
                    </a>
                  )
                )}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-3">Destek</h4>
              <div className="space-y-2">
                {["Yardım Merkezi", "API Dokümantasyonu", "Durum Sayfası", "İletişim"].map(
                  (item) => (
                    <a
                      key={item}
                      href="#"
                      className="block text-sm text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {item}
                    </a>
                  )
                )}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-3">Yasal</h4>
              <div className="space-y-2">
                {["Gizlilik Politikası", "Kullanım Şartları", "KVKK"].map(
                  (item) => (
                    <a
                      key={item}
                      href="#"
                      className="block text-sm text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {item}
                    </a>
                  )
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 mt-10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              2024-2026 Repliq. Tüm hakları saklıdır.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="#"
                className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
              >
                Twitter
              </a>
              <a
                href="#"
                className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
              >
                LinkedIn
              </a>
              <a
                href="#"
                className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
              >
                Instagram
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
