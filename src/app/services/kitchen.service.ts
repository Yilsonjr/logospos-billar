import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { KitchenTicket, EstadoTicketCocina, PrioridadTicket } from '../models/restaurant.models';

@Injectable({ providedIn: 'root' })
export class KitchenService {

  private ticketsSubject = new BehaviorSubject<KitchenTicket[]>([]);
  public tickets$ = this.ticketsSubject.asObservable();

  private realtimeChannel: any = null;
  private alertEnabled = true;

  constructor(private supabaseService: SupabaseService) {}

  private get negocioId(): string {
    return localStorage.getItem('logos_negocio_id') || '';
  }

  // ============================================================
  // TICKETS
  // ============================================================

  async cargarTickets(estados: EstadoTicketCocina[] = ['nuevo', 'en_preparacion', 'listo']): Promise<KitchenTicket[]> {
    const { data, error } = await this.supabaseService.client
      .from('kitchen_tickets')
      .select('*')
      .eq('negocio_id', this.negocioId)
      .in('estado', estados)
      .order('hora_creacion', { ascending: true });

    if (error) {
      console.error('[KitchenService] Error cargando tickets:', error.message);
      throw error;
    }
    this.ticketsSubject.next(data || []);
    return data || [];
  }

  /** Obtener tickets agrupados por columna KDS */
  async cargarTicketsPorColumna(): Promise<Record<EstadoTicketCocina, KitchenTicket[]>> {
    const tickets = await this.cargarTickets(['nuevo', 'en_preparacion', 'listo', 'entregado']);

    return {
      nuevo: tickets.filter(t => t.estado === 'nuevo'),
      en_preparacion: tickets.filter(t => t.estado === 'en_preparacion'),
      listo: tickets.filter(t => t.estado === 'listo'),
      entregado: tickets.filter(t => t.estado === 'entregado')
    };
  }

  async cambiarEstado(ticketId: string, nuevoEstado: EstadoTicketCocina): Promise<void> {
    const update: Partial<KitchenTicket> = { estado: nuevoEstado };

    if (nuevoEstado === 'en_preparacion') update.hora_inicio_prep = new Date().toISOString() as any;
    if (nuevoEstado === 'listo') update.hora_listo = new Date().toISOString() as any;
    if (nuevoEstado === 'entregado') update.hora_entregado = new Date().toISOString() as any;

    const { error } = await this.supabaseService.client
      .from('kitchen_tickets')
      .update(update)
      .eq('id', ticketId)
      .eq('negocio_id', this.negocioId);

    if (error) throw error;

    // Si se marca como entregado, actualizar el estado de los items de la orden
    if (nuevoEstado === 'entregado') {
      const ticket = this.ticketsSubject.value.find(t => t.id === ticketId);
      if (ticket?.items?.length) {
        const itemIds = ticket.items.map(i => i.order_item_id);
        await this.supabaseService.client
          .from('restaurant_order_items')
          .update({ estado: 'entregado' })
          .in('id', itemIds);

        // Verificar si todos los items de la orden fueron entregados
        await this.verificarOrdenCompleta(ticket.order_id);
      }
    }

    await this.cargarTickets();
  }

  private async verificarOrdenCompleta(orderId: string): Promise<void> {
    const { data: items } = await this.supabaseService.client
      .from('restaurant_order_items')
      .select('estado')
      .eq('order_id', orderId)
      .neq('estado', 'cancelado');

    if (!items || items.length === 0) return;

    const todosEntregados = items.every((i: any) => i.estado === 'entregado');
    if (todosEntregados) {
      await this.supabaseService.client
        .from('restaurant_orders')
        .update({ estado: 'lista' })
        .eq('id', orderId)
        .eq('estado', 'en_cocina');
    }
  }

  async cambiarPrioridad(ticketId: string, prioridad: PrioridadTicket): Promise<void> {
    const { error } = await this.supabaseService.client
      .from('kitchen_tickets')
      .update({ prioridad })
      .eq('id', ticketId)
      .eq('negocio_id', this.negocioId);

    if (error) throw error;
    // Actualizar en memoria
    const tickets = this.ticketsSubject.value.map(t =>
      t.id === ticketId ? { ...t, prioridad } : t
    );
    this.ticketsSubject.next(tickets);
  }

  async asignarCocinero(ticketId: string, cocineroId: string): Promise<void> {
    const { error } = await this.supabaseService.client
      .from('kitchen_tickets')
      .update({ cocinero_id: cocineroId })
      .eq('id', ticketId)
      .eq('negocio_id', this.negocioId);

    if (error) throw error;
  }

  // ============================================================
  // UTILIDADES
  // ============================================================

  calcularTiempoTranscurridoMinutos(horaCreacion: string): number {
    return Math.floor((Date.now() - new Date(horaCreacion).getTime()) / 60000);
  }

  calcularTiempoPreparacion(ticket: KitchenTicket): number | null {
    if (!ticket.hora_inicio_prep) return null;
    const fin = ticket.hora_listo ? new Date(ticket.hora_listo) : new Date();
    return Math.floor((fin.getTime() - new Date(ticket.hora_inicio_prep).getTime()) / 60000);
  }

  estaEnTiempoExcedido(ticket: KitchenTicket, limiteMinutos = 20): boolean {
    return this.calcularTiempoTranscurridoMinutos(ticket.hora_creacion) > limiteMinutos;
  }

  // ============================================================
  // REALTIME + ALERTA SONORA
  // ============================================================

  suscribirCambios(onNuevoTicket?: () => void): void {
    this.desuscribir();

    let inicializado = false;

    this.realtimeChannel = this.supabaseService.client
      .channel(`rt_kitchen_${this.negocioId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'kitchen_tickets',
        filter: `negocio_id=eq.${this.negocioId}`
      }, async () => {
        if (inicializado && this.alertEnabled) {
          this.reproducirAlerta();
          if (onNuevoTicket) onNuevoTicket();
        }
        await this.cargarTickets();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'kitchen_tickets',
        filter: `negocio_id=eq.${this.negocioId}`
      }, async () => {
        await this.cargarTickets();
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          inicializado = true;
          console.log('[KitchenService] Realtime conectado');
        }
      });
  }

  toggleAlerta(activa: boolean): void {
    this.alertEnabled = activa;
  }

  private reproducirAlerta(): void {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      console.warn('[KitchenService] AudioContext no disponible');
    }
  }

  desuscribir(): void {
    if (this.realtimeChannel) {
      this.supabaseService.client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }
}
