import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { PrintingService, TicketFormat } from '../../services/printing.service';

export interface DatosCierreTicket {
    id: number;
    fecha_apertura: string;
    fecha_cierre: string;
    monto_inicial: number;
    ventas_efectivo: number;
    ventas_tarjeta: number;
    ventas_credito: number;
    ventas_mixto: number;
    total_entradas: number;
    total_salidas: number;
    monto_esperado: number;
    monto_real: number;
    diferencia: number;
    usuario_apertura: string;
    usuario_cierre?: string;
    notas?: string;
    arqueo?: any;
}

@Component({
    selector: 'app-ticket-cierre',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './ticket-cierre.component.html',
    styleUrl: './ticket-cierre.component.css'
})
export class TicketCierreComponent implements OnInit {
    @Input() datos!: DatosCierreTicket;
    @Output() cerrar = new EventEmitter<void>();
    @Input() showActions: boolean = true;
    @Input() formato: TicketFormat = '80mm';

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
        if (!this.datos) {
            console.error('TicketCierreComponent: No se proporcionaron datos de cierre.');
        }
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
