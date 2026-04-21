
-- Ver estructura de la tabla negocios
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'negocios';

-- Ver si RLS está activo
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'negocios';

-- Ver el registro específico
SELECT id, nombre, tipo_negocio FROM negocios WHERE id::text = '6b0df693-1c18-412d-bce1-f719d922f92d';

-- Ver procesos lentos
SELECT pid, now() - query_start AS duration, query, state
FROM pg_stat_activity
WHERE state != 'idle' AND now() - query_start > interval '5 seconds';
