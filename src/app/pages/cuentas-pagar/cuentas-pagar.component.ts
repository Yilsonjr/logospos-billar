import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { CuentasPagarService } from '../../services/cuentas-pagar.service';
import { AuthService } from '../../services/auth.service';
import {
  CuentaPorPagar,
  ResumenCuentasPagar,
  FiltrosCuentasPagar,
  ESTADOS_CUENTA_PAGAR,
  PRIORIDADES_PAGO,
  CATEGORIAS_CUENTA_PAGAR
} from '../../models/cuentas-pagar.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-cuentas-pagar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cuentas-pagar.component.html',
  styleUrls: ['./cuentas-pagar.component.css']
})
export class CuentasPagarComponent implements OnInit, OnDestroy {
  cuentas: CuentaPorPagar[] = [];
  cuentasFiltradas: CuentaPorPagar[] = [];
  resumen: ResumenCuentasPagar = {
    total_cuentas: 0,
    total_pendiente: 0,
    total_vencidas: 0,
    total_parciales: 0,
    total_pagadas: 0,
    monto_total_pendiente: 0,
    monto_total_vencido: 0,
    proximos_vencimientos: []
  };

  // Filtros
  filtros: FiltrosCuentasPagar = {};
  filtroTexto = '';

  // Estados y opciones
  estados = ESTADOS_CUENTA_PAGAR;
  prioridades = PRIORIDADES_PAGO;
  categorias = CATEGORIAS_CUENTA_PAGAR;

  // UI
  vistaActual: 'tarjetas' | 'tabla' = 'tarjetas';
  isLoading = false;
  menuAbiertoId: number | null = null;
  subscriptions: Subscription[] = [];

