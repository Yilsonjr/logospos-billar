import { ModuloSistema, TipoNegocio } from "../services/negocios.service";

export interface Negocio {
    id: string; // UUID
    nombre: string;
    subdominio: string;
    rnc: string | null;
    plan_tipo: 'basico' | 'profesional' | 'pro' | 'perpetual';
    estado_licencia: 'activa' | 'suspendida' | 'vencida';
    fecha_vencimiento: string | null;
    tipo_negocio: TipoNegocio;
    modulos_activos: ModuloSistema[];
    
    // Campos de identidad adicionales
    telefono?: string;
    direccion?: string;
    lema?: string;
    logo_url?: string;
    email?: string;
    web?: string;
    
    created_at?: string;
    updated_at?: string;
}
