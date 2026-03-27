// Messe Tekstil - Demo Data for Sales Presentation
// All data is realistic B2B wholesale textile scenario

export function isDemoOrg(orgName?: string | null): boolean {
  if (!orgName) return false;
  return orgName.toLowerCase().includes("messe");
}

// ============ TEAM ============
export const DEMO_TEAM = [
  { user_id: 101, email: "fatih@messetekstil.com", full_name: "Fatih Selman", role: "owner", avatar_url: "" },
  { user_id: 102, email: "ahmet@messetekstil.com", full_name: "Ahmet Yilmaz", role: "admin", avatar_url: "" },
  { user_id: 103, email: "mehmet@messetekstil.com", full_name: "Mehmet Kaya", role: "agent", avatar_url: "" },
  { user_id: 104, email: "ayse@messetekstil.com", full_name: "Ayse Demir", role: "agent", avatar_url: "" },
];

// ============ CHANNELS ============
export const DEMO_CHANNELS = [
  { id: 201, org_id: 10, type: "whatsapp", name: "Messe WhatsApp", is_active: true, credentials: { phone: "+90 532 XXX XX XX" }, created_at: "2026-01-15T10:00:00Z" },
  { id: 202, org_id: 10, type: "instagram", name: "Messe Instagram", is_active: true, credentials: { page_id: "messe_tekstil" }, created_at: "2026-01-15T10:00:00Z" },
  { id: 203, org_id: 10, type: "telegram", name: "Messe Telegram", is_active: true, credentials: { bot_token: "***" }, created_at: "2026-02-01T10:00:00Z" },
  { id: 204, org_id: 10, type: "email", name: "info@messetekstil.com", is_active: true, credentials: { smtp_host: "smtp.messetekstil.com" }, created_at: "2026-01-20T10:00:00Z" },
  { id: 205, org_id: 10, type: "vk", name: "Messe VK", is_active: true, credentials: { group_id: "messe_textile" }, created_at: "2026-02-10T10:00:00Z" },
];

// ============ CONTACTS ============
export const DEMO_CONTACTS = [
  { id: 301, org_id: 10, external_id: "wa_anna", channel_type: "whatsapp", name: "Anna Morozova", email: "anna@viptex.ru", phone: "+7 905 106 53 53", avatar_url: "" },
  { id: 302, org_id: 10, external_id: "tg_oleg", channel_type: "telegram", name: "Oleg Petrov", email: "oleg@chezelle.ru", phone: "+7 921 963 88 82", avatar_url: "" },
  { id: 303, org_id: 10, external_id: "wa_svetlana", channel_type: "whatsapp", name: "Svetlana Sivaeva", email: "svetlana.terramd@mail.ru", phone: "+7 916 106 03 20", avatar_url: "" },
  { id: 304, org_id: 10, external_id: "wa_nadezdha", channel_type: "whatsapp", name: "Nadezdha Akulshina", email: "klaim_work@mail.ru", phone: "+7 910 467 61 66", avatar_url: "" },
  { id: 305, org_id: 10, external_id: "ig_ludmila", channel_type: "instagram", name: "Ludmila Tetsko", email: "", phone: "+7 905 630 08 71", avatar_url: "" },
  { id: 306, org_id: 10, external_id: "wa_alexandr", channel_type: "whatsapp", name: "Alexandr Volkov", email: "", phone: "+7 977 420 48 73", avatar_url: "" },
  { id: 307, org_id: 10, external_id: "em_irina", channel_type: "email", name: "Irina Kurganova", email: "k.irina80@gmail.ru", phone: "+7 903 779 29 65", avatar_url: "" },
  { id: 308, org_id: 10, external_id: "wa_daria", channel_type: "whatsapp", name: "Daria Levchenko", email: "", phone: "+7 996 027 80 32", avatar_url: "" },
  { id: 309, org_id: 10, external_id: "tg_elza", channel_type: "telegram", name: "Elza Fashion", email: "", phone: "+7 985 893 98 06", avatar_url: "" },
  { id: 310, org_id: 10, external_id: "vk_viktor", channel_type: "vk", name: "Viktor Sokolov", email: "", phone: "+7 961 506 95 19", avatar_url: "" },
  { id: 311, org_id: 10, external_id: "ig_olesya", channel_type: "instagram", name: "Olesya Petrova", email: "ceo@nex-tex.ru", phone: "+7 962 830 86 50", avatar_url: "" },
  { id: 312, org_id: 10, external_id: "wa_galina", channel_type: "whatsapp", name: "Galina Sochi", email: "", phone: "+7 918 405 31 34", avatar_url: "" },
  { id: 313, org_id: 10, external_id: "wa_kristina", channel_type: "whatsapp", name: "Kristina Boutique", email: "", phone: "+7 937 653 00 86", avatar_url: "" },
  { id: 314, org_id: 10, external_id: "tg_tatiana", channel_type: "telegram", name: "Tatiana Perni", email: "", phone: "+7 919 460 74 61", avatar_url: "" },
  { id: 315, org_id: 10, external_id: "wa_alisa", channel_type: "whatsapp", name: "Alisa Serginetti", email: "", phone: "+7 967 375 59 95", avatar_url: "" },
];

