-- Segment semantic change (2026-04-21)
-- Yeni model:
--   4 = Ulaşılamayan (default)
--   3 = Stratejik (önemli ama iletişim kurulamayan büyük firma — MANUEL atanır)
--   2 = Aktif (kartela veya numune gönderilmiş)
--   1 = VIP (sipariş/kargolanmış)
-- Katalog gönderimi artık segment değiştirmez (herkese gönderiliyor).
--
-- Eski "catalog_sent → segment 3" kuralıyla otomatik 3'e çekilmiş müşterileri 4'e geri al.
-- Excel'den gelen segment 3'lüler pipeline_stage='new_contact' ile girildiği için etkilenmez.

-- Audit trail
INSERT INTO segment_history (org_id, customer_id, old_segment, new_segment, changed_by, changed_at)
SELECT org_id, id, 3, 4, NULL, NOW()
FROM customers
WHERE segment = 3 AND pipeline_stage = 'catalog_sent';

-- Update
UPDATE customers
SET segment = 4, updated_at = NOW()
WHERE segment = 3 AND pipeline_stage = 'catalog_sent';
