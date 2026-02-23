import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PedidoMesa } from '../../models/mesa.model';

@Component({
    selector: 'app-ticket-precuenta',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './ticket-precuenta.component.html',
    styleUrl: './ticket-precuenta.component.css'
})
export class TicketPrecuentaComponent {
    @Input() pedido!: PedidoMesa;
    @Output() cerrar = new EventEmitter<void>();

    negocio = {
        nombre: 'LogosPOS',
        rnc: '131-12345-6',
        telefono: '(809) 123-4567',
        direccion: 'Av. Principal #123, Santo Domingo, RD'
    };

    formatearMoneda(valor: number | undefined): string {
        return new Intl.NumberFormat('es-DO', {
            style: 'currency',
            currency: 'DOP'
        }).format(valor || 0);
    }

    formatearFecha(): string {
        return new Date().toLocaleString('es-DO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    imprimir() {
        window.print();
    }

    onCerrar() {
        this.cerrar.emit();
    }
}