// ============ CONVERSATIONS ============
export const DEMO_CONVERSATIONS = [
  {
    id: 401, org_id: 10, channel_id: 201, contact_id: 301, assigned_to: 102,
    status: "open", priority: "high", subject: "Yeni sezon siparis - Anna Morozova",
    channel_type: "whatsapp",
    contact: { id: 301, name: "Anna Morozova", email: "anna@viptex.ru", avatar_url: "" },
    assigned_user: { id: 102, email: "ahmet@messetekstil.com", full_name: "Ahmet Yilmaz", avatar_url: "" },
    tags: [{ id: 1, name: "VIP", color: "#10b981" }, { id: 2, name: "Siparis", color: "#3b82f6" }],
    last_message: "Merhaba, yeni sezon numunelerini ne zaman gonderebilirsiniz?",
    last_message_at: "2026-03-25T14:30:00Z",
    created_at: "2026-03-20T09:00:00Z",
    first_response_at: "2026-03-20T09:15:00Z",
  },
  {
    id: 402, org_id: 10, channel_id: 203, contact_id: 302, assigned_to: 102,
    status: "open", priority: "normal", subject: "Katalog talebi - Oleg Petrov",
    channel_type: "telegram",
    contact: { id: 302, name: "Oleg Petrov", email: "oleg@chezelle.ru", avatar_url: "" },
    assigned_user: { id: 102, email: "ahmet@messetekstil.com", full_name: "Ahmet Yilmaz", avatar_url: "" },
    tags: [{ id: 1, name: "VIP", color: "#10b981" }],
    last_message: "Katalog PDF geldi tesekkurler, fiyat listesi de var mi?",
    last_message_at: "2026-03-25T12:45:00Z",
    created_at: "2026-03-22T14:00:00Z",
    first_response_at: "2026-03-22T14:20:00Z",
  },
  {
    id: 403, org_id: 10, channel_id: 201, contact_id: 303, assigned_to: 103,
    status: "pending", priority: "normal", subject: "Fiyat bilgisi - Svetlana Sivaeva",
    channel_type: "whatsapp",
    contact: { id: 303, name: "Svetlana Sivaeva", email: "svetlana.terramd@mail.ru", avatar_url: "" },
    assigned_user: { id: 103, email: "mehmet@messetekstil.com", full_name: "Mehmet Kaya", avatar_url: "" },
    tags: [{ id: 3, name: "Fiyat Talebi", color: "#f59e0b" }],
    last_message: "Fiyat listesini inceliyorum, en kisa surede donus yaparim",
    last_message_at: "2026-03-24T16:20:00Z",
    created_at: "2026-03-18T11:00:00Z",
    first_response_at: "2026-03-18T11:30:00Z",
  },
  {
    id: 404, org_id: 10, channel_id: 202, contact_id: 305, assigned_to: 104,
    status: "open", priority: "normal", subject: "Instagram DM - Ludmila Tetsko",
    channel_type: "instagram",
    contact: { id: 305, name: "Ludmila Tetsko", email: "", avatar_url: "" },
    assigned_user: { id: 104, email: "ayse@messetekstil.com", full_name: "Ayse Demir", avatar_url: "" },
    tags: [{ id: 4, name: "Numune", color: "#8b5cf6" }],
    last_message: "Bu modelin baska renkleri var mi? Kirgizistan'a kargo nasil oluyor?",
    last_message_at: "2026-03-25T10:15:00Z",
    created_at: "2026-03-23T08:30:00Z",
    first_response_at: "2026-03-23T09:00:00Z",
  },
  {
    id: 405, org_id: 10, channel_id: 204, contact_id: 307, assigned_to: 102,
    status: "resolved", priority: "high", subject: "Siparis durumu #8601 - Irina Kurganova",
    channel_type: "email",
    contact: { id: 307, name: "Irina Kurganova", email: "k.irina80@gmail.ru", avatar_url: "" },
    assigned_user: { id: 102, email: "ahmet@messetekstil.com", full_name: "Ahmet Yilmaz", avatar_url: "" },
    tags: [{ id: 2, name: "Siparis", color: "#3b82f6" }],
    last_message: "Siparisiniz kargoya verilmistir. Takip numarasi: TR2026031587642",
    last_message_at: "2026-03-23T17:00:00Z",
    created_at: "2026-03-21T10:00:00Z",
    first_response_at: "2026-03-21T10:10:00Z",
    resolved_at: "2026-03-23T17:00:00Z",
  },
  {
    id: 406, org_id: 10, channel_id: 205, contact_id: 310, assigned_to: null,
    status: "open", priority: "low", subject: "VK mesaji - Viktor Sokolov",
    channel_type: "vk",
    contact: { id: 310, name: "Viktor Sokolov", email: "", avatar_url: "" },
    assigned_user: null,
    tags: [],
    last_message: "Zdravstvuyte, ya videl vashi produkty na VIPTEX. Mozhno uznat ceny?",
    last_message_at: "2026-03-25T08:00:00Z",
    created_at: "2026-03-25T08:00:00Z",
  },
  {
    id: 407, org_id: 10, channel_id: 201, contact_id: 313, assigned_to: 103,
    status: "resolved", priority: "urgent", subject: "Acil siparis - Kristina Boutique",
    channel_type: "whatsapp",
    contact: { id: 313, name: "Kristina Boutique", email: "", avatar_url: "" },
    assigned_user: { id: 103, email: "mehmet@messetekstil.com", full_name: "Mehmet Kaya", avatar_url: "" },
    tags: [{ id: 1, name: "VIP", color: "#10b981" }, { id: 2, name: "Siparis", color: "#3b82f6" }],
    last_message: "Siparisim hazirlandi, tesekkur ederim! Harika is cikardik",
    last_message_at: "2026-03-24T18:00:00Z",
    created_at: "2026-03-22T09:00:00Z",
    first_response_at: "2026-03-22T09:05:00Z",
    resolved_at: "2026-03-24T18:00:00Z",
  },
  {
    id: 408, org_id: 10, channel_id: 203, contact_id: 314, assigned_to: 104,
    status: "pending", priority: "normal", subject: "Butce gorusmesi - Tatiana Perni",
    channel_type: "telegram",
    contact: { id: 314, name: "Tatiana Perni", email: "", avatar_url: "" },
    assigned_user: { id: 104, email: "ayse@messetekstil.com", full_name: "Ayse Demir", avatar_url: "" },
    tags: [{ id: 3, name: "Fiyat Talebi", color: "#f59e0b" }],
    last_message: "Bu sezon butcemiz kisitli ama gelecek sezon kesinlikle siparis vermek istiyoruz",
    last_message_at: "2026-03-24T14:00:00Z",
    created_at: "2026-03-19T11:00:00Z",
    first_response_at: "2026-03-19T11:45:00Z",
  },
  {
    id: 409, org_id: 10, channel_id: 201, contact_id: 304, assigned_to: 102,
    status: "open", priority: "normal", subject: "Numune talebi - Nadezdha Akulshina",
    channel_type: "whatsapp",
    contact: { id: 304, name: "Nadezdha Akulshina", email: "klaim_work@mail.ru", avatar_url: "" },
    assigned_user: { id: 102, email: "ahmet@messetekstil.com", full_name: "Ahmet Yilmaz", avatar_url: "" },
    tags: [{ id: 4, name: "Numune", color: "#8b5cf6" }],
    last_message: "3 model numune gondermek istiyoruz, adres bilginizi alabilir miyiz?",
    last_message_at: "2026-03-25T11:00:00Z",
    created_at: "2026-03-21T15:00:00Z",
    first_response_at: "2026-03-21T15:20:00Z",
  },
  {
    id: 410, org_id: 10, channel_id: 202, contact_id: 311, assigned_to: 104,
    status: "resolved", priority: "normal", subject: "Urun bilgisi - Olesya Petrova",
    channel_type: "instagram",
    contact: { id: 311, name: "Olesya Petrova", email: "ceo@nex-tex.ru", avatar_url: "" },
    assigned_user: { id: 104, email: "ayse@messetekstil.com", full_name: "Ayse Demir", avatar_url: "" },
    tags: [],
    last_message: "Numuneleri aldim, cok begendim. Siparis icin tekrar yazacagim",
    last_message_at: "2026-03-22T16:00:00Z",
    created_at: "2026-03-17T13:00:00Z",
    first_response_at: "2026-03-17T13:10:00Z",
    resolved_at: "2026-03-22T16:00:00Z",
  },
];