  constructor(
    private cuentasPagarService: CuentasPagarService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    // Verificar permisos
    if (!this.authService.tienePermiso('cuentas.ver')) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Suscribirse a los datos
    const cuentasSub = this.cuentasPagarService.cuentas$.subscribe(cuentas => {
      this.cuentas = cuentas;
      this.aplicarFiltros();
      this.cdr.detectChanges();
    });
    this.subscriptions.push(cuentasSub);

    // Suscribirse al resumen
    const resumenSub = this.cuentasPagarService.resumen$.subscribe(resumen => {
      this.resumen = resumen;
      this.cdr.detectChanges();
    });
    this.subscriptions.push(resumenSub);

    // Escuchar cambios de navegación para recargar si es necesario
    const navSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.router.url === '/cuentas-pagar') {
          this.cargarDatos();
        }
      });
    this.subscriptions.push(navSub);

    // Primera carga
    this.cargarDatos();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async cargarDatos() {
    if (this.isLoading) return; // Evitar múltiples cargas simultáneas

    this.isLoading = true;
    this.cdr.detectChanges();

    try {
      console.log('📦 CuentasPagar: Solicitando carga de datos...');
      await this.cuentasPagarService.cargarCuentas(this.filtros);
      console.log('📦 CuentasPagar: Datos cargados correctamente');
    } catch (error) {
      console.error('📦 CuentasPagar: Error en carga:', error);
      Swal.fire({
        title: '❌ Error',
        text: 'No se pudieron cargar las deudas pendientes',
        icon: 'error'
      });
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();

      // Un pequeño delay de seguridad para asegurar que el resumen también se haya actualizado
      setTimeout(() => this.cdr.detectChanges(), 100);
    }
  }

  aplicarFiltros() {
    let filtradas = [...this.cuentas];

    // Filtro por texto
    if (this.filtroTexto.trim()) {
      const texto = this.filtroTexto.toLowerCase();
      filtradas = filtradas.filter(cuenta =>
        (cuenta.proveedor_nombre || '').toLowerCase().includes(texto) ||
        (cuenta.concepto || '').toLowerCase().includes(texto) ||
        (cuenta.numero_factura || '').toLowerCase().includes(texto) ||
        (cuenta.categoria || '').toLowerCase().includes(texto)
      );
    }

    this.cuentasFiltradas = filtradas;
    this.menuAbiertoId = null; // Cerrar menús al filtrar
  }

  // ==================== DROPDOWN MANUAL ====================

  toggleMenu(event: Event, id: number) {
    event.stopPropagation();
    if (this.menuAbiertoId === id) {
      this.menuAbiertoId = null;
    } else {
      this.menuAbiertoId = id;
    }
  }

  @HostListener('document:click')
  cerrarMenus() {
    this.menuAbiertoId = null;
  }

  aplicarFiltrosAvanzados() {
    this.cargarDatos();
  }

  limpiarFiltros() {
    this.filtros = {};
    this.filtroTexto = '';
    this.cargarDatos();
  }

  // ==================== ACCIONES ====================

  async marcarComoPagada(cuenta: CuentaPorPagar) {
    if (!this.authService.tienePermiso('cuentas.pagos')) {
      Swal.fire({
        title: '🚫 Sin Permisos',
        text: 'No tienes permisos para registrar pagos',
        icon: 'error'
      });
      return;
    }

    const result = await Swal.fire({
      title: '💰 Marcar como Pagada',
      html: `
        <div class="text-left">
          <p class="mb-3"><strong>Cuenta:</strong> ${cuenta.concepto}</p>
          <p class="mb-3"><strong>Proveedor:</strong> ${cuenta.proveedor_nombre}</p>
          <p class="mb-3"><strong>Monto Pendiente:</strong> $${cuenta.monto_pendiente.toLocaleString()}</p>
          <p class="text-sm text-gray-600">¿Confirmas que esta cuenta ha sido pagada completamente?</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Marcar como Pagada',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981'
    });

    if (result.isConfirmed) {
      try {
        // Registrar pago por el monto pendiente
        await this.cuentasPagarService.registrarPago({
          cuenta_id: cuenta.id!,
          monto: cuenta.monto_pendiente,
          metodo_pago: 'Efectivo',
          fecha_pago: new Date().toISOString().split('T')[0],
          notas: 'Pago completo registrado desde interfaz'
        });

        Swal.fire({
          title: '✅ Cuenta Pagada',
          text: 'La cuenta ha sido marcada como pagada',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });

      } catch (error) {
        console.error('Error al marcar como pagada:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'Error al marcar la cuenta como pagada',
          icon: 'error'
        });
      }
    }
  }

  verDetalles(cuenta: CuentaPorPagar) {
    this.router.navigate(['/cuentas-pagar/detalle', cuenta.id]);
  }

  editarCuenta(cuenta: CuentaPorPagar) {
    if (!this.authService.tienePermiso('cuentas.editar')) {
      Swal.fire({
        title: '🚫 Sin Permisos',
        text: 'No tienes permisos para editar cuentas',
        icon: 'error'
      });
      return;
    }

    this.router.navigate(['/cuentas-pagar/editar', cuenta.id]);
  }

  async eliminarCuenta(cuenta: CuentaPorPagar) {
    if (!this.authService.tienePermiso('cuentas.eliminar')) {
      Swal.fire({
        title: '🚫 Sin Permisos',
        text: 'No tienes permisos para eliminar cuentas',
        icon: 'error'
      });
      return;
    }

    const result = await Swal.fire({
      title: '⚠️ Eliminar Cuenta',
      html: `
        <div class="text-left">
          <p class="mb-3">¿Estás seguro de eliminar esta cuenta por pagar?</p>
          <p class="mb-2"><strong>Concepto:</strong> ${cuenta.concepto}</p>
          <p class="mb-2"><strong>Proveedor:</strong> ${cuenta.proveedor_nombre}</p>
          <p class="mb-3"><strong>Monto:</strong> $${cuenta.monto_total.toLocaleString()}</p>
          <p class="text-sm text-red-600">Esta acción no se puede deshacer.</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    });

    if (result.isConfirmed) {
      try {
        await this.cuentasPagarService.eliminarCuenta(cuenta.id!);

        Swal.fire({
          title: '✅ Cuenta Eliminada',
          text: 'La cuenta por pagar ha sido eliminada',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });

      } catch (error) {
        console.error('Error al eliminar cuenta:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'Error al eliminar la cuenta',
          icon: 'error'
        });
      }
    }
  }

  // ==================== NAVEGACIÓN ====================

  irANuevaCuenta() {
    if (!this.authService.tienePermiso('cuentas.crear')) {
      Swal.fire({
        title: '🚫 Sin Permisos',
        text: 'No tienes permisos para crear cuentas',
        icon: 'error'
      });
      return;
    }

    this.router.navigate(['/cuentas-pagar/nueva']);
  }

  irAPlanPagos() {
    this.router.navigate(['/cuentas-pagar/plan-pagos']);
  }

  irAEstadisticas() {
    this.router.navigate(['/cuentas-pagar/estadisticas']);
  }

  // ==================== UTILIDADES ====================

  obtenerClaseEstado(estado: string): string {
    const base = 'badge rounded-pill ';
    switch (estado) {
      case 'pendiente': return base + 'bg-warning text-dark';
      case 'parcial': return base + 'bg-info text-dark';
      case 'pagada': return base + 'bg-success';
      case 'vencida': return base + 'bg-danger';
      default: return base + 'bg-secondary';
    }
  }

  obtenerClasePrioridad(prioridad: string): string {
    const base = 'badge rounded-pill ';
    switch (prioridad) {
      case 'baja': return base + 'bg-secondary';
      case 'media': return base + 'bg-info text-dark';
      case 'alta': return base + 'bg-warning text-dark';
      case 'urgente': return base + 'bg-danger';
      default: return base + 'bg-secondary';
    }
  }

  calcularDiasVencimiento(fechaVencimiento: string): number {
    return this.cuentasPagarService.calcularDiasVencimiento(fechaVencimiento);
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  obtenerTextoVencimiento(cuenta: CuentaPorPagar): string {
    const dias = this.calcularDiasVencimiento(cuenta.fecha_vencimiento);

    if (dias < 0) {
      return `Vencida hace ${Math.abs(dias)} días`;
    } else if (dias === 0) {
      return 'Vence hoy';
    } else if (dias === 1) {
      return 'Vence mañana';
    } else {
      return `Vence en ${dias} días`;
    }
  }

  obtenerClaseVencimiento(cuenta: CuentaPorPagar): string {
    const dias = this.calcularDiasVencimiento(cuenta.fecha_vencimiento);

    if (dias < 0) return 'text-danger fw-bold';
    if (dias <= 3) return 'text-danger fw-semibold';
    if (dias <= 7) return 'text-warning fw-semibold';
    return 'text-muted';
  }

  // Métodos helper para el template
  obtenerEtiquetaEstado(estado: string): string {
    const estadoObj = this.estados.find(e => e.valor === estado);
    return estadoObj?.etiqueta || estado;
  }

  obtenerEtiquetaPrioridad(prioridad: string): string {
    const prioridadObj = this.prioridades.find(p => p.valor === prioridad);
    return prioridadObj?.etiqueta || prioridad;
  }
}