import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DatosCierreTicket {
    id: number;
    usuario_apertura: string;
    usuario_cierre: string;
    fecha_apertura: string;
    fecha_cierre: string;
    monto_inicial: number;
    ventas_efectivo: number;
    ventas_tarjeta: number;
    total_entradas: number;
    total_salidas: number;
    monto_esperado: number;
    monto_real: number;
    diferencia: number;
    notas?: string;
    arqueo?: {
        billetes_2000: number;
        billetes_1000: number;
        billetes_500: number;
        billetes_200: number;
        billetes_100: number;
        billetes_50: number;
        monedas_25: number;
        monedas_10: number;
        monedas_5: number;
        monedas_1: number;
        total_billetes: number;
        total_monedas: number;
    };
}

@Component({
    selector: 'app-ticket-cierre',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './ticket-cierre.component.html',
    styleUrl: './ticket-cierre.component.css'
})
export class TicketCierreComponent {
    @Input() datos!: DatosCierreTicket;
    @Input() showActions: boolean = true;
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

    formatearFecha(fecha: string | undefined): string {
        if (!fecha) return 'N/A';
        return new Date(fecha).toLocaleString('es-DO', {
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
