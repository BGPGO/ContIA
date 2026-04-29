-- ── 025: Adicionar tipo 'agency' ao CHECK constraint de reports.type ─────────
-- Migration ADITIVA — expande o enum de tipos de relatório para incluir agência.

ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_type_check;

ALTER TABLE reports
  ADD CONSTRAINT reports_type_check
  CHECK (type IN ('weekly', 'monthly', 'quarterly', 'custom', 'agency'));
