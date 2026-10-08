-- 025: Burcu 2026-10 istekleri — müşteriye firma ölçeği (buyuk / orta / kucuk, boş = seçilmemiş)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS firm_size TEXT NOT NULL DEFAULT '';
