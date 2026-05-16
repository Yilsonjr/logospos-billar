import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KitchenService } from '../../../services/kitchen.service';
import {
  KitchenTicket, EstadoTicketCocina,
  LABEL_ESTADO_TICKET, COLOR_PRIORIDAD, PrioridadTicket
} from '../../../models/restaurant.models';
import Swal from 'sweetalert2';

interface Columna {
  estado: EstadoTicketCocina;
  titulo: string;
  icono: string;
  colorHeader: string;
  tickets: KitchenTicket[];
}

@Component({
  selector: 'app-kitchen-display',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kitchen-display.component.html',
  styleUrl: './kitchen-display.component.css'
})
export class KitchenDisplayComponent implements OnInit, OnDestroy {

  columnas: Columna[] = [
    { estado: 'nuevo',          titulo: 'NUEVAS',        icono: 'bi-bell-fill',      colorHeader: 'bg-danger',   tickets: [] },
    { estado: 'en_preparacion', titulo: 'EN PREPARACIÓN',icono: 'bi-fire',           colorHeader: 'bg-warning',  tickets: [] },
    { estado: 'listo',          titulo: 'LISTAS',        icono: 'bi-check-circle-fill',colorHeader: 'bg-success', tickets: [] },
    { estado: 'entregado',      titulo: 'ENTREGADAS',    icono: 'bi-bag-check-fill', colorHeader: 'bg-secondary',tickets: [] }
  ];

  alertaActiva = true;
  cargando = true;
  timerInterval: any;
  horaActual = new Date();

  // Para arrastrar tickets
  ticketArrastrado: KitchenTicket | null = null;

  readonly labelEstado = LABEL_ESTADO_TICKET;
  readonly colorPrioridad = COLOR_PRIORIDAD;

  constructor(private kitchenService: KitchenService, private cdr: ChangeDetectorRef) {}

  async ngOnInit(): Promise<void> {
    await this.cargarTickets();
    this.kitchenService.suscribirCambios(() => this.cargarTickets());
    // Timer para actualizar tiempos cada 30s
    this.timerInterval = setInterval(() => {
      this.horaActual = new Date();
      this.columnas = [...this.columnas];
      this.cdr.detectChanges();
    }, 30000);
  }

  ngOnDestroy(): void {
    this.kitchenService.desuscribir();
    clearInterval(this.timerInterval);
  }

  async cargarTickets(): Promise<void> {
    try {
      this.cargando = true;
      const todos = await this.kitchenService.cargarTickets(['nuevo', 'en_preparacion', 'listo', 'entregado']);
      this.columnas.forEach(col => {
        col.tickets = todos.filter(t => t.estado === col.estado);
      });
    } catch (e: any) {
      console.error('[KitchenDisplay] Error:', e.message);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  // ============================================================
  // ACCIONES DE TICKETS
  // ============================================================

  async avanzarEstado(ticket: KitchenTicket): Promise<void> {
    const flujo: Record<EstadoTicketCocina, EstadoTicketCocina | null> = {
      nuevo: 'en_preparacion',
      en_preparacion: 'listo',
      listo: 'entregado',
      entregado: null
    };
    const siguiente = flujo[ticket.estado];
    if (!siguiente) return;

    try {
      await this.kitchenService.cambiarEstado(ticket.id, siguiente);
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error');
    }
  }

  async cambiarPrioridad(ticket: KitchenTicket, prioridad: PrioridadTicket): Promise<void> {
    try {
      await this.kitchenService.cambiarPrioridad(ticket.id, prioridad);
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error');
    }
  }

  // ============================================================
  // DRAG & DROP (nativo HTML5)
  // ============================================================

  onDragStart(ticket: KitchenTicket): void {
    this.ticketArrastrado = ticket;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  async onDrop(event: DragEvent, estadoDestino: EstadoTicketCocina): Promise<void> {
    event.preventDefault();
    if (!this.ticketArrastrado) return;
    if (this.ticketArrastrado.estado === estadoDestino) {
      this.ticketArrastrado = null;
      return;
    }
    try {
      await this.kitchenService.cambiarEstado(this.ticketArrastrado.id, estadoDestino);
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error');
    } finally {
      this.ticketArrastrado = null;
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================

  tiempoTranscurrido(horaCreacion: string): number {
    return this.kitchenService.calcularTiempoTranscurridoMinutos(horaCreacion);
  }

  colorTiempo(minutos: number): string {
    if (minutos < 10) return 'text-success';
    if (minutos < 20) return 'text-warning';
    return 'text-danger';
  }

  esTiempoExcedido(ticket: KitchenTicket): boolean {
    return this.kitchenService.estaEnTiempoExcedido(ticket);
  }

  toggleAlerta(): void {
    this.alertaActiva = !this.alertaActiva;
    this.kitchenService.toggleAlerta(this.alertaActiva);
  }

  trackByTicket(_: number, t: KitchenTicket): string { return t.id; }
}