// ============ MESSAGES (per conversation) ============
export const DEMO_MESSAGES: Record<number, Array<{
  id: number; conversation_id: number; sender_type: string; sender_name: string;
  content: string; content_type: string; is_internal: boolean; created_at: string;
}>> = {
  401: [
    { id: 5001, conversation_id: 401, sender_type: "contact", sender_name: "Anna Morozova", content: "Merhaba, VIPTEX fuarindan Anna. Yeni sezon koleksiyonunuzu gormek istiyoruz.", content_type: "text", is_internal: false, created_at: "2026-03-20T09:00:00Z" },
    { id: 5002, conversation_id: 401, sender_type: "bot", sender_name: "AI Asistan", content: "Merhaba Anna Hanim! Messe Tekstil'e hosgeldiniz. Size yeni sezon koleksiyonumuz hakkinda yardimci olabilmemiz icin sizi bir temsilcimize yonlendiriyorum.", content_type: "text", is_internal: false, created_at: "2026-03-20T09:01:00Z" },
    { id: 5003, conversation_id: 401, sender_type: "agent", sender_name: "Ahmet Yilmaz", content: "Merhaba Anna Hanim, ben Ahmet. VIPTEX'te gormek guzeldi! Yeni sezon katalogunu hemen hazirlayip gonderiyorum. Hangi kategoriler ilginizi cekiyor? Elbise, gomlek, dis giyim?", content_type: "text", is_internal: false, created_at: "2026-03-20T09:15:00Z" },
    { id: 5004, conversation_id: 401, sender_type: "contact", sender_name: "Anna Morozova", content: "Elbise ve dis giyim kategorileri lutfen. Gecen sezon 8609 ve 8733 numarali siparislerimiz cok iyi satti.", content_type: "text", is_internal: false, created_at: "2026-03-20T09:30:00Z" },
    { id: 5005, conversation_id: 401, sender_type: "agent", sender_name: "Ahmet Yilmaz", content: "Harika! O modellerin devami olan yeni tasarimlarimiz var. Katalog + fiyat listesi gonderdim. 3 modelde numune hazirlayabilir miyiz?", content_type: "text", is_internal: false, created_at: "2026-03-20T10:00:00Z" },
    { id: 5006, conversation_id: 401, sender_type: "agent", sender_name: "Ahmet Yilmaz", content: "Anna Hanim VIP musterimiz, gecen sezon 2 buyuk siparis verdi. Numune oncelikli gonderilmeli.", content_type: "text", is_internal: true, created_at: "2026-03-20T10:05:00Z" },
    { id: 5007, conversation_id: 401, sender_type: "contact", sender_name: "Anna Morozova", content: "Evet lutfen numune gonderin. Adresimiz ayni: Moskova, Tverskaya 15. Bu sezon 5-6 model almak istiyoruz.", content_type: "text", is_internal: false, created_at: "2026-03-22T11:00:00Z" },
    { id: 5008, conversation_id: 401, sender_type: "agent", sender_name: "Ahmet Yilmaz", content: "Super! Numuneleri bugun hazirlattim, yarin kargoya veriyoruz. 5-7 is gunu icerisinde elinizde olacak. Takip numarasini paylasacagim.", content_type: "text", is_internal: false, created_at: "2026-03-22T11:30:00Z" },
    { id: 5009, conversation_id: 401, sender_type: "contact", sender_name: "Anna Morozova", content: "Merhaba, yeni sezon numunelerini ne zaman gonderebilirsiniz?", content_type: "text", is_internal: false, created_at: "2026-03-25T14:30:00Z" },
  ],
  402: [
    { id: 5010, conversation_id: 402, sender_type: "contact", sender_name: "Oleg Petrov", content: "Merhaba, Elena Chezelle'den Oleg. Yeni sezon katalogunuzu gonderebilir misiniz?", content_type: "text", is_internal: false, created_at: "2026-03-22T14:00:00Z" },
    { id: 5011, conversation_id: 402, sender_type: "agent", sender_name: "Ahmet Yilmaz", content: "Merhaba Oleg Bey! Tabii ki, hemen gonderiyorum. PDF olarak mi yoksa online link mi tercih edersiniz?", content_type: "text", is_internal: false, created_at: "2026-03-22T14:20:00Z" },
    { id: 5012, conversation_id: 402, sender_type: "contact", sender_name: "Oleg Petrov", content: "PDF olarak gonderirseniz sevinirim, ofiste yazdiracagiz.", content_type: "text", is_internal: false, created_at: "2026-03-22T14:35:00Z" },
    { id: 5013, conversation_id: 402, sender_type: "agent", sender_name: "Ahmet Yilmaz", content: "Katalogu gonderdim! 48 sayfa, tum yeni sezon urunleri mevcut. Begendiginiz modelleri isaretleyip gonderirseniz fiyat teklifi hazirlayalim.", content_type: "text", is_internal: false, created_at: "2026-03-22T15:00:00Z" },
    { id: 5014, conversation_id: 402, sender_type: "contact", sender_name: "Oleg Petrov", content: "Katalog PDF geldi tesekkurler, fiyat listesi de var mi?", content_type: "text", is_internal: false, created_at: "2026-03-25T12:45:00Z" },
  ],
  403: [
    { id: 5020, conversation_id: 403, sender_type: "contact", sender_name: "Svetlana Sivaeva", content: "Merhaba, VIPTEX fuarindan Svetlana. Fiyat listesi alabilir miyim?", content_type: "text", is_internal: false, created_at: "2026-03-18T11:00:00Z" },
    { id: 5021, conversation_id: 403, sender_type: "agent", sender_name: "Mehmet Kaya", content: "Merhaba Svetlana Hanim! VIPTEX'te tanismistik, fiyat listesini hemen gonderiyorum.", content_type: "text", is_internal: false, created_at: "2026-03-18T11:30:00Z" },
    { id: 5022, conversation_id: 403, sender_type: "contact", sender_name: "Svetlana Sivaeva", content: "Tesekkurler, fiyatlar uygun gorunuyor. Birkagun inceleyip donus yapacagim.", content_type: "text", is_internal: false, created_at: "2026-03-20T14:00:00Z" },
    { id: 5023, conversation_id: 403, sender_type: "contact", sender_name: "Svetlana Sivaeva", content: "Fiyat listesini inceliyorum, en kisa surede donus yaparim", content_type: "text", is_internal: false, created_at: "2026-03-24T16:20:00Z" },
  ],
  404: [
    { id: 5030, conversation_id: 404, sender_type: "contact", sender_name: "Ludmila Tetsko", content: "Salam! Sizin urunlerinizi instagramda gordum, cok guzel. Kirgizistan'a gonderim yapiyor musunuz?", content_type: "text", is_internal: false, created_at: "2026-03-23T08:30:00Z" },
    { id: 5031, conversation_id: 404, sender_type: "bot", sender_name: "AI Asistan", content: "Merhaba! Messe Tekstil'e ilginiz icin tesekkurler. Evet, Kirgizistan'a kargo gonderimi yapiyoruz. Sizi bir temsilcimize yonlendiriyorum.", content_type: "text", is_internal: false, created_at: "2026-03-23T08:31:00Z" },
    { id: 5032, conversation_id: 404, sender_type: "agent", sender_name: "Ayse Demir", content: "Merhaba Ludmila Hanim! Kirgizistan'a kargo 7-10 is gunu suruyor. Minimum siparis 50 adet. Hangi urunler ilginizi cekti?", content_type: "text", is_internal: false, created_at: "2026-03-23T09:00:00Z" },
    { id: 5033, conversation_id: 404, sender_type: "contact", sender_name: "Ludmila Tetsko", content: "Bu modelin baska renkleri var mi? Kirgizistan'a kargo nasil oluyor?", content_type: "text", is_internal: false, created_at: "2026-03-25T10:15:00Z" },
  ],
  405: [
    { id: 5040, conversation_id: 405, sender_type: "contact", sender_name: "Irina Kurganova", content: "Merhaba, siparis numaram 8601. Siparisim ne durumda?", content_type: "text", is_internal: false, created_at: "2026-03-21T10:00:00Z" },
    { id: 5041, conversation_id: 405, sender_type: "bot", sender_name: "AI Asistan", content: "Siparis #8601 bilgilerinizi kontrol ediyorum... Siparisiz hazirlaniyor, tahmini kargo tarihi 23 Mart. Detayli bilgi icin temsilcinize yonlendiriyorum.", content_type: "text", is_internal: false, created_at: "2026-03-21T10:01:00Z" },
    { id: 5042, conversation_id: 405, sender_type: "agent", sender_name: "Ahmet Yilmaz", content: "Irina Hanim merhaba! Siparisiz #8601 paketleme asamasinda. Yarin kargoya teslim edilecek.", content_type: "text", is_internal: false, created_at: "2026-03-21T10:10:00Z" },
    { id: 5043, conversation_id: 405, sender_type: "agent", sender_name: "Ahmet Yilmaz", content: "Siparisiniz kargoya verilmistir. Takip numarasi: TR2026031587642", content_type: "text", is_internal: false, created_at: "2026-03-23T17:00:00Z" },
  ],
  406: [
    { id: 5050, conversation_id: 406, sender_type: "contact", sender_name: "Viktor Sokolov", content: "Zdravstvuyte, ya videl vashi produkty na VIPTEX. Mozhno uznat ceny?", content_type: "text", is_internal: false, created_at: "2026-03-25T08:00:00Z" },
    { id: 5051, conversation_id: 406, sender_type: "bot", sender_name: "AI Asistan", content: "Zdravstvuyte! Dobro pozhalovat v Messe Tekstil. Da, konechno! My mozhem otpravit vam nash katalog i prays-list. Kakiye tkani vas interesuyut? U nas yest: Satin, Krep, Viskon, Pamuk, Scuba, Shifon.", content_type: "text", is_internal: false, created_at: "2026-03-25T08:01:00Z" },
    { id: 5052, conversation_id: 406, sender_type: "agent", sender_name: "Ahmet Yilmaz", content: "Rusca yaziyorlar - bot otomatik Rusca cevap verdi. Takip ediyorum.", content_type: "text", is_internal: true, created_at: "2026-03-25T08:05:00Z" },
    { id: 5053, conversation_id: 406, sender_type: "contact", sender_name: "Viktor Sokolov", content: "Spasibo! Menya interesuyut satin i krep. Kakoye minimalnoe kolichestvo dlya zakaza?", content_type: "text", is_internal: false, created_at: "2026-03-25T09:30:00Z" },
    { id: 5054, conversation_id: 406, sender_type: "agent", sender_name: "Ahmet Yilmaz", content: "Viktor Bey, minimum order for satin and krep is 500 meters per color. We can send you free samples first (3 colors). Price: Satin 85 TL/m, Krep 72 TL/m. Shall I prepare samples?", content_type: "text", is_internal: false, created_at: "2026-03-25T10:00:00Z" },
  ],
  407: [
    { id: 5060, conversation_id: 407, sender_type: "contact", sender_name: "Kristina Boutique", content: "Acil siparis vermemiz gerekiyor! 5 model, her birinden 20 adet. En erken ne zaman hazirlayabilirsiniz?", content_type: "text", is_internal: false, created_at: "2026-03-22T09:00:00Z" },
    { id: 5061, conversation_id: 407, sender_type: "agent", sender_name: "Mehmet Kaya", content: "Kristina Hanim merhaba! Hangi modelleri istiyorsunuz? Stok durumuna gore hemen hazirlayabiliriz.", content_type: "text", is_internal: false, created_at: "2026-03-22T09:05:00Z" },
    { id: 5062, conversation_id: 407, sender_type: "contact", sender_name: "Kristina Boutique", content: "Model 1204, 1207, 1215, 1218, 1222. Hepsi S-M-L beden. Toplam 100 adet.", content_type: "text", is_internal: false, created_at: "2026-03-22T09:20:00Z" },
    { id: 5063, conversation_id: 407, sender_type: "agent", sender_name: "Mehmet Kaya", content: "Kontrol ettim, hepsi stokta! Proforma faturayi hazirliyorum. Odeme sonrasi 2 is gunu icerisinde kargoya veririz.", content_type: "text", is_internal: false, created_at: "2026-03-22T09:45:00Z" },
    { id: 5064, conversation_id: 407, sender_type: "contact", sender_name: "Kristina Boutique", content: "Harika! Odemeyi simdi yapiyorum.", content_type: "text", is_internal: false, created_at: "2026-03-22T10:00:00Z" },
    { id: 5065, conversation_id: 407, sender_type: "system", sender_name: "Sistem", content: "Odeme alindi. Siparis #8653 olusturuldu.", content_type: "text", is_internal: false, created_at: "2026-03-22T10:30:00Z" },
    { id: 5066, conversation_id: 407, sender_type: "agent", sender_name: "Mehmet Kaya", content: "Siparisiniz kargoya verildi! Takip: TR2026032289145. 3-5 gun icerisinde ulasacak.", content_type: "text", is_internal: false, created_at: "2026-03-24T14:00:00Z" },
    { id: 5067, conversation_id: 407, sender_type: "contact", sender_name: "Kristina Boutique", content: "Siparisim hazirlandi, tesekkur ederim! Harika is cikardik", content_type: "text", is_internal: false, created_at: "2026-03-24T18:00:00Z" },
  ],
  408: [
    { id: 5070, conversation_id: 408, sender_type: "contact", sender_name: "Tatiana Perni", content: "Merhaba, fiyatlarinizi ogrenmek istiyoruz ama bu sezon butcemiz cok kisitli.", content_type: "text", is_internal: false, created_at: "2026-03-19T11:00:00Z" },
    { id: 5071, conversation_id: 408, sender_type: "agent", sender_name: "Ayse Demir", content: "Tatiana Hanim merhaba! Anliyorum. Size ozel bir fiyat teklifi hazirlayabiliriz. Hangi urunlere bakiyorsunuz?", content_type: "text", is_internal: false, created_at: "2026-03-19T11:45:00Z" },
    { id: 5072, conversation_id: 408, sender_type: "contact", sender_name: "Tatiana Perni", content: "Bu sezon butcemiz kisitli ama gelecek sezon kesinlikle siparis vermek istiyoruz", content_type: "text", is_internal: false, created_at: "2026-03-24T14:00:00Z" },
  ],
  409: [
    { id: 5080, conversation_id: 409, sender_type: "contact", sender_name: "Nadezdha Akulshina", content: "Merhaba, Tom Klaim markasi olarak numune talep etmek istiyoruz.", content_type: "text", is_internal: false, created_at: "2026-03-21T15:00:00Z" },
    { id: 5081, conversation_id: 409, sender_type: "agent", sender_name: "Ahmet Yilmaz", content: "Nadezdha Hanim merhaba! Tabii ki, hangi kategorilerden numune istersiniz?", content_type: "text", is_internal: false, created_at: "2026-03-21T15:20:00Z" },
    { id: 5082, conversation_id: 409, sender_type: "contact", sender_name: "Nadezdha Akulshina", content: "Elbise ve bluz kategorisinden 3-4 model yeterli.", content_type: "text", is_internal: false, created_at: "2026-03-23T10:00:00Z" },
    { id: 5083, conversation_id: 409, sender_type: "agent", sender_name: "Ahmet Yilmaz", content: "3 model numune gondermek istiyoruz, adres bilginizi alabilir miyiz?", content_type: "text", is_internal: false, created_at: "2026-03-25T11:00:00Z" },
  ],
  410: [
    { id: 5090, conversation_id: 410, sender_type: "contact", sender_name: "Olesya Petrova", content: "Merhaba, Nextex firmasiyiz. Instagramda gordugunuz urunler hakkinda bilgi almak istiyoruz.", content_type: "text", is_internal: false, created_at: "2026-03-17T13:00:00Z" },
    { id: 5091, conversation_id: 410, sender_type: "agent", sender_name: "Ayse Demir", content: "Merhaba Olesya Hanim! Hosgeldiniz. Hangi urunler ilginizi cekti?", content_type: "text", is_internal: false, created_at: "2026-03-17T13:10:00Z" },
    { id: 5092, conversation_id: 410, sender_type: "contact", sender_name: "Olesya Petrova", content: "Model 1204 ve 1215. Numune alabilir miyiz?", content_type: "text", is_internal: false, created_at: "2026-03-18T09:00:00Z" },
    { id: 5093, conversation_id: 410, sender_type: "agent", sender_name: "Ayse Demir", content: "Tabii! Numuneleri hazirlattim, yarin kargoya veriyoruz.", content_type: "text", is_internal: false, created_at: "2026-03-18T09:30:00Z" },
    { id: 5094, conversation_id: 410, sender_type: "contact", sender_name: "Olesya Petrova", content: "Numuneleri aldim, cok begendim. Siparis icin tekrar yazacagim", content_type: "text", is_internal: false, created_at: "2026-03-22T16:00:00Z" },
  ],
};

