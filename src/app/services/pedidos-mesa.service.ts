import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { PedidoMesa, PedidoMesaDetalle } from '../models/mesa.model';
import { BehaviorSubject } from 'rxjs';
import { MesasService } from './mesas.service';

@Injectable({
    providedIn: 'root'
})
export class PedidosMesaService {
    private pedidosActivosSubject = new BehaviorSubject<PedidoMesa[]>([]);
    public pedidosActivos$ = this.pedidosActivosSubject.asObservable();

    constructor(
        private supabaseService: SupabaseService,
        private mesasService: MesasService
    ) {
        this.cargarPedidosActivos();
        this.suscribirPedidos();
    }

    private suscribirPedidos() {
        // Suscribir a cambios en los pedidos
        this.supabaseService.client
            .channel('public:pedidos_mesa')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_mesa' }, () => {
                this.cargarPedidosActivos();
            })
            .subscribe();

        // Suscribir a cambios en los detalles (importante para el carrito)
        this.supabaseService.client
            .channel('public:pedidos_mesa_detalle')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_mesa_detalle' }, () => {
                this.cargarPedidosActivos();
            })
            .subscribe();
    }

    async cargarPedidosActivos(): Promise<void> {
        try {
            const { data, error } = await this.supabaseService.client
                .from('pedidos_mesa')
                .select(`
          *,
          mesas (numero),
          pedidos_mesa_detalle (*)
        `)
                .eq('estado', 'abierto');

            if (error) throw error;

            const pedidosMapeados = (data || []).map((p: any) => ({
                ...p,
                mesa_numero: p.mesas?.numero,
                detalles: (p.pedidos_mesa_detalle || []).map((d: any) => ({
                    ...d,
                    estado_preparacion: d.estado_preparacion || 'solicitado'
                }))
            }));

            this.pedidosActivosSubject.next(pedidosMapeados);
        } catch (error) {
            console.error('Error al cargar pedidos activos:', error);
        }
    }

    async abrirPedidoMesa(mesaId: number, usuarioId: number, nombreCliente?: string): Promise<PedidoMesa> {
        try {
            // 1. Crear el pedido
            const { data: pedido, error: errorPedido } = await this.supabaseService.client
                .from('pedidos_mesa')
                .insert([{
                    mesa_id: mesaId,
                    usuario_id: usuarioId,
                    nombre_cliente: nombreCliente || null,
                    estado: 'abierto',
                    total: 0
                }])
                .select()
                .single();

            if (errorPedido) throw errorPedido;

            // 2. Ocupar la mesa
            await this.mesasService.actualizarEstadoMesa(mesaId, 'ocupada');

            await this.cargarPedidosActivos();
            return pedido;
        } catch (error) {
            console.error('Error al abrir pedido:', error);
            throw error;
        }
    }

    async agregarDetallePedido(detalle: Partial<PedidoMesaDetalle>): Promise<void> {
        try {
            const { error } = await this.supabaseService.client
                .from('pedidos_mesa_detalle')
                .insert([detalle]);

            if (error) throw error;

            // Actualizar total del pedido
            await this.actualizarTotalPedido(detalle.pedido_id!);
            await this.cargarPedidosActivos();
        } catch (error) {
            console.error('Error al agregar detalle:', error);
            throw error;
        }
    }

    private async actualizarTotalPedido(pedidoId: number): Promise<void> {
        const { data: detalles } = await this.supabaseService.client
            .from('pedidos_mesa_detalle')
            .select('subtotal')
            .eq('pedido_id', pedidoId);

        const total = (detalles || []).reduce((sum, d) => sum + Number(d.subtotal), 0);

        await this.supabaseService.client
            .from('pedidos_mesa')
            .update({ total, updated_at: new Date().toISOString() })
            .eq('id', pedidoId);
    }

    async finalizarPedido(pedidoId: number, mesaId: number): Promise<void> {
        try {
            // 1. Marcar el pedido como finalizado
            const { error: errorPedido } = await this.supabaseService.client
                .from('pedidos_mesa')
                .update({ estado: 'finalizado', updated_at: new Date().toISOString() })
                .eq('id', pedidoId);

            if (errorPedido) throw errorPedido;

            // 2. Liberar la mesa
            await this.mesasService.actualizarEstadoMesa(mesaId, 'disponible');

            await this.cargarPedidosActivos();
        } catch (error) {
            console.error('Error al finalizar pedido:', error);
            throw error;
        }
    }

    async cancelarPedido(pedidoId: number, mesaId: number): Promise<void> {
        try {
            // 1. Marcar el pedido como cancelado
            const { error: errorPedido } = await this.supabaseService.client
                .from('pedidos_mesa')
                .update({ estado: 'cancelado', updated_at: new Date().toISOString() })
                .eq('id', pedidoId);

            if (errorPedido) throw errorPedido;

            // 2. Liberar la mesa
            await this.mesasService.actualizarEstadoMesa(mesaId, 'disponible');

            await this.cargarPedidosActivos();
        } catch (error) {
            console.error('Error al cancelar pedido:', error);
            throw error;
        }
    }

    async obtenerPedidoPorMesa(mesaId: number): Promise<PedidoMesa | null> {
        const pedido = this.pedidosActivosSubject.value.find(p => p.mesa_id === mesaId);
        return pedido || null;
    }
}
