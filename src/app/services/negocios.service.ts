import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { Negocio } from '../models/negocio.model';

@Injectable({
    providedIn: 'root'
})
export class NegociosService {
    private negocioSubject = new BehaviorSubject<Negocio | null>(null);
    public negocio$ = this.negocioSubject.asObservable();

    constructor(private supabaseService: SupabaseService) { }

    async obtenerTodos(): Promise<Negocio[]> {
        const { data, error } = await this.supabaseService.client
            .from('negocios')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) throw error;
        return data || [];
    }

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
                // Si es error 406 o row not found, avisamos
                console.warn('⚠️ Negocio no encontrado o inaccesible:', result.error);
                return null;
            }
            
            return result.data;
        } catch (error) {
            console.error('💥 Error crítico al obtener negocio:', error);
            return null;
        }
    }

    async cargarNegocioActual(id: string): Promise<void> {
        const negocio = await this.obtenerPorId(id);
        if (!negocio) {
            console.warn(`🛑 El negocio ID ${id} no existe. Limpiando ID huérfano.`);
            localStorage.removeItem('logos_negocio_id');
        }
        this.negocioSubject.next(negocio);
    }

    async cargarNegocio(): Promise<Negocio | null> {
        if (!this.negocioSubject.value) {
            const savedId = localStorage.getItem('logos_negocio_id');
            if (savedId) {
                await this.cargarNegocioActual(savedId);
            }
        }
        return this.negocioSubject.value;
    }

    async actualizarNegocio(cambios: Partial<Negocio>): Promise<void> {
        const negocioActual = this.negocioSubject.value;
        if (!negocioActual) throw new Error('No hay negocio cargado para actualizar');

        const { error } = await this.supabaseService.client
            .from('negocios')
            .update(cambios)
            .eq('id', negocioActual.id);

        if (error) throw error;
        this.negocioSubject.next({ ...negocioActual, ...cambios });
    }

    tieneModulo(modulo: string): boolean {
        const negocio = this.negocioSubject.value;
        if (!negocio) return true;
        return negocio.modulos_activos?.includes(modulo as any) ?? false;
    }

    get modulosActivos(): string[] {
        return (this.negocioSubject.value?.modulos_activos as any) || [];
    }

    get tipoNegocio(): string {
        return (this.negocioSubject.value?.tipo_negocio as any) || 'general';
    }
}
