-- Migration to update proveedores table schema
-- 1. Rename columns to match the new model
ALTER TABLE public.proveedores RENAME COLUMN rnc TO documento;
ALTER TABLE public.proveedores RENAME COLUMN contacto_nombre TO contacto;

-- 2. Add missing columns
ALTER TABLE public.proveedores ADD COLUMN tipo_documento text DEFAULT 'RNC';
ALTER TABLE public.proveedores ADD COLUMN ciudad text;
ALTER TABLE public.proveedores ADD COLUMN pais text DEFAULT 'República Dominicana';

-- 3. Ensure updated_at is handled (if trigger is missing, it should be added, but for now we just ensure column exists)
-- The user SQL already had updated_at, so no need to add it again.
