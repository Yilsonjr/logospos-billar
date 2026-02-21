import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CuentaConPagos } from '../../../models/cuentas-cobrar.model';
import { CuentasCobrarService } from '../../../services/cuentas-cobrar.service';

@Component({
  selector: 'app-historial-pagos',
  imports: [CommonModule],
  templateUrl: './historial-pagos.component.html',
  styleUrl: './historial-pagos.component.css'
})
export class HistorialPagosComponent implements OnInit {
  @Input() cuentaId!: number;
  @Output() close = new EventEmitter<void>();

  cuenta?: CuentaConPagos;
  isLoading = true;

  constructor(private cuentasService: CuentasCobrarService) {}

  async ngOnInit() {
    await this.cargarHistorial();
  }

  async cargarHistorial() {
    try {
      this.isLoading = true;
      this.cuenta = await this.cuentasService.obtenerCuentaConPagos(this.cuentaId);
      this.isLoading = false;
    } catch (error) {
      console.error('Error al cargar historial:', error);
      this.isLoading = false;
    }
  }

  cerrarModal() {
    this.close.emit();
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get totalPagado(): number {
    return this.cuenta?.pagos.reduce((sum, p) => sum + p.monto, 0) || 0;
  }

  imprimirHistorial() {
    window.print();
  }
}
