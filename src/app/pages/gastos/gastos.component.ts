import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { GastosService } from '../../services/gastos.service';
import { AuthService } from '../../services/auth.service';
import {
  Gasto,
  CrearGasto,
  ResumenGastos,
  FiltrosGastos,
  CATEGORIAS_GASTOS,
  METODOS_PAGO_GASTO
} from '../../models/gastos.model';
import { sdFechaHoy } from '../../utils/fecha-sd';

@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gastos.component.html',
  styleUrls: ['./gastos.component.css']
})
export class GastosComponent implements OnInit, OnDestroy {
  gastos: Gasto[] = [];
  resumen: ResumenGastos = {
    total_hoy: 0,
    total_semana: 0,
    total_mes: 0,
    cantidad_registros: 0,
    por_categoria: []
  };

  categorias = CATEGORIAS_GASTOS;
  metodosPago = METODOS_PAGO_GASTO;

  // Filtros
  filtros: FiltrosGastos = {
    fecha_desde: sdFechaHoy().substring(0, 7) + '-01',
    fecha_hasta: sdFechaHoy()
  };
  busqueda = '';

  // Paginación
  readonly PAGE_SIZE = 25;
  private _pagina = 0;
  get pagina(): number { return this._pagina; }
  get gastosPaginados(): Gasto[] {
    return this.gastos.slice(this._pagina * this.PAGE_SIZE, (this._pagina + 1) * this.PAGE_SIZE);
  }
  get totalPaginas(): number { return Math.ceil(this.gastos.length / this.PAGE_SIZE); }
  cambiarPagina(delta: number): void {
    this._pagina = Math.max(0, Math.min(this.totalPaginas - 1, this._pagina + delta));
  }

  // Formulario
  mostrarFormulario = false;
  guardando = false;
  isLoading = false;
  subcategoriasDisponibles: string[] = [];

  nuevoGasto: CrearGasto = this.gastoVacio();

  private subs: Subscription[] = [];

  constructor(
    private gastosService: GastosService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.gastosService.gastos$.subscribe(g => { this.gastos = g; this._pagina = 0; }),
      this.gastosService.resumen$.subscribe(r => { this.resumen = r; })
    );
    this.cargar();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  async cargar(): Promise<void> {
    this.isLoading = true;
    try {
      await this.gastosService.cargarGastos({
        ...this.filtros,
        busqueda: this.busqueda || undefined
      });
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Error al cargar gastos', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  aplicarFiltros(): void {
    this._pagina = 0;
    this.cargar();
  }

  abrirFormulario(): void {
    this.nuevoGasto = this.gastoVacio();
    this.subcategoriasDisponibles = [];
    this.mostrarFormulario = true;
  }

  cerrarFormulario(): void {
    this.mostrarFormulario = false;
  }

  onCategoriaChange(): void {
    const cat = this.categorias.find(c => c.nombre === this.nuevoGasto.categoria);
    this.subcategoriasDisponibles = cat ? [...cat.subcategorias] : [];
    this.nuevoGasto.subcategoria = '';
  }

  async guardarGasto(): Promise<void> {
    if (!this.nuevoGasto.descripcion || !this.nuevoGasto.monto || !this.nuevoGasto.categoria) {
      Swal.fire('Campos requeridos', 'Completa descripción, categoría y monto.', 'warning');
      return;
    }
    this.guardando = true;
    try {
      await this.gastosService.registrarGasto(this.nuevoGasto);
      this.cerrarFormulario();
      Swal.fire({ icon: 'success', title: 'Gasto registrado', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Error al guardar', 'error');
    } finally {
      this.guardando = false;
    }
  }

  async eliminar(gasto: Gasto): Promise<void> {
    const res = await Swal.fire({
      title: '¿Eliminar gasto?',
      text: `${gasto.descripcion} — RD$${gasto.monto.toLocaleString()}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!res.isConfirmed) return;
    try {
      await this.gastosService.eliminarGasto(gasto.id!);
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Error al eliminar', 'error');
    }
  }

  getMetodoPago(valor: string) {
    return this.metodosPago.find(m => m.valor === valor);
  }

  private gastoVacio(): CrearGasto {
    return {
      categoria: '',
      subcategoria: '',
      descripcion: '',
      proveedor: '',
      numero_comprobante: '',
      monto: 0,
      metodo_pago: 'efectivo',
      fecha: sdFechaHoy()
    };
  }
}
