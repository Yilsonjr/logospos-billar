import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrintingService, TicketFormat } from '../../services/printing.service';
import { PedidoMesa } from '../../models/mesa.model';
import { NegociosService } from '../../services/negocios.service';
import { Negocio } from '../../models/negocio.model';

@Component({
    selector: 'app-ticket-precuenta',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './ticket-precuenta.component.html',
    styleUrl: './ticket-precuenta.component.css'
})
export class TicketPrecuentaComponent implements OnInit {
    @Input() pedido!: PedidoMesa;
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

    formatearFecha(fecha?: string): string {
        const date = fecha ? new Date(fecha) : new Date();
        return date.toLocaleString('es-DO', {
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
