import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { PedidosMesaService } from '../../../services/pedidos-mesa.service';
import { MesasService } from '../../../services/mesas.service';
import { SupabaseService } from '../../../services/supabase.service';
import { VentasService } from '../../../services/ventas.service';
import { ProductosService } from '../../../services/productos.service';
import { ClientesService } from '../../../services/clientes.service';
import { CuentasCobrarService } from '../../../services/cuentas-cobrar.service';
import { ItemCarrito, CrearVenta, METODOS_PAGO } from '../../../models/ventas.model';
import { Productos } from '../../../models/productos.model';
import { Cliente } from '../../../models/clientes.model';
import { CrearCuentaPorCobrar } from '../../../models/cuentas-cobrar.model';
import { CategoriasService } from '../../../services/categorias.service';
import { Categoria } from '../../../models/categorias.model';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { SidebarService } from '../../../services/sidebar.service';
import { FiscalService } from '../../../services/fiscal.service';
import { ConfiguracionFiscal, TIPOS_COMPROBANTE } from '../../../models/fiscal.model';
import { ModalPagoComponent } from '../modal.pago/modal.pago';
import { FacturaComponent } from '../../../shared/factura/factura.component';
import { VentaCompleta } from '../../../models/ventas.model';
import { CajaService } from '../../../services/caja.service';
import { Caja } from '../../../models/caja.model';

