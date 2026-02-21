import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { METODOS_PAGO } from '../../../models/ventas.model';
import { Cliente } from '../../../models/clientes.model';
import { ConfiguracionFiscal, TIPOS_COMPROBANTE } from '../../../models/fiscal.model';

@Component({
    selector: 'app-modal-pago',
    imports: [CommonModule, FormsModule],
    templateUrl: './modal.pago.html',
    styleUrl: './modal.pago.css'
})
export class ModalPagoComponent implements OnInit, OnChanges {
    @Input() total: number = 0;
    @Input() clienteSeleccionado?: Cliente;

    // === FISCAL ===
    @Input() configFiscal: ConfiguracionFiscal | null = null;
    @Input() tipoComprobante: string = 'B02';
    @Input() rncCliente: string = '';
    @Output() tipoComprobanteChange = new EventEmitter<string>();
    @Output() rncClienteChange = new EventEmitter<string>();
    tiposComprobante = TIPOS_COMPROBANTE.filter(t => t.codigo !== 'B03' && t.codigo !== 'B04');
    // ==============

    @Output() confirmarPago = new EventEmitter<any>();
    @Output() cancelar = new EventEmitter<void>();

    metodoPago: 'efectivo' | 'tarjeta' | 'credito' | 'mixto' = 'efectivo';
    montoEfectivo: number | null = null;
    montoTarjeta: number = 0;
    cambio: number = 0;
    metodosPago = METODOS_PAGO.map(m => ({ valor: m.valor as 'efectivo' | 'tarjeta' | 'credito' | 'mixto', etiqueta: m.etiqueta, icono: m.icono }));

    ngOnInit() {
        this.cambiarMetodoPago('efectivo');
    }

    ngOnChanges(changes: SimpleChanges) {
        // Si cambia el cliente y tiene RNC, auto-switch a B01
        if (changes['clienteSeleccionado'] && this.configFiscal?.modo_fiscal) {
            const rnc = (this.clienteSeleccionado as any)?.rnc;
            if (rnc) {
                this.tipoComprobante = 'B01';
                this.rncCliente = rnc;
                this.tipoComprobanteChange.emit(this.tipoComprobante);
                this.rncClienteChange.emit(this.rncCliente);
            } else {
                this.tipoComprobante = 'B02';
                this.tipoComprobanteChange.emit(this.tipoComprobante);
            }
        }
    }

    cambiarMetodoPago(metodo: 'efectivo' | 'tarjeta' | 'credito' | 'mixto') {
        this.metodoPago = metodo;
        this.montoEfectivo = null;
        this.montoTarjeta = 0;
        this.cambio = -this.total; // Cambio inicial negativo

        if (metodo === 'tarjeta') {
            this.montoTarjeta = this.total;
            this.cambio = 0;
        }
    }

    calcularCambio() {
        const efectivo = this.montoEfectivo || 0;
        if (this.metodoPago === 'efectivo') {
            this.cambio = efectivo - this.total;
        } else if (this.metodoPago === 'mixto') {
            const totalPagado = efectivo + this.montoTarjeta;
            this.cambio = totalPagado - this.total;
        }
    }

    calcularMixto() {
        const efectivo = this.montoEfectivo || 0;
        const totalPagado = efectivo + this.montoTarjeta;
        this.cambio = totalPagado - this.total;
    }

    formatearMoneda(valor: number): string {
        return new Intl.NumberFormat('es-DO', {
            style: 'currency',
            currency: 'DOP'
        }).format(valor);
    }

    // === KEYPAD LOGIC (FASE 9) ===
    pulsarNumero(num: string) {
        const actual = this.montoEfectivo?.toString() || '';
        this.montoEfectivo = parseFloat(actual + num);
        this.calcularCambio();
    }

    borrarNumero() {
        const actual = this.montoEfectivo?.toString() || '';
        if (actual.length <= 1) {
            this.montoEfectivo = null;
        } else {
            this.montoEfectivo = parseFloat(actual.slice(0, -1));
        }
        this.calcularCambio();
    }

    limpiarNumero() {
        this.montoEfectivo = null;
        this.calcularCambio();
    }

    setMontoExacto() {
        this.montoEfectivo = this.total;
        this.calcularCambio();
    }

    sumarMontoRapido(monto: number) {
        this.montoEfectivo = (this.montoEfectivo || 0) + monto;
        this.calcularCambio();
    }
    // =============================

    onConfirmar() {
        this.confirmarPago.emit({
            metodoPago: this.metodoPago,
            montoEfectivo: this.montoEfectivo || 0,
            montoTarjeta: this.montoTarjeta,
            cambio: this.cambio,
            // Fiscal — solo se incluyen si modo_fiscal está activo
            tipoComprobante: this.configFiscal?.modo_fiscal ? this.tipoComprobante : undefined,
            rncCliente: this.configFiscal?.modo_fiscal ? this.rncCliente : undefined
        });
    }
}
