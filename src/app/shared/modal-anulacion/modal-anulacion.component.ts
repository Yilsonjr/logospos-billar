import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MOTIVOS_ANULACION, MotivoAnulacion } from '../../models/anulaciones.model';

export interface AnulacionConfirmada {
  motivoCategoria: MotivoAnulacion;
  motivoDetalle: string;
}

@Component({
  selector: 'app-modal-anulacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-anulacion.component.html'
})
export class ModalAnulacionComponent {
  @Input() titulo = 'Anular cobro';
  @Input() referencia = '';       // Ej: "Orden #3A0212" o "Factura FAC-001"
  @Input() procesando = false;

  @Output() confirmar = new EventEmitter<AnulacionConfirmada>();
  @Output() cancelar  = new EventEmitter<void>();

  readonly motivos = MOTIVOS_ANULACION;

  motivoCategoria: MotivoAnulacion = 'error_cobro';
  motivoDetalle = '';

  get puedeConfirmar(): boolean {
    return !!this.motivoCategoria && !this.procesando;
  }

  onConfirmar(): void {
    if (!this.puedeConfirmar) return;
    this.confirmar.emit({
      motivoCategoria: this.motivoCategoria,
      motivoDetalle:   this.motivoDetalle.trim()
    });
  }
}
