import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RestaurantOrdersService } from '../../../services/restaurant-orders.service';
import {
  TableWithOrder, MenuCategory, MenuItem, MenuItemModifier,
  CartItem, ModificadorSeleccionado, RestaurantOrder,
  AgregarItemOrden, OrderWithItems
} from '../../../models/restaurant.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-order-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-modal.component.html',
  styleUrl: './order-modal.component.css'
})
export class OrderModalComponent implements OnInit, OnDestroy {

  @Input() mesa!: TableWithOrder;
  @Output() cerrar = new EventEmitter<void>();
  @Output() ordenActualizada = new EventEmitter<void>();

  // Estado
  orden: OrderWithItems | null = null;
  categorias: MenuCategory[] = [];
  categoriaActiva: MenuCategory | null = null;
  itemsCategoria: MenuItem[] = [];
  carrito: CartItem[] = [];

  // Modal interno: detalle de item
  itemSeleccionado: MenuItem | null = null;
  modificadoresSeleccionados: ModificadorSeleccionado[] = [];
  cantidadItem = 1;
  notasItem = '';
  comensalItem: number | null = null;
  cantidadComensales = 1;

  cargando = false;
  enviandoCocina = false;

  constructor(private ordersService: RestaurantOrdersService, private cdr: ChangeDetectorRef) {}

