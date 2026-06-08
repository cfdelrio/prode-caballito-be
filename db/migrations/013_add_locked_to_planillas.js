// Migration: add locked column to planillas, separate from precio_pagado.
// precio_pagado = admin-managed payment status (never blocks bet edits)
// locked        = user-triggered freeze (blocks bet edits)
//
// Existing planillas with precio_pagado=true are migrated to locked=true
// because they were locked via PUT /:id/lock (which previously set precio_pagado).

exports.up = async (db) => {
  await db.query(`
    ALTER TABLE planillas
    ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false
  `);
  // Preserve existing locked state: anything that was precio_pagado was locked by user
  await db.query(`
    UPDATE planillas SET locked = true WHERE precio_pagado = true
  `);
};

exports.down = async (db) => {
  await db.query(`ALTER TABLE planillas DROP COLUMN IF EXISTS locked`);
};
