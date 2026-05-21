-- ============================================================
-- MIGRACIÓN: costo_estimado + enviar_a_cocina en menu_items
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Agrega costo estimado por unidad (alternativa simple al inventario)
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS costo_estimado DECIMAL(10,2) DEFAULT NULL;

-- Agrega flag para controlar si el item va al KDS de cocina
-- FALSE = bebidas, snacks, postres fríos → no genera ticket de cocina
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS enviar_a_cocina BOOLEAN NOT NULL DEFAULT TRUE;

-- Comentarios para documentar
COMMENT ON COLUMN menu_items.costo_estimado IS
  'Costo estimado por unidad vendida. Alternativa simple a recetas+inventario para calcular márgenes.';

COMMENT ON COLUMN menu_items.enviar_a_cocina IS
  'Si FALSE, el item se marca como entregado directamente sin pasar por el KDS (bebidas, snacks, postres fríos).';