// ============ SLA STATUSES ============
export const DEMO_SLA_STATUSES: Record<number, { response_breached: boolean; resolution_breached: boolean; response_elapsed: number; response_target: number }> = {
  401: { response_breached: false, resolution_breached: false, response_elapsed: 15, response_target: 30 },
  402: { response_breached: false, resolution_breached: false, response_elapsed: 20, response_target: 30 },
  403: { response_breached: false, resolution_breached: false, response_elapsed: 30, response_target: 60 },
  404: { response_breached: false, resolution_breached: false, response_elapsed: 30, response_target: 60 },
  405: { response_breached: false, resolution_breached: false, response_elapsed: 10, response_target: 30 },
  406: { response_breached: true, resolution_breached: false, response_elapsed: 45, response_target: 30 },
  407: { response_breached: false, resolution_breached: false, response_elapsed: 5, response_target: 15 },
  408: { response_breached: true, resolution_breached: false, response_elapsed: 45, response_target: 30 },
  409: { response_breached: false, resolution_breached: false, response_elapsed: 20, response_target: 30 },
  410: { response_breached: false, resolution_breached: false, response_elapsed: 10, response_target: 60 },
};

// ============ REPORTS ============
export const DEMO_REPORTS = {
  overview: {
    total_conversations: 47,
    open_conversations: 18,
    resolved_conversations: 24,
    pending_conversations: 5,
    avg_response_time: 14.3,
    avg_resolution_time: 285,
    satisfaction_rate: 92,
    daily: [
      { date: "2026-03-01", count: 3 }, { date: "2026-03-02", count: 2 }, { date: "2026-03-03", count: 5 },
      { date: "2026-03-04", count: 4 }, { date: "2026-03-05", count: 6 }, { date: "2026-03-06", count: 3 },
      { date: "2026-03-07", count: 1 }, { date: "2026-03-08", count: 2 }, { date: "2026-03-09", count: 4 },
      { date: "2026-03-10", count: 7 }, { date: "2026-03-11", count: 5 }, { date: "2026-03-12", count: 6 },
      { date: "2026-03-13", count: 4 }, { date: "2026-03-14", count: 3 }, { date: "2026-03-15", count: 2 },
      { date: "2026-03-16", count: 5 }, { date: "2026-03-17", count: 8 }, { date: "2026-03-18", count: 6 },
      { date: "2026-03-19", count: 4 }, { date: "2026-03-20", count: 7 }, { date: "2026-03-21", count: 5 },
      { date: "2026-03-22", count: 9 }, { date: "2026-03-23", count: 6 }, { date: "2026-03-24", count: 4 },
      { date: "2026-03-25", count: 8 },
    ],
  },
  agents: [
    { agent_id: 102, agent_name: "Ahmet Yilmaz", total_conversations: 22, resolved: 16, avg_response_time: 11.5, avg_resolution_time: 240, satisfaction: 95 },
    { agent_id: 103, agent_name: "Mehmet Kaya", total_conversations: 14, resolved: 10, avg_response_time: 15.2, avg_resolution_time: 310, satisfaction: 90 },
    { agent_id: 104, agent_name: "Ayse Demir", total_conversations: 11, resolved: 8, avg_response_time: 18.7, avg_resolution_time: 295, satisfaction: 88 },
  ],
  channels: [
    { channel: "whatsapp", count: 24, percentage: 51 },
    { channel: "telegram", count: 8, percentage: 17 },
    { channel: "instagram", count: 7, percentage: 15 },
    { channel: "email", count: 5, percentage: 11 },
    { channel: "vk", count: 3, percentage: 6 },
  ],
  messages: {
    total: 312,
    inbound: 178,
    outbound: 134,
    hourly: [
      { hour: 0, count: 1 }, { hour: 1, count: 0 }, { hour: 2, count: 0 }, { hour: 3, count: 1 },
      { hour: 4, count: 2 }, { hour: 5, count: 3 }, { hour: 6, count: 5 }, { hour: 7, count: 8 },
      { hour: 8, count: 15 }, { hour: 9, count: 28 }, { hour: 10, count: 32 }, { hour: 11, count: 35 },
      { hour: 12, count: 22 }, { hour: 13, count: 25 }, { hour: 14, count: 30 }, { hour: 15, count: 27 },
      { hour: 16, count: 20 }, { hour: 17, count: 18 }, { hour: 18, count: 12 }, { hour: 19, count: 8 },
      { hour: 20, count: 5 }, { hour: 21, count: 4 }, { hour: 22, count: 2 }, { hour: 23, count: 1 },
    ],
    daily: [
      { date: "2026-03-19", inbound: 8, outbound: 6 }, { date: "2026-03-20", inbound: 12, outbound: 9 },
      { date: "2026-03-21", inbound: 10, outbound: 8 }, { date: "2026-03-22", inbound: 15, outbound: 12 },
      { date: "2026-03-23", inbound: 11, outbound: 10 }, { date: "2026-03-24", inbound: 9, outbound: 7 },
      { date: "2026-03-25", inbound: 14, outbound: 11 },
    ],
    keywords: [
      { word: "siparis", count: 45 }, { word: "fiyat", count: 38 }, { word: "numune", count: 32 },
      { word: "kargo", count: 28 }, { word: "model", count: 25 }, { word: "katalog", count: 22 },
      { word: "beden", count: 18 }, { word: "renk", count: 16 }, { word: "stok", count: 14 },
      { word: "odeme", count: 12 }, { word: "teslimat", count: 11 }, { word: "koleksiyon", count: 10 },
    ],
  },
};

