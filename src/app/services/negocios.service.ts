import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { Negocio } from '../models/negocio.model';

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

@Injectable({
    providedIn: 'root'
})
export class NegociosService {
    private negocioSubject = new BehaviorSubject<Negocio | null>(null);
    public negocio$ = this.negocioSubject.asObservable();

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
     * Obtener detalle de un negocio específico con Resiliencia
     */
    async obtenerPorId(id: string): Promise<Negocio | null> {
        try {
            // Timeout de 10 segundos para evitar bloqueos por 504
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout de base de datos')), 10000)
            );

            const queryPromise = this.supabaseService.client
                .from('negocios')
                .select('*')
                .eq('id', id)
                .single();

            const result: any = await Promise.race([queryPromise, timeoutPromise]);
            
            if (result.error) {
                console.warn('⚠️ Negocio no encontrado o inaccesible:', result.error);
                return null;
            }
            
            return result.data;
        } catch (error) {
            console.error('💥 Error crítico al obtener negocio:', error);
            return null;
        }
    }

    /**
     * Registrar un nuevo negocio (Onboarding)
     */
    async crearNegocio(negocio: Partial<Negocio>): Promise<Negocio> {
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
        if (!negocio) {
            console.warn(`🛑 El negocio ID ${id} no existe. Limpiando ID huérfano.`);
            localStorage.removeItem('logos_negocio_id');
        }
        this.negocioSubject.next(negocio);
    }

    /**
     * Alias para cargar el negocio actual (usado por IdentidadNegocioComponent)
     */
    async cargarNegocio(): Promise<Negocio | null> {
        if (!this.negocioSubject.value) {
            const savedId = localStorage.getItem('logos_negocio_id');
            if (savedId) {
                await this.cargarNegocioActual(savedId);
            }
        }
        return this.negocioSubject.value;
    }

    /**
     * Actualizar los datos del negocio actual
     */
    async actualizarNegocio(cambios: Partial<Negocio>): Promise<void> {
        const negocioActual = this.negocioSubject.value;
        if (!negocioActual) throw new Error('No hay negocio cargado para actualizar');

        const { error } = await this.supabaseService.client
            .from('negocios')
            .update(cambios)
            .eq('id', negocioActual.id);

        if (error) throw error;

        // Actualizar el estado local
        this.negocioSubject.next({ ...negocioActual, ...cambios });
    }

    tieneModulo(modulo: ModuloSistema): boolean {
        const negocio = this.negocioSubject.value;
        if (!negocio) return true;
        return negocio.modulos_activos?.includes(modulo) ?? false;
    }

    get modulosActivos(): ModuloSistema[] {
        return this.negocioSubject.value?.modulos_activos || [];
    }

    get tipoNegocio(): TipoNegocio {
        return this.negocioSubject.value?.tipo_negocio || 'general';
    }
}
