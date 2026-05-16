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

    // Configuración fiscal
    tasa_itbis?: number | null;        // Ej: 0.18 = 18%. NULL o 0 = sin impuesto

    // Notas internas del desarrollador (no visibles para el cliente)
    notas_internas?: string | null;

    // Agente de impresión local (LAN)
    print_agent_url?: string | null;

    created_at?: string;
    updated_at?: string;
}
