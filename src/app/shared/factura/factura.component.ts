import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VentaCompleta } from '../../models/ventas.model';
import { PrintingService, TicketFormat } from '../../services/printing.service';
import { FormsModule } from '@angular/forms';
import { NegociosService } from '../../services/negocios.service';
import { Negocio } from '../../models/negocio.model';

@Component({
    selector: 'app-factura',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './factura.component.html',
    styleUrl: './factura.component.css'
})
export class FacturaComponent implements OnInit {
    @Input() venta!: VentaCompleta;
    @Input() simulation: boolean = true; // Si es true, se muestra como modal/simulación
    @Input() formato: TicketFormat = '80mm';
    @Output() cerrar = new EventEmitter<void>();

    negocio: Negocio | null = null;

    constructor(
        private negociosService: NegociosService,
        private printingService: PrintingService
    ) { 
        this.formato = this.printingService.currentFormat;
    }

    async ngOnInit() {
        if (!this.venta) {
            console.error('FacturaComponent: No se proporcionó una venta válida.');
        }
        this.negociosService.negocio$.subscribe(data => {
            this.negocio = data;
        });
    }

    cambiarFormato(nuevoFormato: any) {
        this.formato = nuevoFormato as TicketFormat;
        this.printingService.setFormat(this.formato);
    }

    formatearMoneda(valor: number | undefined): string {
        return new Intl.NumberFormat('es-DO', {
            style: 'currency',
            currency: 'DOP'
        }).format(valor || 0);
    }

    formatearFecha(fecha: string): string {
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
