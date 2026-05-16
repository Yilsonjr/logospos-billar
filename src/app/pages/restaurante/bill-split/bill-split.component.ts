import { Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RestaurantOrdersService } from '../../../services/restaurant-orders.service';
import { SupabaseService } from '../../../services/supabase.service';
import {
  OrderWithItems, OrderItemWithMenuItem, CuentaComensal,
  FormaPago, RestaurantOrderPayment
} from '../../../models/restaurant.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-bill-split',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bill-split.component.html',
  styleUrl: './bill-split.component.css'
})
export class BillSplitComponent implements OnInit {

  @Input() orderId!: string;
  @Output() cerrar = new EventEmitter<void>();
  @Output() ordenPagada = new EventEmitter<void>();

  orden: OrderWithItems | null = null;
  cuentas: CuentaComensal[] = [];

  // Modo de división
  modoDivision: 'individual' | 'partes_iguales' | 'por_comensal' = 'individual';
  partesIguales = 2;
  propinaGlobal = 0;
  propinaOpcion: 10 | 15 | 18 | 0 = 0;

  cargando = true;
  procesando = false;

  readonly formasPago: FormaPago[] = ['efectivo', 'tarjeta', 'transferencia', 'cheque', 'mixto'];

  constructor(
    private ordersService: RestaurantOrdersService,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.cargando = true;
      this.orden = await this.ordersService.obtenerOrdenPorId(this.orderId);
      if (this.orden) this.inicializarCuentaSimple();
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  // ============================================================
  // MODOS DE DIVISIÓN
  // ============================================================

  inicializarCuentaSimple(): void {
    this.modoDivision = 'individual';
    this.cuentas = [{
      numero: 1,
      items: this.itemsActivos as OrderItemWithMenuItem[],
      subtotal: this.subtotalOrden,
      propina: 0,
      total: this.totalOrden,
      forma_pago: 'efectivo',
      pagado: false
    }];
  }

  dividirEnPartesIguales(): void {
    this.modoDivision = 'partes_iguales';
    const n = Math.max(2, this.partesIguales);
    const subtotalParte = this.subtotalOrden / n;
    const impuestoParte = this.impuestoOrden / n;
    const propinaParte = this.propinaGlobal / n;

    this.cuentas = Array.from({ length: n }, (_, i) => ({
      numero: i + 1,
      items: this.itemsActivos as OrderItemWithMenuItem[],
      subtotal: Math.round(subtotalParte * 100) / 100,
      propina: Math.round(propinaParte * 100) / 100,
      total: Math.round((subtotalParte + impuestoParte + propinaParte) * 100) / 100,
      forma_pago: 'efectivo' as FormaPago,
      pagado: false
    }));

    this.ajustarRedondeo();
  }

  dividirPorComensal(): void {
    this.modoDivision = 'por_comensal';
    const comensales = this.orden?.cantidad_comensales || 1;

    // Items asignados a cada comensal
    const itemsPorComensal: Record<number, OrderItemWithMenuItem[]> = {};
    for (let i = 1; i <= comensales; i++) itemsPorComensal[i] = [];

    for (const item of this.itemsActivos as OrderItemWithMenuItem[]) {
      const num = item.comensal_asignado || 1;
      if (!itemsPorComensal[num]) itemsPorComensal[num] = [];
      itemsPorComensal[num].push(item);
    }

    const propinaParte = this.propinaGlobal / comensales;

    this.cuentas = Array.from({ length: comensales }, (_, i) => {
      const items = itemsPorComensal[i + 1] || [];
      const subtotal = items.reduce((acc, it) => acc + it.subtotal, 0);
      const impuesto = Math.round(subtotal * 0.18 * 100) / 100;
      const propina = Math.round(propinaParte * 100) / 100;
      return {
        numero: i + 1,
        items,
        subtotal,
        propina,
        total: subtotal + impuesto + propina,
        forma_pago: 'efectivo' as FormaPago,
        pagado: false
      };
    });
  }

  aplicarPropinaPct(pct: 10 | 15 | 18 | 0): void {
    this.propinaOpcion = pct;
    this.propinaGlobal = pct > 0
      ? Math.round(this.subtotalOrden * (pct / 100) * 100) / 100
      : 0;

    if (this.modoDivision === 'partes_iguales') this.dividirEnPartesIguales();
    else if (this.modoDivision === 'por_comensal') this.dividirPorComensal();
    else {
      this.cuentas[0].propina = this.propinaGlobal;
      this.cuentas[0].total = this.totalOrden + this.propinaGlobal;
    }
  }

  // Ajusta diferencias por redondeo en la última cuenta
  private ajustarRedondeo(): void {
    if (this.cuentas.length < 2) return;
    const sumaTotal = this.cuentas.reduce((acc, c) => acc + c.total, 0);
    const diff = Math.round((this.totalOrden + this.propinaGlobal - sumaTotal) * 100) / 100;
    if (diff !== 0) this.cuentas[this.cuentas.length - 1].total += diff;
  }

  // ============================================================
  // PROCESAMIENTO DE PAGOS
  // ============================================================

  async procesarPago(cuenta: CuentaComensal): Promise<void> {
    if (!this.orden) return;

    try {
      const negocioId = localStorage.getItem('logos_negocio_id') || '';

      await this.supabaseService.client
        .from('restaurant_order_payments')
        .insert({
          order_id: this.orden.id,
          negocio_id: negocioId,
          monto: cuenta.total,
          forma_pago: cuenta.forma_pago,
          comensal_numero: this.modoDivision === 'individual' ? null : cuenta.numero,
          propina_incluida: cuenta.propina,
          pagado: true
        });

      cuenta.pagado = true;
      this.cdr.detectChanges();

      // Si todas las cuentas están pagadas, cerrar la orden
      if (this.cuentas.every(c => c.pagado)) {
        await this.ordersService.cerrarOrden(this.orden.id);
        Swal.fire({
          icon: 'success',
          title: '¡Orden pagada!',
          text: 'La mesa ha sido liberada.',
          timer: 2000,
          showConfirmButton: false
        }).then(() => this.ordenPagada.emit());
      }
    } catch (e: any) {
      Swal.fire('Error al procesar pago', e.message, 'error');
    }
  }

  async procesarTodosLosPagos(): Promise<void> {
    const { isConfirmed } = await Swal.fire({
      title: '¿Confirmar todos los pagos?',
      html: `Total a cobrar: <strong>RD$ ${this.totalConPropina.toFixed(2)}</strong>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar'
    });
    if (!isConfirmed) return;

    this.procesando = true;
    try {
      for (const cuenta of this.cuentas.filter(c => !c.pagado)) {
        await this.procesarPago(cuenta);
      }
    } finally {
      this.procesando = false;
    }
  }

  // ============================================================
  // GETTERS
  // ============================================================

  get itemsActivos(): any[] {
    return (this.orden?.items || []).filter(i => i.estado !== 'cancelado');
  }

  get subtotalOrden(): number { return this.orden?.subtotal || 0; }
  get impuestoOrden(): number { return this.orden?.impuesto || 0; }
  get descuentoOrden(): number { return this.orden?.descuento || 0; }
  get totalOrden(): number { return this.orden?.total || 0; }
  get totalConPropina(): number { return this.totalOrden + this.propinaGlobal; }

  get sumaCuentas(): number {
    return this.cuentas.reduce((acc, c) => acc + c.total, 0);
  }

  get diferencia(): number {
    return Math.round((this.totalConPropina - this.sumaCuentas) * 100) / 100;
  }

  get todasPagadas(): boolean { return this.cuentas.every(c => c.pagado); }

  get comensalesRange(): number[] {
    return Array.from({ length: this.orden?.cantidad_comensales || 1 }, (_, i) => i + 1);
  }

  trackByCuenta(_: number, c: CuentaComensal): number { return c.numero; }
  trackByItem(_: number, i: any): string { return i.id; }

  formatModificadores(modificadores: any[]): string {
    if (!modificadores || !modificadores.length) return '';
    return modificadores.map(m => m.nombre).join(', ');
  }
}