// ============ BOT CONFIG ============
export const DEMO_BOT_CONFIG = {
  is_enabled: true,
  brand_name: "Messe Tekstil",
  brand_description: "Turkiye merkezli toptan tekstil uretici ve ihracatci. Kadin giyim (elbise, gomlek, dis giyim) uzerine uzmanlasmis. VIPTEX, BTK, TS gibi uluslararasi fuarlara katilim. BDT ulkeleri agirlikli ihracat.",
  tone: "professional",
  products_services: "Kadin elbise, bluz, gomlek, dis giyim (kaban, mont, trenc). Toptan satis, minimum siparis 50 adet. Numune gonderimleri ucretsiz. Ozel uretim (private label) mumkun.",
  faq: "S: Minimum siparis miktari nedir? C: 50 adet/model.\nS: Numune ucreti var mi? C: Ilk 3 numune ucretsiz.\nS: Kargo suresi ne kadar? C: Rusya 5-7 gun, diger BDT ulkeleri 7-10 gun.\nS: Odeme yontemleri nelerdir? C: Banka havalesi (TL/USD/EUR), %50 pesinat + %50 kargo oncesi.",
  policies: "Iade: Uretim hatasi disinda iade kabul edilmez. Numune farklilik orani %5. Kargo hasari icin sigorta onerilir. Odeme 30 gun vadeli (duzenli musteriler icin).",
  custom_instructions: "Rusca mesajlari anlayip Turkce/Ingilizce cevap ver. Musteri segmentine gore davran: VIP musterilere oncelik ver, yeni musterilere numune onerisinde bulun.",
  greeting_message: "Merhaba! Messe Tekstil'e hosgeldiniz. Size nasil yardimci olabilirim?",
  fallback_message: "Tesekkurler, mesajinizi aldim. En kisa surede bir temsilcimiz size donecektir.",
  token_balance: 85000,
  tokens_used: 15420,
  total_responses: 234,
};

