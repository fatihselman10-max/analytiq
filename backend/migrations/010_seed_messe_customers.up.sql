-- Seed existing 15 demo customers for Messe Tekstil (org_id from messe org)
-- Using a DO block to get the org_id dynamically
DO $$
DECLARE
    v_org_id BIGINT;
BEGIN
    SELECT id INTO v_org_id FROM organizations WHERE slug = 'messe-tekstil' OR name ILIKE '%messe%' LIMIT 1;
    IF v_org_id IS NULL THEN
        RAISE NOTICE 'Messe org not found, skipping seed';
        RETURN;
    END IF;

    INSERT INTO customers (org_id, name, company, country, segment, source, source_detail, phone, email, instagram, notes, orders, last_contact_at)
    VALUES
        (v_org_id, 'Anna Morozova', 'VIPTEX', 'Rusya', 1, 'Fuar', 'BTK 2025', '+7 905 106 53 53', 'anna@viptex.ru', '@viptex_official', 'Yeni sezon numuneleri gonderildi, 3 model begendi, siparis bekleniyor', '8609, 8733', '2026-03-22'),
        (v_org_id, 'Oleg Petrov', 'Elena Chezelle', 'Rusya', 1, 'Fuar', 'VIPTEX 2025', '+7 921 963 88 82', 'oleg@chezelle.ru', '@elenachezelle', 'Duzenli musteri, her sezon siparis veriyor. Yeni koleksiyon katalogu istedi', '8601, 7058, 7768', '2026-03-20'),
        (v_org_id, 'Svetlana Sivaeva', 'Terra', 'Rusya', 2, 'Fuar', 'VIPTEX 2025', '+7 916 106 03 20', 'svetlana.terramd@mail.ru', '@terra_fashion', 'Fiyat listesi gonderildi, ilgileniyor ama henuz siparis vermedi', '-', '2026-03-18'),
        (v_org_id, 'Nadezdha Akulshina', 'Tom Klaim', 'Rusya', 2, 'Fuar', 'VIPTEX 2025', '+7 910 467 61 66', 'klaim_work@mail.ru', '@tom_klaim', 'WhatsApp ile iletisim kuruyoruz, numune talep etti ama karar vermedi', '-', '2026-03-15'),
        (v_org_id, 'Ludmila Tetsko', 'Baihome', 'Kirgizistan', 2, 'Fuar', 'VIPTEX 2025', '+7 905 630 08 71', '', '@bai_home.kg', 'Instagram uzerinden takip ediyor, Rusca tanitim filmi gonderildi', '-', '2026-03-12'),
        (v_org_id, 'Alexandr', 'Edit Production', 'Rusya', 3, 'Fuar', 'VIPTEX 2025', '+7 977 420 48 73', '', '@production.edit', 'Buyuk firma, surekli pazarlama mesaji atiliyor ama cevap gelmiyor', '-', '2026-03-10'),
        (v_org_id, 'Irina Kurganova', 'Kurganova Fashion', 'Rusya', 3, 'Fuar', 'VIPTEX 2025', '+7 903 779 29 65', 'k.irina80@gmail.ru', '', 'Ozel gun mesajlari gonderiliyor, henuz geri donus yok', '-', '2026-03-08'),
        (v_org_id, 'Daria', 'Levchenko', 'Rusya', 4, 'Fuar', 'VIPTEX 2025', '+7 996 027 80 32', '', '', 'Surekli pazarlama yapiliyor, cevap gelmiyor', '-', '2026-03-05'),
        (v_org_id, 'Elza', 'Elza Fashion', 'Rusya', 4, 'Fuar', 'TS 2025', '+7 985 893 98 06', '', '', 'Rusca tanitim filmi gonderildi, okundu ama cevap gelmedi', '-', '2026-03-01'),
        (v_org_id, 'Viktor', 'Viktor Trade', 'Rusya', 4, 'Fuar', 'TS 2025', '+7 961 506 95 19', '', '', 'Iletisim kurulamiyor', '-', '2026-02-28'),
        (v_org_id, 'Olesya', 'Nextex', 'Rusya', 2, 'Fuar', 'TS 2025', '+7 962 830 86 50', 'ceo@nex-tex.ru', '@_olesia_petrova_', 'Numune gonderildi, degerlendirme asamasinda', '-', '2026-03-19'),
        (v_org_id, 'Galina', 'Galina Sochi', 'Rusya', 4, 'Fuar', 'TS 2025', '+7 918 405 31 34', '', '', 'Arandi, mesguldu, tekrar aranacak', '-', '2026-03-22'),
        (v_org_id, 'Kristina', 'Kristina Boutique', 'Rusya', 1, 'Fuar', 'TS 2025', '+7 937 653 00 86', '', '@kristina_boutique', 'Yeni siparis verdi, 5 parca. Odeme bekleniyor', '8653, 8525', '2026-03-24'),
        (v_org_id, 'Tatiana', 'Perni Fashion', 'Rusya', 2, 'Fuar', 'TS 2025', '+7 919 460 74 61', '', '', 'Ilgileniyor ama butce sikintisi var, gelecek sezon icin not dusuldu', '-', '2026-03-17'),
        (v_org_id, 'Alisa Serginetti', 'VIPTEX', 'Rusya', 4, 'Fuar', 'VIPTEX 2025', '+7 967 375 59 95', '', '', 'Toplu mesajlar atiliyor, cevap gelmiyor', '-', '2026-02-25');

    -- Add channels for seeded customers
    INSERT INTO customer_channels (customer_id, channel_type, channel_identifier)
    SELECT c.id, 'WhatsApp', c.phone FROM customers c WHERE c.org_id = v_org_id AND c.phone != '';

    INSERT INTO customer_channels (customer_id, channel_type, channel_identifier)
    SELECT c.id, 'Instagram', c.instagram FROM customers c WHERE c.org_id = v_org_id AND c.instagram != '';

    INSERT INTO customer_channels (customer_id, channel_type, channel_identifier)
    SELECT c.id, 'Email', c.email FROM customers c WHERE c.org_id = v_org_id AND c.email != '';

END $$;
