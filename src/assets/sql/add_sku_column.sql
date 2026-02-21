ALTER TABLE public.productos 
ADD COLUMN IF NOT EXISTS sku character varying(50) NULL;

CREATE INDEX IF NOT EXISTS idx_productos_sku ON public.productos (sku);
