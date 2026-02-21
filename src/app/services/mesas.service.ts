import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Mesa } from '../models/mesa.model';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class MesasService {
    private mesasSubject = new BehaviorSubject<Mesa[]>([]);
    public mesas$ = this.mesasSubject.asObservable();

    constructor(private supabaseService: SupabaseService) {
        this.cargarMesas();
        this.suscribirMesas();
    }

    private suscribirMesas() {
        this.supabaseService.client
            .channel('public:mesas')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => {
                this.cargarMesas();
            })
            .subscribe();
    }

    async cargarMesas(): Promise<void> {
        try {
            const { data, error } = await this.supabaseService.client
                .from('mesas')
                .select('*')
                .order('numero', { ascending: true });

            if (error) throw error;
            this.mesasSubject.next(data || []);
        } catch (error) {
            console.error('Error al cargar mesas:', error);
        }
    }

    async crearMesa(mesa: Partial<Mesa>): Promise<Mesa> {
        const { data, error } = await this.supabaseService.client
            .from('mesas')
            .insert([mesa])
            .select()
            .single();

        if (error) throw error;
        await this.cargarMesas();
        return data;
    }

    async actualizarMesa(id: number, mesa: Partial<Mesa>): Promise<void> {
        const { error } = await this.supabaseService.client
            .from('mesas')
            .update(mesa)
            .eq('id', id);

        if (error) throw error;
        await this.cargarMesas();
    }

    async eliminarMesa(id: number): Promise<void> {
        const { error } = await this.supabaseService.client
            .from('mesas')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await this.cargarMesas();
    }

    async actualizarEstadoMesa(id: number, estado: 'disponible' | 'ocupada' | 'mantenimiento'): Promise<void> {
        const { error } = await this.supabaseService.client
            .from('mesas')
            .update({ estado })
            .eq('id', id);

        if (error) throw error;
        await this.cargarMesas();
    }
}