@Component({
  selector: 'app-pos',
  standalone: true, // Asegurar que sea standalone si no lo era (aunque parece que sí)
  imports: [CommonModule, FormsModule, ModalPagoComponent, FacturaComponent],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.css'
})
export class PosComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  private sidebarWasExpanded = false; // Estado previo del sidebar
  public isSidebarCollapsed = false; // Estado actual para la vista

  // Datos
  productos: Productos[] = [];
  clientes: Cliente[] = [];
  carrito: ItemCarrito[] = [];

  // Búsqueda con autocompletado
  busquedaProducto: string = '';
  productosFiltrados: Productos[] = [];
  mostrarAutocomplete: boolean = false;
  selectedAutocompleteIndex: number = 0;

  // Categorías y filtros
  categoriaSeleccionada: string = 'all';
  categorias: any[] = [
    { id: 'all', nombre: 'Todos', icono: 'fa-solid fa-layer-group', color: '#2563eb' }
  ];

  // Cliente seleccionado
  clienteSeleccionado?: Cliente;

  // Totales
  subtotal: number = 0;
  descuentoTotal: number = 0;
  impuesto: number = 0;
  total: number = 0;

  // Caja actual
  cajaActual: Caja | null = null;

  // Pago
  metodoPago: 'efectivo' | 'tarjeta' | 'credito' | 'mixto' = 'efectivo';
  montoEfectivo: number = 0;
  montoTarjeta: number = 0;
  cambio: number = 0;
  metodosPago = METODOS_PAGO.map(m => ({ valor: m.valor as 'efectivo' | 'tarjeta' | 'credito' | 'mixto', etiqueta: m.etiqueta, icono: m.icono }));

  // UI
  mostrarPago: boolean = false;
  mostrarDescuento?: number; // ID del producto para mostrar descuento
  cargando: boolean = true;
  mostrarFactura: boolean = false;
  ventaParaFactura?: VentaCompleta;

  // Fiscal
  configFiscal: ConfiguracionFiscal | null = null;
  tipoComprobante: string = 'B02'; // Consumidor Final por defecto
  rncCliente: string = '';
  tiposComprobante = TIPOS_COMPROBANTE;

  // Subscriptions
  private subscriptions: Subscription[] = [];

  constructor(
    private ventasService: VentasService,
    private productosService: ProductosService,
    private clientesService: ClientesService,
    private cuentasCobrarService: CuentasCobrarService,
    private sidebarService: SidebarService,
    private fiscalService: FiscalService,
    private cajaService: CajaService,
    private categoriasService: CategoriasService,
    private pedidosMesaService: PedidosMesaService, // Inyectar PedidosMesa
    private mesasService: MesasService, // Inyectar MesasService
    private supabaseService: SupabaseService, // Inyectar Supabase
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute // Inyectar ActivatedRoute
  ) { }

  // Contexto de Billar
  mesaId?: number;
  pedidoId?: number;
  mesaActual?: any;
  mostrarDropdownMesa: boolean = false;
  itemsEliminadosDb: number[] = []; // IDs de detalles_mesa a eliminar en DB
  detallesOriginalesDb: any[] = []; // Copia para comparar cambios

  async ngOnInit() {
    // 0. Suscribirse al estado del sidebar
    this.subscriptions.push(
      this.sidebarService.isCollapsed$.subscribe(
        collapsed => this.isSidebarCollapsed = collapsed
      )
    );

    // Verificar estado actual del sidebar y colapsar solo si está expandido
    if (!this.sidebarService.getCollapsed()) {
      this.sidebarWasExpanded = true;
      this.sidebarService.setCollapsed(true, false); // Colapsar temporalmente sin persistir
    }

    // PRIMERO: Suscribirse a los observables
    const productosSub = this.productosService.productos$.subscribe(productos => {
      this.productos = productos;
      this.productosFiltrados = productos;
      this.cdr.detectChanges();
    });

    const clientesSub = this.clientesService.clientes$.subscribe(clientes => {
      this.clientes = clientes;
      this.cdr.detectChanges();
    });

    const fiscalSub = this.fiscalService.config$.subscribe(config => {
      this.configFiscal = config;
      // Resetear a B02 si cambia la config o inicia
      if (config?.modo_fiscal) {
        this.tipoComprobante = 'B02';
      }
    });

    const cajaSub = this.cajaService.cajaActual$.subscribe(caja => {
      this.cajaActual = caja;
      this.cdr.detectChanges();
    });

    const categoriasSub = this.categoriasService.categorias$.subscribe(cats => {
      this.categorias = [
        { id: 'all', nombre: 'Todos', icono: 'fa-solid fa-layer-group', color: '#2563eb' },
        ...cats.map(c => ({
          id: c.nombre, // Usamos el nombre para filtrar ya que ProductosService aplanó el nombre
          nombre: c.nombre,
          icono: this.obtenerIconoPorDefecto(c.nombre),
          color: c.color || '#6b7280'
        }))
      ];
      this.cdr.detectChanges();
    });

    const mesaActivaSub = this.pedidosMesaService.pedidosActivos$.subscribe(pedidos => {
      this.pedidosActivos = pedidos;
      this.cdr.detectChanges();
    });

    this.subscriptions.push(productosSub, clientesSub, fiscalSub, cajaSub, categoriasSub, mesaActivaSub);

    // Recargar productos cuando se navega al POS (sin limpiar el carrito de mesa)
    const navSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(async (event: any) => {
        if (event.url.includes('/ventas/nueva')) {
          await this.cargarDatos();
        }
      });

    this.subscriptions.push(navSub);

    // PRIMERO: Cargar datos del POS (productos, clientes, caja)
    await this.cargarDatos();
    await this.verificarCaja();

    // DESPUÉS de cargar datos, leer los query params y cargar el contexto de mesa
    // Usar una Promise para leer los params una sola vez, en lugar de subscribe
    // (evita race condition donde queryParams dispara antes de que los datos estén listos)
    const params = await new Promise<any>(resolve => {
      const sub = this.route.queryParams.subscribe(p => {
        resolve(p);
        setTimeout(() => sub.unsubscribe(), 0);
      });
    });

    const mesaId = Number(params['mesaId']);
    const pedidoId = Number(params['pedidoId']);

    if (mesaId && pedidoId) {
      console.log(`🎯 [POS] Detectado contexto de mesa: ${mesaId}, pedido: ${pedidoId}`);
      this.mesaId = mesaId;
      this.pedidoId = pedidoId;
      await this.cargarContextoMesa(); // Ahora SÍ es awaited
    } else if (mesaId) {
      this.mesaId = mesaId;
      this.pedidoId = undefined;
      this.limpiarContextoMesa();
    } else {
      this.limpiarContextoMesa();
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    // Restaurar sidebar solo si lo colapsamos nosotros
    if (this.sidebarWasExpanded) {
      this.sidebarService.setCollapsed(false, false);
    }
  }

  toggleSidebar() {
    this.sidebarService.toggleSidebar();
  }

  // Listener global para cerrar autocomplete al hacer click fuera
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.search-box')) {
      this.mostrarAutocomplete = false;
    }
    // Cerrar dropdown de mesa si se hace click fuera
    if (!target.closest('.dropdown-context')) {
      this.mostrarDropdownMesa = false;
    }
  }

  // Listener global para atajos de teclado
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    // F5 = Focus en búsqueda
    if (event.key === 'F5') {
      event.preventDefault();
      this.focusBusqueda();
    }

    // F12 = Procesar pago
    if (event.key === 'F12' && this.carrito.length > 0) {
      event.preventDefault();
      this.mostrarPago = true;
    }

    // F9 = Limpiar carrito
    if (event.key === 'F9' && this.carrito.length > 0) {
      event.preventDefault();
      this.limpiarCarrito();
    }

    // ESC = Cerrar modal de pago
    if (event.key === 'Escape' && this.mostrarPago) {
      event.preventDefault();
      this.cerrarModalPago();
    }
  }

  async cargarDatos() {
    this.cargando = true;
    try {
      // Cargar productos y clientes en paralelo
      await Promise.all([
        this.productosService.cargarProductos(),
        this.clientesService.cargarClientes()
      ]);

    } catch (error) {
      console.error('❌ Error al cargar datos del POS:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async verificarCaja() {
    const caja = await this.cajaService.verificarCajaAbierta();
    if (!caja) {
      await Swal.fire({
        title: '¡Caja Requerida!',
        text: 'No tienes una caja abierta. Para realizar ventas, primero debes realizar la apertura de tu caja.',
        icon: 'warning',
        confirmButtonText: 'Ir a Apertura de Caja',
        confirmButtonColor: '#2563eb',
        allowOutsideClick: false,
        allowEscapeKey: false
      });
      this.router.navigate(['/caja/apertura']);
    }
  }

  // Búsqueda y filtrado de productos
  seleccionarCategoria(categoriaId: string) {
    this.categoriaSeleccionada = categoriaId;
    this.filtrarProductos();
  }

  buscarProducto() {
    this.filtrarProductos();
  }

  filtrarProductos() {
    let filtrados = this.productos;

    // 1. Filtrar por categoría
    if (this.categoriaSeleccionada !== 'all') {
      filtrados = filtrados.filter(p => p.categoria === this.categoriaSeleccionada);
    }

    // 2. Filtrar por texto de búsqueda
    if (this.busquedaProducto.trim()) {
      const busqueda = this.busquedaProducto.toLowerCase();
      filtrados = filtrados.filter(p =>
        p.nombre.toLowerCase().includes(busqueda) ||
        p.sku?.toLowerCase().includes(busqueda) ||
        p.codigo_barras?.toLowerCase().includes(busqueda)
      );

      this.mostrarAutocomplete = true;
    } else {
      this.mostrarAutocomplete = false;
    }

    this.productosFiltrados = filtrados;
    this.selectedAutocompleteIndex = 0;
    this.cdr.detectChanges();
  }

  // Manejar teclas en búsqueda
  handleSearchKeydown(event: KeyboardEvent) {
    if (!this.mostrarAutocomplete || this.productosFiltrados.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedAutocompleteIndex = Math.min(
          this.selectedAutocompleteIndex + 1,
          Math.min(this.productosFiltrados.length - 1, 7)
        );
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedAutocompleteIndex = Math.max(this.selectedAutocompleteIndex - 1, 0);
        break;

      case 'Enter':
        event.preventDefault();
        if (this.productosFiltrados[this.selectedAutocompleteIndex]) {
          this.agregarAlCarrito(this.productosFiltrados[this.selectedAutocompleteIndex]);
          this.limpiarBusqueda();
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.limpiarBusqueda();
        break;
    }
  }

  // Limpiar búsqueda
  limpiarBusqueda() {
    this.busquedaProducto = '';
    this.productosFiltrados = [];
    this.mostrarAutocomplete = false;
    this.selectedAutocompleteIndex = 0;
  }

  // Focus en búsqueda
  focusBusqueda() {
    if (this.searchInput) {
      this.searchInput.nativeElement.focus();
      this.searchInput.nativeElement.select();
    }
  }

  // Agregar producto al carrito
  async agregarAlCarrito(producto: Productos) {
    // Verificar si ya está en el carrito
    const itemExistente = this.carrito.find(item => item.producto_id === producto.id);

    if (itemExistente) {
      // Verificar stock disponible
      if (itemExistente.cantidad < producto.stock) {
        itemExistente.cantidad++;
        this.calcularSubtotalItem(itemExistente);
      } else {
        await Swal.fire({
          title: 'Stock Insuficiente',
          text: 'No hay suficiente stock disponible',
          icon: 'warning',
          confirmButtonText: 'Aceptar'
        });
      }
    } else {
      // Agregar nuevo item
      if (producto.stock > 0) {
        const nuevoItem: ItemCarrito = {
          producto_id: producto.id!,
          producto_nombre: producto.nombre,
          precio_unitario: producto.precio_venta,
          cantidad: 1,
          descuento: 0,
          subtotal: producto.precio_venta,
          stock_disponible: producto.stock,
          categoria: producto.categoria,
          imagen_url: producto.imagen_url
        };
        this.carrito.push(nuevoItem);
      } else {
        await Swal.fire({
          title: 'Sin Stock',
          text: 'Producto sin stock',
          icon: 'warning',
          confirmButtonText: 'Aceptar'
        });
      }
    }

    this.calcularTotales();
    this.limpiarBusqueda(); // Limpiar búsqueda después de agregar
  }

  // Calcular subtotal de un item
  calcularSubtotalItem(item: ItemCarrito) {
    item.subtotal = (item.precio_unitario * item.cantidad) - item.descuento;
  }

  // Actualizar cantidad de un item
  async actualizarCantidad(item: ItemCarrito, cantidad: number) {
    if (cantidad <= 0) {
      this.eliminarDelCarrito(item);
      return;
    }

    if (cantidad > item.stock_disponible) {
      await Swal.fire({
        title: 'Stock Insuficiente',
        text: 'No hay suficiente stock disponible',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    item.cantidad = cantidad;
    this.calcularSubtotalItem(item);
    this.calcularTotales();
  }

  // Aplicar descuento a un item
  aplicarDescuentoItem(item: ItemCarrito, descuento: number) {
    if (descuento < 0) descuento = 0;
    if (descuento > item.precio_unitario * item.cantidad) {
      descuento = item.precio_unitario * item.cantidad;
    }

    item.descuento = descuento;
    this.calcularSubtotalItem(item);
    this.calcularTotales();
  }

  // Eliminar item del carrito
  eliminarDelCarrito(item: ItemCarrito) {
    // Si el item ya existía en la mesa (DB), guardamos su ID para eliminarlo luego
    const itemCasted = item as any;
    if (itemCasted.esPedidoExistente && itemCasted.id_detalle_db) {
      this.itemsEliminadosDb.push(itemCasted.id_detalle_db);
    }

    const index = this.carrito.indexOf(item);
    if (index > -1) {
      this.carrito.splice(index, 1);
      this.calcularTotales();
    }
  }

  // Limpiar carrito
  async limpiarCarrito() {
    if (this.carrito.length > 0) {
      const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: '¿Deseas limpiar el carrito?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, limpiar',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        this.carrito = [];
        this.calcularTotales();
        this.clienteSeleccionado = undefined;
        this.metodoPago = 'efectivo';
        this.montoEfectivo = 0;
        this.montoTarjeta = 0;
        this.mostrarPago = false;
      }
    }
  }

  // Seleccionar cliente
  seleccionarCliente(cliente: Cliente) {
    this.clienteSeleccionado = cliente;

    // Aplicar descuento del cliente si tiene
    if (cliente.descuento_porcentaje > 0) {
      this.carrito.forEach(item => {
        const descuentoPorcentaje = (item.precio_unitario * item.cantidad * cliente.descuento_porcentaje) / 100;
        item.descuento = descuentoPorcentaje;
        this.calcularSubtotalItem(item);
      });
      this.calcularTotales();
    }
  }

  // Calcular totales
  calcularTotales() {
    this.subtotal = this.carrito.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0);
    this.descuentoTotal = this.carrito.reduce((sum, item) => sum + item.descuento, 0);

    // Calcular impuesto (18% ITBIS en RD, ajusta según tu país)
    const baseImponible = this.subtotal - this.descuentoTotal;

    // Solo calcular impuesto si el modo fiscal está activo
    if (this.configFiscal?.modo_fiscal) {
      this.impuesto = baseImponible * 0.18;
    } else {
      this.impuesto = 0;
    }

    this.total = baseImponible + this.impuesto;

    // Si es pago en efectivo, calcular cambio
    if (this.metodoPago === 'efectivo') {
      this.cambio = this.montoEfectivo - this.total;
    }
  }

  // Evento desde Modal de Pago
  onPagoConfirmado(datos: any) {
    this.metodoPago = datos.metodoPago;
    this.montoEfectivo = datos.montoEfectivo;
    this.montoTarjeta = datos.montoTarjeta;
    this.cambio = datos.cambio;

    this.procesarVenta();
  }

  // Validar pago
  async validarPago(): Promise<boolean> {
    if (!this.cajaActual) {
      await Swal.fire({
        title: 'Caja Cerrada',
        text: 'Debes tener una caja abierta para procesar ventas.',
        icon: 'error',
        confirmButtonText: 'Ir a Caja'
      });
      this.router.navigate(['/caja/apertura']);
      return false;
    }

    if (this.carrito.length === 0) {
      await Swal.fire({
        title: 'Carrito Vacío',
        text: 'El carrito está vacío',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return false;
    }

    if (this.metodoPago === 'credito') {
      if (!this.clienteSeleccionado) {
        await Swal.fire({
          title: 'Cliente Requerido',
          text: 'Debe seleccionar un cliente para venta a crédito',
          icon: 'warning',
          confirmButtonText: 'Aceptar'
        });
        return false;
      }

      // Verificar límite de crédito
      const creditoDisponible = this.clienteSeleccionado.limite_credito - this.clienteSeleccionado.balance_pendiente;
      if (this.total > creditoDisponible) {
        await Swal.fire({
          title: 'Crédito Insuficiente',
          text: `El cliente no tiene suficiente crédito disponible. Disponible: RD${creditoDisponible.toFixed(2)}`,
          icon: 'warning',
          confirmButtonText: 'Aceptar'
        });
        return false;
      }
    }

    return true;
  }

  // Procesar venta
  async procesarVenta() {
    if (!(await this.validarPago())) return;

    // Validación Fiscal
    if (this.configFiscal?.modo_fiscal) {
      if (this.tipoComprobante === 'B01' && !this.rncCliente) {
        // Si es Crédito Fiscal, el RNC es obligatorio
        // Intentar obtener del cliente si no se escribió manualmente
        if (this.clienteSeleccionado?.rnc) {
          this.rncCliente = this.clienteSeleccionado.rnc;
        } else {
          await Swal.fire({
            title: 'RNC Requerido',
            text: 'Para facturas con Crédito Fiscal (B01) debe ingresar el RNC del cliente.',
            icon: 'warning',
            confirmButtonText: 'Aceptar'
          });
          return;
        }
      }
    }

    try {
      // Generar NCF si está activo
      let ncfGenerado = '';
      if (this.configFiscal?.modo_fiscal) {
        try {
          ncfGenerado = await this.fiscalService.generarNCF(this.tipoComprobante);
        } catch (error: any) {
          await Swal.fire({
            title: 'Error Fiscal',
            text: error.message || 'Error al generar NCF. Verifique las secuencias.',
            icon: 'error',
            confirmButtonText: 'Aceptar'
          });
          return;
        }
      }

      const venta: CrearVenta = {
        cliente_id: this.clienteSeleccionado?.id,
        caja_id: this.cajaActual?.id, // Pasar ID de la caja abierta
        subtotal: this.subtotal,
        descuento: this.descuentoTotal,
        impuesto: this.impuesto,
        total: this.total,
        metodo_pago: this.metodoPago,
        monto_efectivo: this.montoEfectivo,
        monto_tarjeta: this.montoTarjeta,
        cambio: this.cambio,
        // Datos Fiscales
        ncf: ncfGenerado,
        tipo_ncf: this.configFiscal?.modo_fiscal ? this.tipoComprobante : undefined,
        rnc_cliente: this.rncCliente || this.clienteSeleccionado?.rnc,
        nombre_cliente_fiscal: this.clienteSeleccionado?.nombre,
        mesa_id: this.mesaId,
        pedido_id: this.pedidoId,

        detalles: this.carrito.map(item => ({
          producto_id: item.producto_id,
          producto_nombre: item.producto_nombre,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          descuento: item.descuento,
          subtotal: item.subtotal,
          notas: item.notas
        }))
      };

      const ventaCreada = await this.ventasService.crearVenta(venta);
      const esOffline = ventaCreada.numero_venta === 'PENDIENTE-OFFLINE';

      if (!esOffline) {
        // Solo intentar cargar factura si estamos online
        const ventaObtenida = await this.ventasService.obtenerVentaCompleta(ventaCreada.id!);
        if (ventaObtenida) {
          this.ventaParaFactura = {
            ...ventaObtenida,
            monto_efectivo: venta.monto_efectivo,
            monto_tarjeta: venta.monto_tarjeta,
            cambio: venta.cambio
          };
          this.mostrarFactura = true;
        }
      }

      // Si es venta de mesa, finalizar el pedido
      if (this.pedidoId && this.mesaId) {
        await this.pedidosMesaService.finalizarPedido(this.pedidoId, this.mesaId);
      }

      // Si es venta a crédito, crear cuenta por cobrar automáticamente
      if (this.metodoPago === 'credito' && this.clienteSeleccionado) {
        await this.crearCuentaPorCobrar(ventaCreada);
      }

      // Mostrar mensaje de éxito con SweetAlert2
      let mensaje = '';
      let titulo = '✅ Venta Completada';

      if (esOffline) {
        titulo = '💾 Venta Guardada Localmente';
        mensaje = `La venta se ha guardado en la memoria local porque no hay conexión.<br><strong>Se sincronizará automáticamente cuando vuelvas a estar online.</strong>`;
      } else {
        mensaje = `Factura: ${ventaCreada.numero_venta}<br>Total: RD$${this.total.toFixed(2)}`;

        if (this.configFiscal?.modo_fiscal && ncfGenerado) {
          mensaje += `<br><strong>NCF: ${ncfGenerado}</strong>`;
        }

        if (this.metodoPago === 'credito') {
          mensaje += `<br><br>💳 Cuenta por cobrar creada<br>Cliente: ${this.clienteSeleccionado?.nombre}`;
        } else if ((this.metodoPago === 'efectivo' || this.metodoPago === 'mixto') && this.cambio > 0) {
          mensaje += `<br><br>💵 Cambio: RD$${this.cambio.toFixed(2)}`;
        }
      }

      await Swal.fire({
        title: titulo,
        html: mensaje,
        icon: esOffline ? 'info' : 'success',
        confirmButtonText: 'Aceptar'
      });

      // Limpiar todo
      this.carrito = [];
      this.clienteSeleccionado = undefined;
      this.metodoPago = 'efectivo';
      this.montoEfectivo = 0;
      this.montoTarjeta = 0;
      this.cambio = 0;
      this.mostrarPago = false;
      this.rncCliente = ''; // Limpiar RNC
      this.tipoComprobante = 'B02'; // Resetear a consumidor final
      this.mesaId = undefined;
      this.pedidoId = undefined;
      this.mesaActual = undefined;
      this.calcularTotales();

    } catch (error) {
      console.error('Error al procesar venta:', error);
      await Swal.fire({
        title: '❌ Error',
        text: 'Error al procesar la venta. Intenta nuevamente.',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    }
  }

  // Crear cuenta por cobrar para venta a crédito
  private async crearCuentaPorCobrar(venta: any): Promise<void> {
    try {
      if (!this.clienteSeleccionado) return;

      // Calcular fecha de vencimiento (30 días por defecto)
      const fechaVencimiento = new Date();
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

      const cuenta: CrearCuentaPorCobrar = {
        cliente_id: this.clienteSeleccionado.id!,
        venta_id: venta.id,
        concepto: `Venta a crédito - Factura ${venta.numero_venta}`,
        monto_total: this.total,
        monto_pagado: 0,
        monto_pendiente: this.total,
        fecha_venta: new Date().toISOString().split('T')[0],
        fecha_vencimiento: fechaVencimiento.toISOString().split('T')[0],
        estado: 'pendiente',
        notas: `Venta a crédito - Factura ${venta.numero_venta}`
      };

      await this.cuentasCobrarService.crearCuenta(cuenta);

    } catch (error) {
      console.error('💥 Error al crear cuenta por cobrar:', error);
      // No lanzar error para no bloquear la venta
      await Swal.fire({
        title: '⚠️ Advertencia',
        text: 'Venta completada pero hubo un error al crear la cuenta por cobrar. Créala manualmente.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
    }
  }
  // Billar Logic
  pedidosActivos: any[] = [];

  limpiarContextoMesa() {
    this.mesaId = undefined;
    this.pedidoId = undefined;
    this.mesaActual = null;
    this.carrito = [];
    this.calcularTotales();
  }

  obtenerIconoPorDefecto(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('bebida') || n.includes('vino') || n.includes('cerveza')) return 'fa-solid fa-wine-bottle';
    if (n.includes('comida') || n.includes('plato')) return 'fa-solid fa-utensils';
    if (n.includes('snack') || n.includes('picadera')) return 'fa-solid fa-cookie-bite';
    if (n.includes('lacteo') || n.includes('queso')) return 'fa-solid fa-cheese';
    if (n.includes('pan') || n.includes('reposteria')) return 'fa-solid fa-bread-slice';
    if (n.includes('carne')) return 'fa-solid fa-drumstick-bite';
    if (n.includes('fruta') || n.includes('vegetal')) return 'fa-solid fa-apple-whole';
    if (n.includes('aseo') || n.includes('limpieza')) return 'fa-solid fa-broom';
    return 'fa-solid fa-tag'; // Icono por defecto
  }

  async cambiarAMesa(pedido: any) {
    this.mostrarDropdownMesa = false;
    // Actualizar el contexto ANTES de navegar para evitar race conditions
    this.mesaId = pedido.mesa_id;
    this.pedidoId = pedido.id;
    this.itemsEliminadosDb = [];
    // Actualizar la URL para reflejar la mesa activa
    this.router.navigate(['/ventas/nueva'], {
      queryParams: { mesaId: pedido.mesa_id, pedidoId: pedido.id },
      replaceUrl: true
    });
    // Cargar el contexto de la nueva mesa con await
    await this.cargarContextoMesa();
  }

  irANuevaVenta() {
    this.mostrarDropdownMesa = false;
    this.router.navigate(['/ventas/nueva']);
  }

  toggleDropdownMesa(event: Event) {
    event.stopPropagation();
    this.mostrarDropdownMesa = !this.mostrarDropdownMesa;
  }

  // Billar Logic
  async cargarContextoMesa() {
    if (!this.mesaId) return;

    try {
      this.cargando = true;
      this.itemsEliminadosDb = []; // Resetear lista de eliminados

      const { data: mesa } = await this.supabaseService.client
        .from('mesas')
        .select('*')
        .eq('id', this.mesaId)
        .single();

      this.mesaActual = mesa;

      if (this.pedidoId) {
        console.log('📖 [POS] Cargando detalles del pedido:', this.pedidoId);
        const { data: detalles, error } = await this.supabaseService.client
          .from('pedidos_mesa_detalle')
          .select(`
            *,
            productos (
              imagen_url
            )
          `)
          .eq('pedido_id', this.pedidoId);

        if (error) throw error;

        this.detallesOriginalesDb = JSON.parse(JSON.stringify(detalles || []));

        // Convertir detalles de mesa a items de carrito
        this.carrito = (detalles || []).map((d: any) => ({
          producto_id: d.producto_id,
          producto_nombre: d.producto_nombre,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          descuento: 0,
          subtotal: d.subtotal,
          stock_disponible: 0,
          esPedidoExistente: true,
          id_detalle_db: d.id,
          notas: d.notas,
          imagen_url: d.productos?.imagen_url,
          categoria: '' // categoria_id en la nueva DB, no se necesita para el carrito
        }));

        console.log(`✅ [POS] Carrito cargado con ${this.carrito.length} items de la mesa`);
        this.calcularTotales();
      }
    } catch (error) {
      console.error('❌ [POS] Error al cargar contexto de mesa:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async actualizarPedidoMesa() {
    if (!this.pedidoId) return;

    try {
      this.cargando = true;
      console.log('🔄 [POS] Iniciando sincronización de mesa...');

      // 1. ELIMINACIONES: Borrar items que estaban en DB pero ya no en carrito
      if (this.itemsEliminadosDb.length > 0) {
        console.log(`🗑️ [POS] Eliminando ${this.itemsEliminadosDb.length} items de la DB`);
        for (const id of this.itemsEliminadosDb) {
          await this.pedidosMesaService.eliminarDetallePedido(id, this.pedidoId);
        }
      }

      // 2. UPDATES E INSERCIONES
      for (const item of this.carrito) {
        const itemCasted = item as any;

        if (itemCasted.esPedidoExistente && itemCasted.id_detalle_db) {
          // UPDATE: Verificamos si cambió cantidad o notas
          const original = this.detallesOriginalesDb.find(d => d.id === itemCasted.id_detalle_db);
          if (original && (original.cantidad !== item.cantidad || original.notas !== item.notas)) {
            console.log(`📝 [POS] Actualizando item existente: ${item.producto_nombre}`);
            await this.pedidosMesaService.actualizarDetallePedido(itemCasted.id_detalle_db, this.pedidoId, {
              cantidad: item.cantidad,
              subtotal: item.subtotal,
              notas: item.notas
            });
          }
        } else {
          // INSERT: Es un item nuevo
          console.log(`🆕 [POS] Insertando nuevo item: ${item.producto_nombre}`);
          await this.pedidosMesaService.agregarDetallePedido({
            pedido_id: this.pedidoId,
            producto_id: item.producto_id,
            producto_nombre: item.producto_nombre,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            subtotal: item.subtotal,
            notas: item.notas
          });
        }
      }

      // Recargar el contexto para limpiar flags y reflejar el estado real del DB
      await this.cargarContextoMesa();

      await Swal.fire({
        title: '✅ Mesa Guardada',
        text: 'La cuenta de la mesa ha sido actualizada. Puedes seguir agregando productos o ir a cobrar.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });

      // NO navegamos a /mesas - el usuario se queda en el POS para continuar

    } catch (error) {
      console.error('❌ [POS] Error al sincronizar mesa:', error);
      Swal.fire('Error', 'Hubo un problema al guardar los cambios en la mesa', 'error');
    } finally {
      this.cargando = false;
    }
  }

  // Formatear moneda
  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(valor);
  }

  // Obtener icono según categoría
  getProductoIcon(categoria: string): string {
    const categoriaLower = categoria?.toLowerCase() || '';

    if (categoriaLower.includes('bebida') || categoriaLower.includes('refresco') || categoriaLower.includes('jugo')) {
      return '🥤';
    }
    if (categoriaLower.includes('snack') || categoriaLower.includes('galleta') || categoriaLower.includes('dulce')) {
      return '🍪';
    }
    if (categoriaLower.includes('lácteo') || categoriaLower.includes('lacteo') || categoriaLower.includes('leche') || categoriaLower.includes('yogurt')) {
      return '🥛';
    }
    if (categoriaLower.includes('pan') || categoriaLower.includes('panadería')) {
      return '🍞';
    }
    if (categoriaLower.includes('carne') || categoriaLower.includes('pollo') || categoriaLower.includes('res')) {
      return '🍖';
    }
    if (categoriaLower.includes('fruta') || categoriaLower.includes('verdura') || categoriaLower.includes('vegetal')) {
      return '🍎';
    }
    if (categoriaLower.includes('limpieza') || categoriaLower.includes('aseo')) {
      return '🧹';
    }
    if (categoriaLower.includes('higiene') || categoriaLower.includes('personal')) {
      return '🧴';
    }

    return '📦'; // Icono por defecto
  }

  // Cerrar modal de pago
  cerrarModalPago() {
    this.mostrarPago = false;
  }
}
