-- Migración para corregir tabla pedidos_mesa_detalle
-- Agrega columnas faltantes detectadas en el POS

-- 1. Agregar columna 'notas' si no existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='pedidos_mesa_detalle' AND column_name='notas') THEN
        ALTER TABLE pedidos_mesa_detalle ADD COLUMN notas TEXT;
    END IF;
END $$;

-- 2. Asegurar que 'subtotal' existe (es crítico para totales)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='pedidos_mesa_detalle' AND column_name='subtotal') THEN
        ALTER TABLE pedidos_mesa_detalle ADD COLUMN subtotal NUMERIC(12,2) DEFAULT 0;
    END IF;
END $$;

-- 3. Asegurar que 'estado_preparacion' existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='pedidos_mesa_detalle' AND column_name='estado_preparacion') THEN
        ALTER TABLE pedidos_mesa_detalle ADD COLUMN estado_preparacion TEXT DEFAULT 'solicitado' 
        CHECK (estado_preparacion IN ('solicitado', 'en_cocina', 'listo', 'entregado'));
    END IF;
END $$;

COMMENT ON COLUMN pedidos_mesa_detalle.notas IS 'Notas especiales de preparación (ej: Sin cebolla)';
