import { Component, OnInit, OnDestroy, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RestaurantTablesService } from '../../../services/restaurant-tables.service';
import {
  TableWithOrder, RestaurantZone,
  COLOR_ESTADO_MESA, LABEL_ESTADO_MESA, EstadoMesa
} from '../../../models/restaurant.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-floor-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './floor-map.component.html',
  styleUrl: './floor-map.component.css'
})
export class FloorMapComponent implements OnInit, OnDestroy {

  @Output() mesaSeleccionada = new EventEmitter<TableWithOrder>();

  mesas: TableWithOrder[] = [];
  mesasFiltradas: TableWithOrder[] = [];
  zonas: RestaurantZone[] = [];
  zonaSeleccionadaId = '';

  cargando = true;
  errorMsg = '';

  readonly colorEstado = COLOR_ESTADO_MESA;
  readonly labelEstado = LABEL_ESTADO_MESA;
  readonly estadosLeyenda: EstadoMesa[] = ['libre', 'ocupada', 'reservada', 'limpieza', 'bloqueada'];

  constructor(private tablesService: RestaurantTablesService, private cdr: ChangeDetectorRef) {}

  async ngOnInit(): Promise<void> {
    await this.cargarDatos();
    this.tablesService.suscribirCambios(() => this.cargarDatos());
  }

  ngOnDestroy(): void {
    this.tablesService.desuscribir();
  }

  async cargarDatos(): Promise<void> {
    try {
      this.cargando = true;
      this.errorMsg = '';
      [this.zonas, this.mesas] = await Promise.all([
        this.tablesService.cargarZonas(),
        this.tablesService.cargarMesasConOrden()
      ]);
      this.filtrarPorZona();
    } catch (e: any) {
      this.errorMsg = e.message || 'Error al cargar mesas';
      console.error('[FloorMap]', e);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  filtrarPorZona(): void {
    this.mesasFiltradas = this.zonaSeleccionadaId
      ? this.mesas.filter(m => m.zona_id === this.zonaSeleccionadaId)
      : this.mesas;
  }

  onZonaChange(zonaId: string): void {
    this.zonaSeleccionadaId = zonaId;
    this.filtrarPorZona();
  }

  seleccionarMesa(mesa: TableWithOrder): void {
    if (mesa.estado === 'bloqueada') {
      Swal.fire('Mesa bloqueada', 'Esta mesa no está disponible.', 'info');
      return;
    }
    this.mesaSeleccionada.emit(mesa);
  }

  async cambiarEstado(mesa: TableWithOrder, nuevoEstado: EstadoMesa): Promise<void> {
    try {
      await this.tablesService.actualizarEstadoMesa(mesa.id, nuevoEstado);
      mesa.estado = nuevoEstado;
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error');
    }
  }

  async liberarMesa(mesa: TableWithOrder): Promise<void> {
    const { isConfirmed } = await Swal.fire({
      title: `¿Liberar Mesa ${mesa.numero_mesa}?`,
      text: 'Esta acción marcará la mesa como libre.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, liberar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#28a745'
    });
    if (isConfirmed) await this.cambiarEstado(mesa, 'libre');
  }

  // Métricas rápidas
  get totalMesas(): number { return this.mesas.length; }
  get mesasLibres(): number { return this.mesas.filter(m => m.estado === 'libre').length; }
  get mesasOcupadas(): number { return this.mesas.filter(m => m.estado === 'ocupada').length; }
  get ocupacionPct(): number {
    if (!this.mesas.length) return 0;
    return Math.round((this.mesasOcupadas / this.mesas.length) * 100);
  }

  trackByMesa(_: number, m: TableWithOrder): string { return m.id; }
  trackByZona(_: number, z: RestaurantZone): string { return z.id; }
}
