import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ProductosService } from './productos.service';
import { ClientesService } from './clientes.service';
import { AuthService } from './auth.service'; // Import AuthService
import { CajaService } from './caja.service'; // Import CajaService
import { OfflineService } from './offline.service'; // Import OfflineService
import { Venta, VentaDetalle, CrearVenta, VentaCompleta } from '../models/ventas.model';
import { BehaviorSubject } from 'rxjs';
import { CrearMovimientoCaja } from '../models/caja.model';

@Injectable({
  providedIn: 'root'
})
export class VentasService {
  private ventasSubject = new BehaviorSubject<Venta[]>([]);
  public ventas$ = this.ventasSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private productosService: ProductosService,
    private clientesService: ClientesService,
    private authService: AuthService, // Inject AuthService
    private cajaService: CajaService, // Inject CajaService
    private offlineService: OfflineService // Inject OfflineService
  ) {
    // Carga inicial inmediata para que los reportes se sientan reactivos
    this.cargarVentas().catch(err => console.error('Error in initial cargarVentas:', err));

    // Iniciar escucha para sincronización automática
    this.offlineService.online$.subscribe(isOnline => {
      if (isOnline) {
        this.syncPendientes().catch(err => console.error('Error syncing sales:', err));
      }
    });
  }

  // Sincronizar ventas pendientes del modo offline
  async syncPendientes(): Promise<void> {
    const pendientes = await this.offlineService.obtenerVentasPendientes();
    if (pendientes.length === 0) return;

    console.log(`🔄 Syncing ${pendientes.length} pending sales...`);
    this.offlineService.setSyncing(true);

    for (const venta of pendientes) {
      try {
        await this.syncSale(venta.data);
        await this.offlineService.eliminarVentaPendiente(venta.idLocal!);
        console.log(`✅ Sale sync success: ${venta.idLocal}`);
      } catch (error) {
        console.error(`❌ Sync failed for sale ${venta.idLocal}:`, error);
        // Detener sync si hay error (podría ser problema de datos o red inestable)
        break;
      }
    }

    this.offlineService.setSyncing(false);
    await this.cargarVentas();
  }

  // Método específico para sincronizar una venta (omite chequeo de conexión del interceptor)
  private async syncSale(venta: CrearVenta): Promise<Venta> {
    return this.ejecutarCrearVentaEnSupabase(venta);
  }

  // Generar número de factura
  async generarNumeroFactura(): Promise<string> {
    try {
      const { data, error } = await this.supabaseService.client
        .rpc('generar_numero_factura');

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al generar número de factura:', error);
      // Fallback: generar manualmente
      const fecha = new Date();
      const timestamp = fecha.getTime();
      return `FAC-${fecha.getFullYear()}${(fecha.getMonth() + 1).toString().padStart(2, '0')}${fecha.getDate().toString().padStart(2, '0')}-${timestamp.toString().slice(-4)}`;
    }
  }

  // Crear venta completa (interceptor offline)
  async crearVenta(venta: CrearVenta): Promise<Venta> {
    if (!this.offlineService.isOnline) {
      console.warn('📵 Device is offline. Queueing sale in local Dexie database...');
      await this.offlineService.guardarVentaOffline(venta);
      // Retornar una venta temporal para no romper el flujo del frontend
      return {
        numero_venta: 'PENDIENTE-OFFLINE',
        total: venta.total,
        estado: 'pendiente'
      } as Venta;
    }

    return this.ejecutarCrearVentaEnSupabase(venta);
  }

  // Ejecución real en Supabase (usado por el interceptor y por la sync automática)
  private async ejecutarCrearVentaEnSupabase(venta: CrearVenta): Promise<Venta> {
    try {
      console.log('🔄 Ejecutando venta atómica en Supabase...');

      // Obtener usuario actual
      const usuarioId = this.authService.usuarioActual?.id;
      if (!usuarioId) throw new Error('No hay usuario autenticado');

      const negocioId = this.authService.getNegocioId();

      // Llamada al RPC que maneja toda la transacción en la BD
      const { data, error } = await this.supabaseService.client
        .rpc('crear_venta_completa', {
          p_venta: venta,
          p_usuario_id: usuarioId,
          p_negocio_id: negocioId
        });

      if (error) {
        console.error('❌ Error en RPC crear_venta_completa:', error);
        throw error;
      }

      console.log('✅ Venta procesada atómicamente:', data.numero_venta);

      // --- CORRECCIÓN: Registrar movimiento en caja ---
      if (venta.caja_id) {
        await this.registrarMovimientosVentaCaja(venta, data.id, data.numero_venta);
      }
      
      // Retornar la venta creada
      return {
        id: data.id,
        numero_venta: data.numero_venta,
        total: venta.total,
        estado: 'completada'
      } as Venta;

    } catch (error) {
      console.error('💥 Error al ejecutar venta en Supabase:', error);
      throw error;
    }
  }

  // Actualizar stock del producto (usa 'stock_actual' que es el campo real)
  private async actualizarStockProducto(productoId: number, cantidadVendida: number): Promise<void> {
    try {
      // Obtener stock actual
      const { data: producto, error: errorGet } = await this.supabaseService.client
        .from('productos')
        .select('stock_actual')
        .eq('id', productoId)
        .maybeSingle();

      if (errorGet) throw errorGet;
      if (!producto) {
        console.warn(`⚠️ No se pudo actualizar stock: El producto con ID ${productoId} no existe.`);
        return;
      }

      // Calcular nuevo stock y actualizar
      const nuevoStock = (producto.stock_actual ?? 0) - cantidadVendida;
      const { error: errorUpdate } = await this.supabaseService.client
        .from('productos')
        .update({ stock_actual: nuevoStock })
        .eq('id', productoId);

      if (errorUpdate) throw errorUpdate;
      console.log(`📦 Stock actualizado: producto ${productoId} → ${nuevoStock} unidades`);

    } catch (error) {
      console.error('Error al actualizar stock:', error);
      throw error;
    }
  }

  // Actualizar balance del cliente
  private async actualizarBalanceCliente(clienteId: number, monto: number): Promise<void> {
    try {
      // Obtener balance actual
      const { data: cliente, error: errorGet } = await this.supabaseService.client
        .from('clientes')
        .select('balance_pendiente')
        .eq('id', clienteId)
        .single();

      if (errorGet) throw errorGet;

      // Actualizar balance
      const nuevoBalance = cliente.balance_pendiente + monto;
      const { error: errorUpdate } = await this.supabaseService.client
        .from('clientes')
        .update({ balance_pendiente: nuevoBalance })
        .eq('id', clienteId);

      if (errorUpdate) throw errorUpdate;

    } catch (error) {
      console.error('Error al actualizar balance cliente:', error);
      throw error;
    }
  }

  // Cargar ventas
  async cargarVentas(limite: number = 100): Promise<void> {
    try {
      console.log('🔄 Cargando ventas...');

      const { data, error } = await this.supabaseService.client
        .from('ventas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limite);

      if (error) throw error;

      // Mapear aliases de backward-compat para historial/reportes existentes
      const ventasMapeadas = (data || []).map((v: any) => ({
        ...v,
        numero_factura: v.numero_venta,   // alias → historial/reportes
        fecha: v.created_at,              // alias → historial/reportes
        impuesto: v.impuestos,            // alias → historial/reportes
      }));

      console.log('✅ Ventas cargadas:', ventasMapeadas.length);
      this.ventasSubject.next(ventasMapeadas);

    } catch (error) {
      console.error('💥 Error al cargar ventas:', error);
      throw error;
    }
  }

  // Obtener venta completa con detalles
  async obtenerVentaCompleta(ventaId: number): Promise<VentaCompleta | null> {
    try {
      // Obtener venta
      const { data: venta, error: errorVenta } = await this.supabaseService.client
        .from('ventas')
        .select('*')
        .eq('id', ventaId)
        .single();

      if (errorVenta) throw errorVenta;

      // Obtener detalles
      const { data: detalles, error: errorDetalles } = await this.supabaseService.client
        .from('ventas_detalle')
        .select('*')
        .eq('venta_id', ventaId);

      if (errorDetalles) throw errorDetalles;

      // Obtener nombre del cliente si existe
      let clienteNombre = 'Cliente General';
      if (venta.cliente_id) {
        const { data: cliente } = await this.supabaseService.client
          .from('clientes')
          .select('nombre')
          .eq('id', venta.cliente_id)
          .single();

        if (cliente) clienteNombre = cliente.nombre;
      }

      return {
        ...venta,
        cliente_nombre: clienteNombre,
        detalles: detalles || []
      };

    } catch (error) {
      console.error('Error al obtener venta completa:', error);
      return null;
    }
  }

  // Cancelar venta
  async cancelarVenta(ventaId: number): Promise<void> {
    try {
      console.log('🔄 Cancelando venta ID:', ventaId);

      // Obtener detalles de la venta para revertir stock
      const ventaCompleta = await this.obtenerVentaCompleta(ventaId);
      if (!ventaCompleta) throw new Error('Venta no encontrada');

      // Revertir stock
      for (const detalle of ventaCompleta.detalles) {
        await this.revertirStockProducto(detalle.producto_id, detalle.cantidad);
      }

      // Revertir balance del cliente si fue a crédito
      if (ventaCompleta.metodo_pago === 'credito' && ventaCompleta.cliente_id) {
        await this.revertirBalanceCliente(ventaCompleta.cliente_id, ventaCompleta.total);
      }

      // Actualizar estado de la venta
      const { error } = await this.supabaseService.client
        .from('ventas')
        .update({ estado: 'cancelada' })
        .eq('id', ventaId);

      if (error) throw error;

      // Revertir movimientos en caja
      if (ventaCompleta.caja_id) {
        await this.registrarCancelacionCaja(ventaCompleta);
      }

      console.log('✅ Venta cancelada');
      await this.cargarVentas();

    } catch (error) {
      console.error('💥 Error al cancelar venta:', error);
      throw error;
    }
  }

  // Revertir stock del producto
  private async revertirStockProducto(productoId: number, cantidad: number): Promise<void> {
    try {
      const { data: producto, error: errorGet } = await this.supabaseService.client
        .from('productos')
        .select('stock_actual')
        .eq('id', productoId)
        .maybeSingle(); // Usar maybeSingle por si el producto fue borrado

      if (errorGet) throw errorGet;
      if (!producto) {
        console.warn(`⚠️ No se pudo revertir stock: El producto con ID ${productoId} ya no existe.`);
        return;
      }

      const nuevoStock = (producto.stock_actual || 0) + cantidad;
      const { error: errorUpdate } = await this.supabaseService.client
        .from('productos')
        .update({ stock_actual: nuevoStock })
        .eq('id', productoId);

      if (errorUpdate) throw errorUpdate;

    } catch (error) {
      console.error('Error al revertir stock:', error);
      throw error;
    }
  }

  // Revertir balance del cliente
  private async revertirBalanceCliente(clienteId: number, monto: number): Promise<void> {
    try {
      const { data: cliente, error: errorGet } = await this.supabaseService.client
        .from('clientes')
        .select('balance_pendiente')
        .eq('id', clienteId)
        .single();

      if (errorGet) throw errorGet;

      const nuevoBalance = cliente.balance_pendiente - monto;
      const { error: errorUpdate } = await this.supabaseService.client
        .from('clientes')
        .update({ balance_pendiente: nuevoBalance })
        .eq('id', clienteId);

      if (errorUpdate) throw errorUpdate;

    } catch (error) {
      console.error('Error al revertir balance cliente:', error);
      throw error;
    }
  }

  // Obtener ventas por rango de fechas
  async obtenerVentasPorFecha(fechaInicio: string, fechaFin: string): Promise<Venta[]> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('ventas')
        .select('*')
        .gte('created_at', fechaInicio)
        .lte('created_at', fechaFin)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('Error al obtener ventas por fecha:', error);
      return [];
    }
  }

  // Obtener total de ventas del día
  async obtenerTotalVentasHoy(): Promise<number> {
    try {
      const hoy = new Date().toISOString().split('T')[0];

      const { data, error } = await this.supabaseService.client
        .from('ventas')
        .select('total')
        .gte('created_at', `${hoy}T00:00:00`)
        .lte('created_at', `${hoy}T23:59:59`)
        .eq('estado', 'completada');

      if (error) throw error;

      return data?.reduce((sum, venta) => sum + venta.total, 0) || 0;

    } catch (error) {
      console.error('Error al obtener total ventas hoy:', error);
      return 0;
    }
  }

  // ==================== UTILIDADES PRIVADAS ====================

  private async registrarMovimientosVentaCaja(venta: CrearVenta, ventaId: number, numeroVenta: string): Promise<void> {
    try {
      const usuarioId = this.authService.usuarioActual?.id || 1; // Fallback to id 1 if not found

      if (venta.metodo_pago === 'efectivo' || venta.metodo_pago === 'mixto') {
        const montoEfectivo = venta.metodo_pago === 'efectivo' ? venta.total : (venta.monto_efectivo || 0);
        if (montoEfectivo > 0) {
          await this.cajaService.registrarMovimiento({
            caja_id: venta.caja_id!,
            tipo: 'venta',
            concepto: `Venta ${numeroVenta} (Efectivo)`,
            monto: montoEfectivo,
            referencia: ventaId.toString(),
            usuario_id: usuarioId
          } as any);
        }
      }

      if (venta.metodo_pago === 'tarjeta' || venta.metodo_pago === 'mixto') {
        const montoTarjeta = venta.metodo_pago === 'tarjeta' ? venta.total : (venta.monto_tarjeta || 0);
        if (montoTarjeta > 0) {
          await this.cajaService.registrarMovimiento({
            caja_id: venta.caja_id!,
            tipo: 'venta',
            concepto: `Venta ${numeroVenta} (Tarjeta)`,
            monto: montoTarjeta,
            referencia: ventaId.toString(),
            usuario_id: usuarioId
          } as any);
        }
      }
    } catch (error) {
      console.error('Error al registrar movimientos en caja:', error);
      // No lanzamos el error para no afectar la venta principal
    }
  }

  private async registrarCancelacionCaja(venta: VentaCompleta): Promise<void> {
    try {
      const usuarioId = this.authService.usuarioActual?.id || 1;

      // Si fue efectivo o mixto, registrar salida de lo que entró en efectivo
      if (venta.metodo_pago === 'efectivo' || venta.metodo_pago === 'mixto') {
        const montoEfectivo = venta.metodo_pago === 'efectivo' ? venta.total : (venta.monto_efectivo || 0);
        if (montoEfectivo > 0) {
          await this.cajaService.registrarMovimiento({
            caja_id: venta.caja_id!,
            tipo: 'salida',
            concepto: `Cancelación Venta ${venta.numero_venta} (Efectivo)`,
            monto: montoEfectivo,
            referencia: venta.id!.toString(),
            usuario_id: usuarioId
          } as any);
        }
      }

      // Si fue tarjeta o mixto, registrar salida de lo que entró por tarjeta
      if (venta.metodo_pago === 'tarjeta' || venta.metodo_pago === 'mixto') {
        const montoTarjeta = venta.metodo_pago === 'tarjeta' ? venta.total : (venta.monto_tarjeta || 0);
        if (montoTarjeta > 0) {
          await this.cajaService.registrarMovimiento({
            caja_id: venta.caja_id!,
            tipo: 'salida',
            concepto: `Cancelación Venta ${venta.numero_venta} (Tarjeta)`,
            monto: montoTarjeta,
            referencia: venta.id!.toString(),
            usuario_id: usuarioId
          } as any);
        }
      }
    } catch (error) {
      console.error('Error al registrar cancelación en caja:', error);
    }
  }
}
