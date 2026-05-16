import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FloorMapComponent } from './floor-map/floor-map.component';
import { OrderModalComponent } from './order-modal/order-modal.component';
import { BillSplitComponent } from './bill-split/bill-split.component';
import { TableWithOrder } from '../../models/restaurant.models';

@Component({
  selector: 'app-restaurante',
  standalone: true,
  imports: [CommonModule, RouterModule, FloorMapComponent, OrderModalComponent, BillSplitComponent],
  template: `
    <div class="container-fluid py-3">

      <!-- Título de página -->
      <div class="d-flex align-items-center justify-content-between mb-3">
        <h4 class="mb-0">
          <i class="bi bi-house-door-fill text-primary me-2"></i>
          Mapa de Mesas
        </h4>
        <div class="d-flex gap-2">
          <a routerLink="/restaurante/cocina" class="btn btn-outline-dark btn-sm">
            <i class="bi bi-fire"></i> Pantalla Cocina
          </a>
        </div>
      </div>

      <!-- Mapa de mesas -->
      <app-floor-map (mesaSeleccionada)="abrirOrden($event)"></app-floor-map>

      <!-- Modal de orden (cuando se selecciona una mesa) -->
      @if (mesaActiva) {
        <app-order-modal
          [mesa]="mesaActiva"
          (cerrar)="cerrarOrden()"
          (ordenActualizada)="onOrdenActualizada()">
        </app-order-modal>
      }

      <!-- Modal de pago dividido -->
      @if (ordenParaPagar) {
        <app-bill-split
          [orderId]="ordenParaPagar"
          (cerrar)="cerrarPago()"
          (ordenPagada)="onOrdenPagada()">
        </app-bill-split>
      }
    </div>
  `
})
export class RestauranteComponent {

  mesaActiva: TableWithOrder | null = null;
  ordenParaPagar: string | null = null;

  abrirOrden(mesa: TableWithOrder): void {
    this.mesaActiva = mesa;
  }

  cerrarOrden(): void {
    this.mesaActiva = null;
  }

  onOrdenActualizada(): void {
    // El FloorMap se actualiza via Realtime automáticamente
  }

  abrirPago(orderId: string): void {
    this.mesaActiva = null;
    this.ordenParaPagar = orderId;
  }

  cerrarPago(): void {
    this.ordenParaPagar = null;
  }

  onOrdenPagada(): void {
    this.ordenParaPagar = null;
  }
}
