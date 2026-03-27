import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { PrintingService, TicketFormat } from '../../services/printing.service';
import { PedidoMesa } from '../../models/mesa.model';

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

    negocio: any = {
        nombre: 'LogosPOS',
        rnc: '131-XXXXX-X',
        telefono: '(809) 000-0000',
        direccion: 'Cargando...'
    };

    constructor(
        private supabaseService: SupabaseService,
        private printingService: PrintingService
    ) { 
        this.formato = this.printingService.currentFormat;
    }

    async ngOnInit() {
        await this.cargarDatosNegocio();
    }

    async cargarDatosNegocio() {
        try {
            const { data } = await this.supabaseService.client
                .from('negocios')
                .select('*')
                .limit(1)
                .single();

            if (data) {
                this.negocio = data;
            }
        } catch (error) {
            console.warn('No se pudo cargar la configuración del negocio.');
        }
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
