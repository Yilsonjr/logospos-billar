import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VentasService } from '../../../services/ventas.service';
import { FiscalService } from '../../../services/fiscal.service';
import { Venta } from '../../../models/ventas.model';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-reportes-ventas',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './reportes-ventas.component.html',
    styleUrls: ['./reportes-ventas.component.css']
})
export class ReportesVentasComponent implements OnInit, OnDestroy {
    fechaInicio: string = '';
    fechaFin: string = '';
    ventas: Venta[] = [];
    ventasFiltradas: Venta[] = [];
    isLoading = false;
    modoFiscalActivo = false;

    // Resumen
    totalVentas = 0;
    totalEfectivo = 0;
    totalTarjeta = 0;
    totalTransacciones = 0;
    ticketPromedio = 0;
    topProductos: { nombre: string, cantidad: number, total: number }[] = [];
    distribucionMetodos: { nombre: string, valor: number, color: string }[] = [];

    private subscriptions: Subscription[] = [];

    constructor(
        private ventasService: VentasService,
        private fiscalService: FiscalService,
        private cdr: ChangeDetectorRef
    ) {
        // Inicializar fechas: Desde inicio (ej: 2024-01-01) hasta hoy
        const hoy = new Date();
        this.fechaFin = hoy.toISOString().split('T')[0];
        this.fechaInicio = '2024-01-01'; // "Desde su inicio"
    }

    ngOnInit() {
        console.log('📊 Iniciando Reporte de Ventas Reactivo...');

        // Suscribirse al stream de ventas
        const salesSub = this.ventasService.ventas$.subscribe(ventas => {
            console.log(`📦 Reporte recibió ${ventas.length} ventas`);
            this.ventas = ventas;
            this.aplicarFiltrosYCalcular();
            this.cdr.detectChanges();
        });

        const fiscalSub = this.fiscalService.config$.subscribe(config => {
            this.modoFiscalActivo = config?.modo_fiscal ?? false;
            this.cdr.detectChanges();
        });

        this.subscriptions.push(salesSub, fiscalSub);

        // Carga inicial cargando "todo" (limitado a 5000 para no saturar, pero cubriendo "inicio")
        this.cargarReporte();
    }

    ngOnDestroy() {
        this.subscriptions.forEach(sub => sub.unsubscribe());
    }

    async cargarReporte() {
        this.isLoading = true;
        this.cdr.detectChanges();
        try {
            // Cargamos un lote grande para asegurar que tenemos "todo" desde el inicio
            await this.ventasService.cargarVentas(2000);
        } catch (error) {
            console.error('Error al cargar reporte de ventas:', error);
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    aplicarFiltrosYCalcular() {
        if (!this.ventas) return;

        // Si hay fechas seleccionadas, filtramos la lista en memoria
        const fI = this.fechaInicio ? new Date(this.fechaInicio + 'T00:00:00') : null;
        const fF = this.fechaFin ? new Date(this.fechaFin + 'T23:59:59') : null;

        this.ventasFiltradas = this.ventas.filter(v => {
            const fechaVenta = new Date(v.created_at || '');
            if (fI && fechaVenta < fI) return false;
            if (fF && fechaVenta > fF) return false;
            return true;
        });

        this.calcularResumen(this.ventasFiltradas);
    }

    calcularResumen(ventasInteres: Venta[]) {
        this.totalVentas = 0;
        this.totalEfectivo = 0;
        this.totalTarjeta = 0;
        this.totalTransacciones = ventasInteres.length;

        ventasInteres.forEach(venta => {
            if (venta.estado === 'completada') {
                this.totalVentas += venta.total;

                if (venta.metodo_pago === 'efectivo') {
                    this.totalEfectivo += venta.total;
                } else if (venta.metodo_pago === 'mixto') {
                    // Desglose proporcional si no hay detalle exacto en BD
                    this.totalEfectivo += (venta.monto_efectivo || venta.total / 2);
                    this.totalTarjeta += (venta.monto_tarjeta || venta.total / 2);
                } else if (venta.metodo_pago === 'tarjeta') {
                    this.totalTarjeta += venta.total;
                }
            }
        });

        this.ticketPromedio = this.totalTransacciones > 0 ? this.totalVentas / this.totalTransacciones : 0;

        this.calcularTopProductos(ventasInteres);
        this.calcularDistribucionMetodos(ventasInteres);

        this.cdr.detectChanges();
    }

    private async calcularTopProductos(ventas: Venta[]) {
        const productMap = new Map<number, { nombre: string, cantidad: number, total: number }>();

        // Necesitamos los detalles de estas ventas. 
        // Para optimizar, podríamos hacer una sola petición a Supabase para todos los detalles de estas ventas
        const ventaIds = ventas.filter(v => v.estado === 'completada').map(v => v.id);

        if (ventaIds.length === 0) {
            this.topProductos = [];
            return;
        }

        try {
            const { data: detalles, error } = await this.ventasService['supabaseService'].client
                .from('ventas_detalle')
                .select('producto_id, producto_nombre, cantidad, subtotal')
                .in('venta_id', ventaIds);

            if (error) throw error;

            (detalles || []).forEach((d: any) => {
                const current = productMap.get(d.producto_id) || { nombre: d.producto_nombre, cantidad: 0, total: 0 };
                current.cantidad += d.cantidad;
                current.total += d.subtotal;
                productMap.set(d.producto_id, current);
            });

            this.topProductos = Array.from(productMap.values())
                .sort((a, b) => b.cantidad - a.cantidad)
                .slice(0, 5);

        } catch (error) {
            console.error('Error calculando top productos:', error);
            this.topProductos = [];
        }
    }

    private calcularDistribucionMetodos(ventas: Venta[]) {
        const metodos = [
            { id: 'efectivo', nombre: 'Efectivo', color: '#10b981' },
            { id: 'tarjeta', nombre: 'Tarjeta', color: '#3699ff' },
            { id: 'mixto', nombre: 'Mixto', color: '#f6ad55' },
            { id: 'credito', nombre: 'Crédito', color: '#7e8299' }
        ];

        this.distribucionMetodos = metodos.map(m => {
            const count = ventas.filter(v => v.estado === 'completada' && v.metodo_pago === m.id).length;
            const porcentaje = ventas.length > 0 ? (count / ventas.length) * 100 : 0;
            return {
                nombre: m.nombre,
                valor: porcentaje,
                color: m.color
            };
        }).filter(m => m.valor > 0);
    }

    exportarReporte() {
        if (this.ventas.length === 0) {
            alert('No hay datos para exportar');
            return;
        }

        const datosExportar = this.ventas.map(v => ({
            Fecha: new Date(v.created_at || '').toLocaleDateString(),
            Factura: v.numero_venta,
            NCF: v.ncf || '',
            RNC: v.rnc_cliente || '',
            Cliente: v.cliente_id ? `Cliente #${v.cliente_id}` : 'General',
            Metodo: v.metodo_pago,
            Total: v.total,
            Estado: v.estado
        }));

        const headers = Object.keys(datosExportar[0]).join(',');
        const csvContent = datosExportar.map(row =>
            Object.values(row).map(val => `"${val}"`).join(',')
        ).join('\n');

        const blob = new Blob([headers + '\n' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `reporte_ventas_${this.fechaInicio}_${this.fechaFin}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    formatearMoneda(valor: number): string {
        return new Intl.NumberFormat('es-DO', {
            style: 'currency',
            currency: 'DOP'
        }).format(valor);
    }

    formatearFecha(fecha: string): string {
        return new Date(fecha).toLocaleDateString() + ' ' + new Date(fecha).toLocaleTimeString();
    }
}
