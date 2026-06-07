import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { CajaService } from '../../../services/caja.service';
import { Caja, CrearMovimientoCaja, CONCEPTOS_ENTRADA, CONCEPTOS_SALIDA } from '../../../models/caja.model';
import { PrintService } from '../../../services/print.service';
import { NegociosService } from '../../../services/negocios.service';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-movimiento-caja',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './movimiento-caja.component.html',
  styleUrl: './movimiento-caja.component.css'
})
export class MovimientoCajaComponent implements OnInit, OnDestroy {
  tipo: 'entrada' | 'salida' = 'entrada';
  cajaActual: Caja | null = null;

  monto: number | null = null;
  concepto: string = '';
  metodo: 'efectivo' | 'tarjeta' = 'efectivo';
  referencia: string = '';
  notas: string = '';

  conceptos: readonly string[] = [];
  movimientosRecientes: any[] = [];
  mostrarModal: boolean = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private cajaService: CajaService,
    private printService: PrintService,
    private negociosService: NegociosService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) { }

  // ── Computed ──────────────────────────────────────────────────
  get totalTipo(): number {
    return this.movimientosRecientes
      .filter(m => m.tipo === this.tipo)
      .reduce((s, m) => s + m.monto, 0);
  }

  get ultimoMovimiento(): string {
    const ultimo = this.movimientosRecientes[0];
    if (!ultimo) return '—';
    const fecha = new Date(ultimo.created_at || ultimo.fecha || '');
    return fecha.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
  }

  async ngOnInit() {
    await this.cargarDatos();

    const navSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(async (event: any) => {
      if (event.url.includes('/caja/entrada-efectivo') || event.url.includes('/caja/salida-efectivo')) {
        await this.cargarDatos();
      }
    });

    this.subscriptions.push(navSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async cargarDatos() {
    this.route.url.subscribe(segments => {
      const path = segments[segments.length - 1]?.path;
      this.tipo = path === 'salida-efectivo' ? 'salida' : 'entrada';
      this.conceptos = this.tipo === 'entrada' ? CONCEPTOS_ENTRADA : CONCEPTOS_SALIDA;
    });

    await this.verificarCaja();
    if (this.cajaActual) {
      await this.cargarMovimientosRecientes();
    }

    this.cdr.detectChanges();
  }

  async verificarCaja() {
    this.cajaActual = await this.cajaService.verificarCajaAbierta(true);

    if (!this.cajaActual) {
      await Swal.fire({
        title: 'Sin Caja Abierta',
        text: 'No hay una caja abierta para registrar movimientos',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      this.router.navigate(['/caja/apertura']);
    }

    this.cdr.detectChanges();
  }

  async cargarMovimientosRecientes() {
    if (!this.cajaActual) return;

    try {
      const movimientos = await this.cajaService.obtenerMovimientos(this.cajaActual.id!);
      this.movimientosRecientes = movimientos
        .filter(m => m.tipo === this.tipo)
        .slice(0, 10);

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al cargar movimientos:', error);
    }
  }

  abrirModal() { this.mostrarModal = true; }

  cerrarModal() {
    this.mostrarModal = false;
    this.limpiarFormulario();
    this.cdr.detectChanges();
  }

  async registrarMovimiento() {
    if (!this.cajaActual || !this.monto || this.monto <= 0 || !this.concepto) {
      await Swal.fire({
        title: 'Campos Incompletos',
        text: 'Complete todos los campos requeridos',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    const montoRegistrado   = this.monto;
    const conceptoRegistrado = this.concepto;
    const metodoRegistrado  = this.metodo;
    const referenciaReg     = this.referencia;

    try {
      const usuarioId = this.authService.usuarioActual?.id || 1;
      const conceptoFinal = `${conceptoRegistrado} (${metodoRegistrado.charAt(0).toUpperCase() + metodoRegistrado.slice(1)})`;

      await this.cajaService.registrarMovimiento({
        caja_id:    this.cajaActual.id!,
        tipo:       this.tipo,
        concepto:   conceptoFinal,
        monto:      montoRegistrado,
        referencia: referenciaReg || undefined,
        usuario_id: usuarioId
      } as any);

      this.mostrarModal = false;
      this.limpiarFormulario();
      await this.cargarMovimientosRecientes();
      this.cdr.detectChanges();

      // Imprimir ticket en la impresora de caja
      this.imprimirTicketMovimiento({
        monto:       montoRegistrado,
        concepto:    conceptoFinal,
        metodo:      metodoRegistrado,
        referencia:  referenciaReg,
        tipo:        this.tipo,
        cajero:      this.cajaActual.usuario_apertura,
        caja_id:     this.cajaActual.id!
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      await Swal.fire({
        title: `✅ ${this.tipo === 'entrada' ? 'Entrada' : 'Salida'} Registrada`,
        html: `<b>${this.formatearMoneda(montoRegistrado)}</b><br><small>${conceptoRegistrado}</small>`,
        icon: 'success',
        timer: 2500,
        timerProgressBar: true,
        showConfirmButton: false
      });

    } catch (error) {
      console.error('Error al registrar movimiento:', error);
      this.mostrarModal = false;
      this.cdr.detectChanges();

      await new Promise(resolve => setTimeout(resolve, 100));
      await Swal.fire({
        title: 'Error',
        text: 'Error al registrar el movimiento. Intenta nuevamente.',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    }
  }

  // ── Ticket de impresión ───────────────────────────────────────
  private async imprimirTicketMovimiento(datos: {
    monto: number;
    concepto: string;
    metodo: string;
    referencia: string;
    tipo: 'entrada' | 'salida';
    cajero: string;
    caja_id: number;
  }) {
    try {
      const impreso = await this.printService.imprimirMovimientoCaja(datos);
      if (!impreso) console.warn('[MovimientoCaja] Sin impresora de caja configurada — ticket omitido');
    } catch (err) {
      console.warn('[MovimientoCaja] Error al imprimir ticket:', err);
    }
  }

  limpiarFormulario() {
    this.monto = null;
    this.concepto = '';
    this.referencia = '';
    this.notas = '';
    this.metodo = 'efectivo';
  }

  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(valor);
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-DO', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}
