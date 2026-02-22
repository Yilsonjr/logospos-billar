import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VentaCompleta } from '../../models/ventas.model';

@Component({
    selector: 'app-factura',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './factura.component.html',
    styleUrl: './factura.component.css'
})
export class FacturaComponent implements OnInit {
    @Input() venta!: VentaCompleta;
    @Input() simulation: boolean = true; // Si es true, se muestra como modal/simulación
    @Output() cerrar = new EventEmitter<void>();

    negocio = {
        nombre: 'LogosPOS',
        rnc: '131-12345-6',
        telefono: '(809) 123-4567',
        direccion: 'Av. Principal #123, Santo Domingo, RD',
        lema: '¡Gracias por su preferencia!'
    };

    ngOnInit() {
        if (!this.venta) {
            console.error('FacturaComponent: No se proporcionó una venta válida.');
        }
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