  async ngOnInit(): Promise<void> {
    this.cargando = true;
    try {
      const [orden, categorias] = await Promise.all([
        this.ordersService.obtenerOrdenActivaDeMesa(this.mesa.id),
        this.ordersService.cargarCategorias()
      ]);
      this.orden = orden;
      this.categorias = categorias;
      this.cantidadComensales = orden?.cantidad_comensales || 1;
      if (categorias.length) await this.seleccionarCategoria(categorias[0]);

      if (this.orden) {
        this.ordersService.suscribirOrden(this.orden.id, () => this.refrescarOrden());
      }
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.ordersService.desuscribir();
  }

  async seleccionarCategoria(cat: MenuCategory): Promise<void> {
    this.categoriaActiva = cat;
    this.itemsCategoria = await this.ordersService.cargarItemsPorCategoria(cat.id);
    this.cdr.detectChanges();
  }

  // Abre panel de detalle/selección de un item del menú
  abrirDetalleItem(item: MenuItem): void {
    this.itemSeleccionado = item;
    this.modificadoresSeleccionados = [];
    this.cantidadItem = 1;
    this.notasItem = '';
    this.comensalItem = null;
  }

  toggleModificador(mod: MenuItemModifier): void {
    const idx = this.modificadoresSeleccionados.findIndex(m => m.nombre === mod.nombre);
    if (idx >= 0) {
      this.modificadoresSeleccionados.splice(idx, 1);
    } else {
      this.modificadoresSeleccionados.push({
        nombre: mod.nombre,
        precio_adicional: mod.precio_adicional
      });
    }
  }

  tieneModificador(nombre: string): boolean {
    return this.modificadoresSeleccionados.some(m => m.nombre === nombre);
  }

  agregarAlCarrito(): void {
    if (!this.itemSeleccionado) return;

    const costoMods = this.modificadoresSeleccionados.reduce(
      (acc, m) => acc + m.precio_adicional, 0
    );

    const cartItem: CartItem = {
      menu_item: this.itemSeleccionado,
      cantidad: this.cantidadItem,
      modificadores_seleccionados: [...this.modificadoresSeleccionados],
      notas_especiales: this.notasItem,
      comensal_asignado: this.comensalItem,
      precio_total: (this.itemSeleccionado.precio + costoMods) * this.cantidadItem
    };

    // Intentar agrupar si mismo item y mismos modificadores
    const existente = this.carrito.find(c =>
      c.menu_item.id === cartItem.menu_item.id &&
      JSON.stringify(c.modificadores_seleccionados) === JSON.stringify(cartItem.modificadores_seleccionados) &&
      c.notas_especiales === cartItem.notas_especiales
    );

    if (existente) {
      existente.cantidad += cartItem.cantidad;
      existente.precio_total = (existente.menu_item.precio + costoMods) * existente.cantidad;
    } else {
      this.carrito.push(cartItem);
    }

    this.itemSeleccionado = null;
  }

  quitarDelCarrito(idx: number): void {
    this.carrito.splice(idx, 1);
  }

  // Confirma y persiste los items del carrito en la orden
  async confirmarItems(): Promise<void> {
    if (!this.carrito.length) return;

    try {
      this.cargando = true;

      // Crear orden si no existe
      if (!this.orden) {
        const usuarioData = JSON.parse(localStorage.getItem('logos_usuario') || '{}');
        const meseroId: number = usuarioData.id ?? 0;
        const negocioId = localStorage.getItem('logos_negocio_id') || '';

        this.orden = await this.ordersService.crearOrden({
          negocio_id: negocioId,
          table_id: this.mesa.id,
          mesero_id: meseroId,
          cantidad_comensales: this.cantidadComensales
        }) as any;
      }

      // Insertar items
      for (const item of this.carrito) {
        const payload: AgregarItemOrden = {
          order_id: this.orden!.id,
          menu_item_id: item.menu_item.id,
          cantidad: item.cantidad,
          precio_unitario: item.menu_item.precio,
          modificadores: item.modificadores_seleccionados,
          notas_especiales: item.notas_especiales || undefined,
          comensal_asignado: item.comensal_asignado || undefined
        };
        await this.ordersService.agregarItem(payload);
      }

      this.carrito = [];
      await this.refrescarOrden();
      this.ordenActualizada.emit();
      Swal.fire({ icon: 'success', title: 'Items agregados', timer: 1200, showConfirmButton: false });
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async enviarACocina(): Promise<void> {
    if (!this.orden) return;

    const { isConfirmed } = await Swal.fire({
      title: '¿Enviar a cocina?',
      text: 'Los items pendientes se enviarán a la pantalla de cocina.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Enviar',
      cancelButtonText: 'Cancelar'
    });
    if (!isConfirmed) return;

    try {
      this.enviandoCocina = true;
      await this.ordersService.enviarACocina(this.orden.id);
      await this.refrescarOrden();
      this.ordenActualizada.emit();
      Swal.fire({ icon: 'success', title: '¡Enviado a cocina!', timer: 1500, showConfirmButton: false });
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error');
    } finally {
      this.enviandoCocina = false;
      this.cdr.detectChanges();
    }
  }

  async cancelarItem(itemId: string): Promise<void> {
    await this.ordersService.cancelarItem(itemId);
    await this.refrescarOrden();
  }

  private async refrescarOrden(): Promise<void> {
    if (!this.orden) return;
    this.orden = await this.ordersService.obtenerOrdenPorId(this.orden.id);
    this.cdr.detectChanges();
  }

  // Totales del carrito
  get subtotalCarrito(): number {
    return this.carrito.reduce((acc, i) => acc + i.precio_total, 0);
  }

  // Items de la orden persistidos
  get itemsPersistidos(): any[] {
    return this.orden?.items?.filter(i => i.estado !== 'cancelado') || [];
  }

  get hayItemsPendientes(): boolean {
    return (this.orden?.items || []).some(i => i.estado === 'pendiente');
  }

  get subtotalOrden(): number { return this.orden?.subtotal || 0; }
  get impuestoOrden(): number { return this.orden?.impuesto || 0; }
  get totalOrden(): number    { return this.orden?.total || 0; }

  get comensalesRange(): number[] {
    return Array.from({ length: this.cantidadComensales }, (_, i) => i + 1);
  }

  trackByItem(_: number, i: CartItem): string { return i.menu_item.id; }
  trackByCat(_: number, c: MenuCategory): string { return c.id; }
  trackByMenuItem(_: number, m: MenuItem): string { return m.id; }

  formatModificadores(modificadores: any[]): string {
    if (!modificadores || !modificadores.length) return '';
    return modificadores.map(m => m.nombre).join(', ');
  }
}
