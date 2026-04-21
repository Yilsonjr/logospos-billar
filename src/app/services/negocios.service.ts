import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { BehaviorSubject, Observable } from 'rxjs';

// =============================================
// Tipos de negocio soportados por la plataforma
// =============================================
export type TipoNegocio = 'general' | 'restaurante' | 'bar' | 'billar' | 'cafeteria' | 'tienda' | 'food_truck';

// =============================================
// Módulos del sistema
// =============================================
export type ModuloSistema =
    | 'ventas'
    | 'inventario'
    | 'caja'
    | 'clientes'
    | 'mesas'
    | 'cocina'
    | 'cuentas_cobrar'
    | 'cuentas_pagar'
    | 'compras'
    | 'proveedores'
    | 'fiscal'
    | 'reportes'
    | 'usuarios';

// =============================================
// Módulos por defecto según tipo de negocio
// =============================================
export const MODULOS_POR_TIPO: Record<TipoNegocio, ModuloSistema[]> = {
    general: ['ventas', 'inventario', 'caja', 'clientes', 'reportes', 'usuarios'],
    tienda: ['ventas', 'inventario', 'caja', 'clientes', 'cuentas_cobrar', 'proveedores', 'compras', 'fiscal', 'reportes', 'usuarios'],
    bar: ['ventas', 'inventario', 'caja', 'clientes', 'mesas', 'cuentas_cobrar', 'proveedores', 'compras', 'reportes', 'usuarios'],
    billar: ['ventas', 'inventario', 'caja', 'clientes', 'mesas', 'cuentas_cobrar', 'reportes', 'usuarios'],
    restaurante: ['ventas', 'inventario', 'caja', 'clientes', 'mesas', 'cocina', 'proveedores', 'compras', 'fiscal', 'reportes', 'usuarios'],
    cafeteria: ['ventas', 'inventario', 'caja', 'clientes', 'mesas', 'proveedores', 'compras', 'reportes', 'usuarios'],
    food_truck: ['ventas', 'inventario', 'caja', 'clientes', 'fiscal', 'reportes', 'usuarios']
};

// =============================================
// Etiquetas legibles
// =============================================
export const TIPOS_NEGOCIO_LABELS: Record<TipoNegocio, string> = {
    general: 'General',
    tienda: 'Tienda / Colmado',
    bar: 'Bar / Licorería',
    billar: 'Billar / Centro de Juegos',
    restaurante: 'Restaurante',
    cafeteria: 'Cafetería',
    food_truck: 'Food Truck / Comida Rápida'
};

export const MODULOS_LABELS: Record<ModuloSistema, string> = {
    ventas: 'Ventas',
    inventario: 'Inventario',
    caja: 'Caja Registradora',
    clientes: 'Gestión de Clientes',
    mesas: 'Mesas y Pedidos',
    cocina: 'Pantalla de Cocina',
    cuentas_cobrar: 'Cuentas por Cobrar',
    cuentas_pagar: 'Cuentas por Pagar',
    compras: 'Compras',
    proveedores: 'Proveedores',
    fiscal: 'Facturación Fiscal (DGII)',
    reportes: 'Reportes',
    usuarios: 'Gestión de Usuarios'
};

// =============================================
// Interface del Negocio
// =============================================
export interface Negocio {
    id: string;
    nombre: string;
    subdominio: string;
    rnc: string | null;
    plan_tipo: 'basico' | 'profesional' | 'pro' | 'perpetual';
    estado_licencia: 'activa' | 'suspendida' | 'vencida';
    fecha_vencimiento: string | null;
    tipo_negocio: TipoNegocio;
    modulos_activos: ModuloSistema[];
    created_at?: string;
}

@Injectable({
    providedIn: 'root'
})
export class NegociosService {
    private negocioActualSubject = new BehaviorSubject<Negocio | null>(null);
    public negocioActual$ = this.negocioActualSubject.asObservable();

    constructor(private supabaseService: SupabaseService) { }

    /**
     * Obtener todos los negocios (Solo para SuperAdmin)
     */
    async obtenerTodos(): Promise<Negocio[]> {
        const { data, error } = await this.supabaseService.client
            .from('negocios')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    /**
     * Obtener detalle de un negocio específico
     */
    async obtenerPorId(id: string): Promise<Negocio | null> {
        const { data, error } = await this.supabaseService.client
            .from('negocios')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error al obtener negocio:', error);
            return null;
        }
        return data;
    }

    /**
     * Registrar un nuevo negocio (Onboarding)
     */
    async crearNegocio(negocio: Partial<Negocio>): Promise<Negocio> {
        // Si se especifica tipo_negocio pero no modulos_activos, usar los defaults
        if (negocio.tipo_negocio && !negocio.modulos_activos) {
            negocio.modulos_activos = [...MODULOS_POR_TIPO[negocio.tipo_negocio]];
        }

        const { data, error } = await this.supabaseService.client
            .from('negocios')
            .insert([negocio])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Actualizar plan o estado de licencia
     */
    async actualizarLicencia(id: string, cambios: Partial<Negocio>): Promise<void> {
        const { error } = await this.supabaseService.client
            .from('negocios')
            .update(cambios)
            .eq('id', id);

        if (error) throw error;
    }

    /**
     * Cargar el negocio actual en el estado (usado después del login)
     */
    async cargarNegocioActual(id: string): Promise<void> {
        const negocio = await this.obtenerPorId(id);
        this.negocioActualSubject.next(negocio);
    }

    // =============================================
    // Helpers para módulos
    // =============================================

    /**
     * Verificar si el negocio actual tiene un módulo activo
     */
    tieneModulo(modulo: ModuloSistema): boolean {
        const negocio = this.negocioActualSubject.value;
        if (!negocio) return true; // Si no hay negocio cargado, mostrar todo (modo desarrollo)
        return negocio.modulos_activos?.includes(modulo) ?? false;
    }

    /**
     * Obtener la lista de módulos activos del negocio actual
     */
    get modulosActivos(): ModuloSistema[] {
        return this.negocioActualSubject.value?.modulos_activos || [];
    }

    /**
     * Obtener el tipo de negocio actual
     */
    get tipoNegocio(): TipoNegocio {
        return this.negocioActualSubject.value?.tipo_negocio || 'general';
    }
}