export const DEMO_BOT_RULES = [
  { id: 601, org_id: 10, name: "Karsilama", keywords: ["merhaba", "selam", "hello", "hi", "zdravstvuyte"], match_type: "contains", response_template: "Merhaba! Messe Tekstil'e hosgeldiniz. Size nasil yardimci olabilirim?", is_active: true, priority: 1, channel_types: [] },
  { id: 602, org_id: 10, name: "Fiyat Bilgisi", keywords: ["fiyat", "price", "cena", "ucret"], match_type: "contains", response_template: "Fiyat listemizi en kisa surede gonderecegiz. Hangi kategoriler ilginizi cekiyor?", is_active: true, priority: 2, channel_types: [] },
  { id: 603, org_id: 10, name: "Siparis Durumu", keywords: ["siparis", "order", "zakaz", "kargo", "teslimat"], match_type: "contains", response_template: "Siparis durumunuzu kontrol ediyorum. Lutfen siparis numaranizi paylasir misiniz?", is_active: true, priority: 3, channel_types: [] },
  { id: 604, org_id: 10, name: "Katalog Talebi", keywords: ["katalog", "catalog", "katalogue"], match_type: "contains", response_template: "Yeni sezon katalogumuzu hemen gonderiyorum! PDF mi online link mi tercih edersiniz?", is_active: true, priority: 4, channel_types: [] },
  { id: 605, org_id: 10, name: "Numune Talebi", keywords: ["numune", "sample", "obrazets"], match_type: "contains", response_template: "Numune talebinizi aldik! Ilk 3 numune ucretsizdir. Adres bilginizi paylasir misiniz?", is_active: true, priority: 5, channel_types: [] },
];

export const DEMO_AI_LOGS = [
  { customer_message: "Siparis numaram 8609, ne durumda?", ai_response: "Siparis #8609 bilgilerini kontrol ediyorum. Siparisiz kargoya verilmis, takip numarasi TR2026031587642. Tahmini teslimat 5-7 is gunu icerisinde.", tokens_used: 185, created_at: "2026-03-25T14:00:00Z" },
  { customer_message: "Yeni sezon katalogunuz var mi?", ai_response: "Evet! 2026 Yaz koleksiyonumuz hazir. 48 sayfalik katalogumuzda elbise, bluz ve dis giyim kategorileri mevcut. PDF olarak gondereyim mi?", tokens_used: 142, created_at: "2026-03-25T12:30:00Z" },
  { customer_message: "Minimum siparis kac adet?", ai_response: "Messe Tekstil'de minimum siparis miktari model basina 50 adettir. Numune icin ise ilk 3 numune ucretsizdir. Detayli bilgi icin fiyat listemizi gonderebilirim.", tokens_used: 128, created_at: "2026-03-25T10:15:00Z" },
  { customer_message: "Rusya'ya kargo ne kadar suruyor?", ai_response: "Rusya'ya kargo suresi genellikle 5-7 is gunudur. Kargo ucreti siparis hacmine gore degisir. Buyuk siparislerde ucretsiz kargo imkani sunuyoruz.", tokens_used: 118, created_at: "2026-03-24T16:45:00Z" },
  { customer_message: "Odeme nasil yapilir?", ai_response: "Odeme yontemlerimiz: Banka havalesi (TL, USD, EUR). Standart kosullar %50 pesinat + %50 kargo oncesidir. Duzenli musterilerimize 30 gun vade imkani sunuyoruz.", tokens_used: 135, created_at: "2026-03-24T11:20:00Z" },
  { customer_message: "Siyah saten kac metre var stokta?", ai_response: "[Stok Sorgusu: KM-301 Premium Saten - Siyah] Stokta 2.400 metre Premium Saten (Siyah) bulunmaktadir. Birim fiyat: 85 TL/m. 1000m ustu siparislerde %10 iskonto uygulanir. Siparis olusturmami ister misiniz?", tokens_used: 165, created_at: "2026-03-26T09:30:00Z" },
  { customer_message: "Krep kumasinin renk secenekleri neler?", ai_response: "[Urun Bilgisi: KM-305 Krep Kumas] Krep kumasimiz 4 renk seceneginde mevcuttur: Siyah (1200m stok), Bej (800m), Gri (650m), Pudra (450m). Toplam stok: 3.100m. Numune gonderimi icin adresinizi paylasir misiniz?", tokens_used: 172, created_at: "2026-03-26T11:15:00Z" },
  { customer_message: "Anna Morozova icin SIP-2026-043 siparisi ne durumda?", ai_response: "[Siparis Takibi: SIP-2026-043] Siparis durumu: Onaylandi. Detaylar: Saten 2000m + Krep 1500m + Astar 1000m = $48,000. Uretime alinma tarihi: 28 Mart. Tahmini sevkiyat: 2 Nisan. Kargo bilgisi olusturuldugunda otomatik bildirim gonderilecektir.", tokens_used: 198, created_at: "2026-03-27T08:45:00Z" },
  { customer_message: "Numune gondermek istiyorum, nasil yapacagim?", ai_response: "[Numune Talebi] Numune talep sureci: 1) Istediginiz kumas turunu ve renkleri belirtin, 2) Kargo adresinizi paylatin, 3) Ilk 3 numune ucretsiz, sonrakiler $25/adet. Hazırlama suresi 1-2 is gunu. Hangi kumaslarin numunelerini gormek istersiniz? Saten, Krep, Viskon en cok tercih edilenlerimiz.", tokens_used: 188, created_at: "2026-03-26T14:00:00Z" },
];

