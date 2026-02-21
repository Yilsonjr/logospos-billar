-- 1. Tabla de Configuración Fiscal
CREATE TABLE IF NOT EXISTS configuracion_fiscal (
    id SERIAL PRIMARY KEY,
    modo_fiscal BOOLEAN DEFAULT FALSE,
    rnc_empresa TEXT,
    nombre_empresa TEXT,
    itbis_defecto NUMERIC DEFAULT 18.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar configuración inicial por defecto (Modo Informal)
INSERT INTO configuracion_fiscal (id, modo_fiscal, nombre_empresa)
VALUES (1, FALSE, 'Mi Negocio')
ON CONFLICT (id) DO NOTHING;

-- 2. Tabla de Secuencias NCF
CREATE TABLE IF NOT EXISTS secuencias_ncf (
    id SERIAL PRIMARY KEY,
    tipo_ncf TEXT NOT NULL, -- Ej: 'B01', 'B02'
    descripcion TEXT,
    prefijo TEXT NOT NULL, -- Ej: 'B01'
    rango_inicial BIGINT NOT NULL,
    rango_final BIGINT NOT NULL,
    numero_actual BIGINT NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    ultima_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Modificar Tabla de Productos (Exención de Impuestos)
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS exento_itbis BOOLEAN DEFAULT FALSE;

-- 4. Modificar Tabla de Ventas (Datos Fiscales)
ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS ncf TEXT,
ADD COLUMN IF NOT EXISTS tipo_ncf TEXT,
ADD COLUMN IF NOT EXISTS rnc_cliente TEXT,
ADD COLUMN IF NOT EXISTS nombre_cliente_fiscal TEXT;

-- 5. Función Atómica para Obtener NCF
CREATE OR REPLACE FUNCTION obtener_siguiente_ncf(tipo_solicitado TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    secuencia RECORD;
    nuevo_numero BIGINT;
    ncf_generado TEXT;
    modo_activo BOOLEAN;
BEGIN
    -- 0. Verificar si el modo fiscal está activo
    SELECT modo_fiscal INTO modo_activo FROM configuracion_fiscal LIMIT 1;
    
    IF modo_activo IS NOT TRUE THEN
        RETURN NULL; -- Retorna NULL si no está activo el modo fiscal
    END IF;

    -- 1. Bloquear y seleccionar la fila de la secuencia para evitar condiciones de carrera
    SELECT * INTO secuencia
    FROM secuencias_ncf
    WHERE tipo_ncf = tipo_solicitado AND activo = TRUE
    FOR UPDATE;

    -- 2. Validaciones
    IF secuencia IS NULL THEN
        RAISE EXCEPTION 'No existe una secuencia activa para el tipo %', tipo_solicitado;
    END IF;

    IF secuencia.fecha_vencimiento < CURRENT_DATE THEN
        RAISE EXCEPTION 'La secuencia para % ha vencido', tipo_solicitado;
    END IF;

    IF secuencia.numero_actual >= secuencia.rango_final THEN
        RAISE EXCEPTION 'Se han agotado los números para la secuencia %', tipo_solicitado;
    END IF;

    -- 3. Incrementar
    nuevo_numero := secuencia.numero_actual + 1;

    -- 4. Actualizar DB
    UPDATE secuencias_ncf
    SET numero_actual = nuevo_numero,
        ultima_actualizacion = NOW()
    WHERE id = secuencia.id;

    -- 5. Formatear NCF (Prefijo + 8 dígitos rellenados con ceros)
    -- Ej: B01 + 00000005
    ncf_generado := secuencia.prefijo || LPAD(nuevo_numero::TEXT, 8, '0');

    RETURN ncf_generado;
END;
$$;
