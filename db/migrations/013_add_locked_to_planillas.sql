-- Separate "locked" (user closed planilla) from "precio_pagado" (admin confirmed payment).
-- precio_pagado = admin-managed payment status (never blocks bet edits)
-- locked        = user-triggered freeze (blocks bet edits)
-- These are independent: a paid planilla is NOT automatically locked, so we do NOT
-- backfill locked from precio_pagado.
ALTER TABLE planillas ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT false;