// ============ AUTOMATIONS ============
export const DEMO_AUTOMATIONS = [
  {
    id: 701, org_id: 10, name: "VIP Musteri Oncelik", is_active: true,
    trigger_type: "new_conversation",
    conditions: [{ field: "message_content", operator: "contains", value: "siparis" }],
    actions: [{ type: "set_priority", value: "high" }, { type: "assign_agent", value: "102" }],
    execution_count: 18, last_executed_at: "2026-03-25T14:30:00Z",
  },
  {
    id: 702, org_id: 10, name: "Instagram Otomatik Karsilama", is_active: true,
    trigger_type: "new_conversation",
    conditions: [{ field: "channel_type", operator: "equals", value: "instagram" }],
    actions: [{ type: "send_message", value: "Merhaba! Messe Tekstil Instagram hesabimiza hosgeldiniz. En kisa surede size donecegiz." }, { type: "assign_agent", value: "104" }],
    execution_count: 12, last_executed_at: "2026-03-25T10:15:00Z",
  },
  {
    id: 703, org_id: 10, name: "Email Siparis Etiketleme", is_active: true,
    trigger_type: "message_received",
    conditions: [{ field: "channel_type", operator: "equals", value: "email" }, { field: "message_content", operator: "contains", value: "siparis" }],
    actions: [{ type: "add_tag", value: "2" }, { type: "set_priority", value: "high" }],
    execution_count: 8, last_executed_at: "2026-03-23T17:00:00Z",
  },
  {
    id: 704, org_id: 10, name: "Atanmamis Konusma Uyarisi", is_active: true,
    trigger_type: "new_conversation",
    conditions: [],
    actions: [{ type: "assign_agent", value: "102" }],
    execution_count: 35, last_executed_at: "2026-03-25T08:00:00Z",
  },
  {
    id: 705, org_id: 10, name: "Acil Siparis Bildirimi", is_active: false,
    trigger_type: "message_received",
    conditions: [{ field: "message_content", operator: "contains", value: "acil" }],
    actions: [{ type: "set_priority", value: "urgent" }, { type: "assign_agent", value: "102" }],
    execution_count: 3, last_executed_at: "2026-03-22T09:00:00Z",
  },
];

// ============ KNOWLEDGE BASE ============
export const DEMO_KB_CATEGORIES = [
  { id: 801, org_id: 10, name: "Urunler", article_count: 4 },
  { id: 802, org_id: 10, name: "Siparis ve Odeme", article_count: 3 },
  { id: 803, org_id: 10, name: "Kargo ve Teslimat", article_count: 3 },
  { id: 804, org_id: 10, name: "Numune ve Katalog", article_count: 2 },
  { id: 805, org_id: 10, name: "Satis Politikalari", article_count: 2 },
];

export const DEMO_KB_ARTICLES = [
  { id: 901, org_id: 10, category_id: 801, category_name: "Urunler", title: "2026 Yaz Koleksiyonu", content: "Yeni sezon koleksiyonumuzda 48 model bulunmaktadir. Elbise, bluz, gomlek ve dis giyim kategorilerinde genis yelpaze. Tum modeller S-XL beden araligi.", status: "published", view_count: 145, created_at: "2026-02-01T10:00:00Z", updated_at: "2026-03-15T14:00:00Z" },
  { id: 902, org_id: 10, category_id: 801, category_name: "Urunler", title: "Beden Tablosu ve Olculer", content: "S: 36 EU / M: 38 EU / L: 40 EU / XL: 42 EU. Detayli olcu tablosu katalogda mevcuttur. Ozel beden uretimi 100+ adet siparislerde mumkundur.", status: "published", view_count: 98, created_at: "2026-02-05T10:00:00Z", updated_at: "2026-03-10T10:00:00Z" },
  { id: 903, org_id: 10, category_id: 801, category_name: "Urunler", title: "Kumas ve Malzeme Bilgileri", content: "Polyester, viskon, pamuk karisim kumaslar kullanilmaktadir. Tum kumaslar Oeko-Tex sertifikali. Yikama talimatlari her urunde etiket olarak bulunur.", status: "published", view_count: 67, created_at: "2026-02-10T10:00:00Z", updated_at: "2026-03-05T10:00:00Z" },
  { id: 904, org_id: 10, category_id: 801, category_name: "Urunler", title: "Ozel Uretim (Private Label)", content: "Minimum 200 adet siparisler icin ozel etiket uretimi yapilmaktadir. Logo, etiket ve ambalaj ozellestirme mumkun. Uretim suresi 15-20 is gunu.", status: "published", view_count: 52, created_at: "2026-02-15T10:00:00Z", updated_at: "2026-03-01T10:00:00Z" },
  { id: 905, org_id: 10, category_id: 802, category_name: "Siparis ve Odeme", title: "Siparis Sureci", content: "1. Model secimi ve miktar belirleme\n2. Proforma fatura onaylama\n3. %50 pesinat odeme\n4. Uretim/hazirlama (2-5 is gunu)\n5. Kalan %50 odeme\n6. Kargoya teslim", status: "published", view_count: 134, created_at: "2026-02-01T10:00:00Z", updated_at: "2026-03-20T10:00:00Z" },
  { id: 906, org_id: 10, category_id: 802, category_name: "Siparis ve Odeme", title: "Odeme Yontemleri", content: "Banka havalesi: TL, USD, EUR kabul edilir. Duzenli musteriler icin 30 gun vade. Western Union ve MoneyGram da kabul edilir.", status: "published", view_count: 89, created_at: "2026-02-05T10:00:00Z", updated_at: "2026-03-15T10:00:00Z" },
  { id: 907, org_id: 10, category_id: 802, category_name: "Siparis ve Odeme", title: "Minimum Siparis Miktarlari", content: "Standart siparis: 50 adet/model (karisik beden). Ozel uretim: 200 adet/model. Numune siparisi: 1-3 adet (ilk 3 ucretsiz).", status: "published", view_count: 112, created_at: "2026-02-10T10:00:00Z", updated_at: "2026-03-10T10:00:00Z" },
  { id: 908, org_id: 10, category_id: 803, category_name: "Kargo ve Teslimat", title: "Uluslararasi Kargo Bilgileri", content: "Rusya: 5-7 is gunu (DHL/TNT). Kazakistan/Kirgizistan: 7-10 is gunu. Gurcistan/Ukrayna: 5-8 is gunu. 500+ adet siparislerde ucretsiz kargo.", status: "published", view_count: 156, created_at: "2026-02-01T10:00:00Z", updated_at: "2026-03-22T10:00:00Z" },
  { id: 909, org_id: 10, category_id: 803, category_name: "Kargo ve Teslimat", title: "Kargo Takip ve Sigorta", content: "Tum kargolar takip numarasi ile gonderilinir. Kargo sigortasi opsiyoneldir (siparis tutarinin %2'si). Hasar durumunda 48 saat icerisinde bildirim gereklidir.", status: "published", view_count: 78, created_at: "2026-02-05T10:00:00Z", updated_at: "2026-03-18T10:00:00Z" },
  { id: 910, org_id: 10, category_id: 803, category_name: "Kargo ve Teslimat", title: "Yurt Ici Teslimat", content: "Istanbul ici: 1 is gunu. Diger sehirler: 2-3 is gunu (Yurtici Kargo/Aras). Ucretsiz teslimat limiti: 1000 TL ustu.", status: "published", view_count: 45, created_at: "2026-02-10T10:00:00Z", updated_at: "2026-03-12T10:00:00Z" },
  { id: 911, org_id: 10, category_id: 804, category_name: "Numune ve Katalog", title: "Numune Talep Sureci", content: "1. Numune formu doldurma\n2. Model ve beden secimi\n3. Kargo adresi bildirimi\n4. Numune hazirlama (1-2 is gunu)\n5. Kargo ile gonderim\n\nIlk 3 numune ucretsiz, sonraki numuneler maliyet bedelidir.", status: "published", view_count: 93, created_at: "2026-02-01T10:00:00Z", updated_at: "2026-03-20T10:00:00Z" },
  { id: 912, org_id: 10, category_id: 804, category_name: "Numune ve Katalog", title: "Dijital Katalog", content: "2026 Yaz katalogu PDF formatinda mevcuttur (48 sayfa). Online katalog linki: messetekstil.com/katalog. Katalog her sezon guncellenir.", status: "published", view_count: 167, created_at: "2026-02-05T10:00:00Z", updated_at: "2026-03-25T10:00:00Z" },
  { id: 913, org_id: 10, category_id: 805, category_name: "Satis Politikalari", title: "Iade ve Degisim Politikasi", content: "Uretim hatasi kaynakli iadeler kabul edilir. Renk/model tercihi kaynaklı iadeler kabul edilmez. Iade suresi: Teslimattan itibaren 7 gun. Degisim: Stok durumuna gore mumkun.", status: "published", view_count: 71, created_at: "2026-02-01T10:00:00Z", updated_at: "2026-03-15T10:00:00Z" },
  { id: 914, org_id: 10, category_id: 805, category_name: "Satis Politikalari", title: "Toptan Iskonto Politikasi", content: "50-100 adet: Liste fiyati. 100-500 adet: %10 iskonto. 500+ adet: %15 iskonto + ucretsiz kargo. Duzenli musterilere ek %5 sadakat iskontosu.", status: "published", view_count: 88, created_at: "2026-02-05T10:00:00Z", updated_at: "2026-03-18T10:00:00Z" },
];

