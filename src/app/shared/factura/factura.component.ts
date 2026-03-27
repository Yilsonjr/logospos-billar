import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VentaCompleta } from '../../models/ventas.model';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';

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
    @Input() formato: '80mm' | '58mm' | 'a4' = '80mm'; // Added new input
    @Output() cerrar = new EventEmitter<void>();

    negocio: any = { // Changed type to any and updated default values
        nombre: 'LogosPOS',
        rnc: '131-XXXXX-X',
        telefono: '(809) 000-0000',
        direccion: 'Cargando...',
        lema: '¡Gracias por su preferencia!'
    };

    constructor(private supabaseService: SupabaseService) { } // Added constructor with SupabaseService injection

    async ngOnInit() { // Made ngOnInit async
        if (!this.venta) {
            console.error('FacturaComponent: No se proporcionó una venta válida.');
        }
        await this.cargarDatosNegocio(); // Added call to cargarDatosNegocio
    }

    async cargarDatosNegocio() { // Added new method
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
            console.warn('No se pudo cargar la configuración del negocio, usando valores por defecto.');
        }
    }

    cambiarFormato(nuevoFormato: any) { // Added new method
        this.formato = nuevoFormato;
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
