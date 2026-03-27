import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';

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
    imports: [CommonModule, FormsModule],
    templateUrl: './ticket-cierre.component.html',
    styleUrl: './ticket-cierre.component.css'
})
export class TicketCierreComponent implements OnInit {
    @Input() datos!: DatosCierreTicket;
    @Input() showActions: boolean = true;
    @Input() formato: '80mm' | '58mm' | 'a4' = '80mm';
    @Output() cerrar = new EventEmitter<void>();

    negocio: any = {
        nombre: 'LogosPOS',
        rnc: '131-XXXXX-X',
        telefono: '(809) 000-0000',
        direccion: 'Cargando...'
    };

    constructor(private supabaseService: SupabaseService) { }

    async ngOnInit() {
        await this.cargarDatosNegocio();
    }

    async cargarDatosNegocio() {
        try {
            const { data, error } = await this.supabaseService.client
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
        this.formato = nuevoFormato;
    }

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