// ============ SETTINGS ============
export const DEMO_BUSINESS_HOURS = {
  timezone: "Europe/Istanbul",
  schedule: [
    { day: "monday", enabled: true, start: "09:00", end: "18:00" },
    { day: "tuesday", enabled: true, start: "09:00", end: "18:00" },
    { day: "wednesday", enabled: true, start: "09:00", end: "18:00" },
    { day: "thursday", enabled: true, start: "09:00", end: "18:00" },
    { day: "friday", enabled: true, start: "09:00", end: "18:00" },
    { day: "saturday", enabled: true, start: "10:00", end: "15:00" },
    { day: "sunday", enabled: false, start: "09:00", end: "18:00" },
  ],
  away_message: "Mesai saatleri disindayiz. En kisa surede size donecegiz. Mesai saatlerimiz: Pzt-Cum 09:00-18:00, Cmt 10:00-15:00",
  welcome_message: "Messe Tekstil'e hosgeldiniz! Size nasil yardimci olabiliriz?",
};

export const DEMO_SLA_POLICY = {
  first_response: { urgent: 15, high: 30, normal: 60, low: 120 },
  resolution: { urgent: 120, high: 240, normal: 480, low: 1440 },
  business_hours_only: true,
};

export const DEMO_CSAT_CONFIG = {
  is_enabled: true,
  question: "Messe Tekstil hizmetimizi nasil degerlendirirsiniz?",
  thank_you_message: "Degerli geri bildiriminiz icin tesekkur ederiz!",
  send_delay_minutes: 30,
};

export const DEMO_CSAT_RESPONSES = {
  stats: {
    avg_rating: 4.3,
    total_count: 38,
    satisfaction_rate: 92,
    rating_distribution: [1, 2, 4, 11, 20],
  },
  responses: [
    { id: 1, conversation_id: 407, rating: 5, comment: "Cok hizli ve profesyonel hizmet, tesekkurler!", contact_name: "Kristina Boutique", created_at: "2026-03-24T18:30:00Z" },
    { id: 2, conversation_id: 405, rating: 5, comment: "Siparis takibi mukemmel calisiyor", contact_name: "Irina Kurganova", created_at: "2026-03-23T17:30:00Z" },
    { id: 3, conversation_id: 410, rating: 4, comment: "Numuneler guzeldi, fiyatlar makul", contact_name: "Olesya Petrova", created_at: "2026-03-22T16:30:00Z" },
    { id: 4, conversation_id: 401, rating: 5, comment: "Her zaman guvenilir bir partner", contact_name: "Anna Morozova", created_at: "2026-03-22T12:00:00Z" },
    { id: 5, conversation_id: 402, rating: 4, comment: "Katalog cok detayli, tesekkurler", contact_name: "Oleg Petrov", created_at: "2026-03-22T15:30:00Z" },
    { id: 6, conversation_id: 403, rating: 3, comment: "Fiyat listesi biraz gec geldi", contact_name: "Svetlana Sivaeva", created_at: "2026-03-21T10:00:00Z" },
  ],
};

// ============ TAGS ============
export const DEMO_TAGS = [
  { id: 1, org_id: 10, name: "VIP", color: "#10b981" },
  { id: 2, org_id: 10, name: "Siparis", color: "#3b82f6" },
  { id: 3, org_id: 10, name: "Fiyat Talebi", color: "#f59e0b" },
  { id: 4, org_id: 10, name: "Numune", color: "#8b5cf6" },
  { id: 5, org_id: 10, name: "Fuar", color: "#ec4899" },
  { id: 6, org_id: 10, name: "Takip", color: "#6366f1" },
];

// ============ CANNED RESPONSES ============
export const DEMO_CANNED_RESPONSES = [
  { id: 1, shortcut: "merhaba", content: "Merhaba! Messe Tekstil'e hosgeldiniz. Size nasil yardimci olabilirim?" },
  { id: 2, shortcut: "fiyat", content: "Fiyat listemizi hazirliyorum, hangi kategoriler ilginizi cekiyor? (Elbise, Bluz, Gomlek, Dis Giyim)" },
  { id: 3, shortcut: "numune", content: "Numune talebinizi aldik! Ilk 3 numune ucretsiz. Adres bilginizi ve istediginiz modelleri paylasir misiniz?" },
  { id: 4, shortcut: "kargo", content: "Kargo bilgileri: Rusya 5-7 gun, Kazakistan/Kirgizistan 7-10 gun. 500+ adet siparislerde ucretsiz kargo." },
  { id: 5, shortcut: "siparis", content: "Siparis durumunuzu kontrol ediyorum. Lutfen siparis numaranizi paylasir misiniz?" },
  { id: 6, shortcut: "tesekkur", content: "Ilginiz icin tesekkur ederiz! Baska bir sorunuz olursa her zaman yazabilirsiniz." },
];
