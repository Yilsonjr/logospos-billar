import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import {
  RestaurantInventoryItem, MenuItemRecipe,
  RestaurantInventoryMovement, TipoMovimientoInventario
} from '../models/restaurant.models';

@Injectable({ providedIn: 'root' })
export class InventoryRestaurantService {

  private inventarioSubject = new BehaviorSubject<RestaurantInventoryItem[]>([]);
  public inventario$ = this.inventarioSubject.asObservable();

  constructor(private supabaseService: SupabaseService) {}

  private get negocioId(): string {
    return localStorage.getItem('logos_negocio_id') || '';
  }

  private get usuarioId(): number | null {
    const u = localStorage.getItem('logos_usuario');
    try { return u ? (JSON.parse(u).id ?? null) : null; } catch { return null; }
  }

  // ============================================================
  // INVENTARIO
  // ============================================================

  async cargarInventario(): Promise<RestaurantInventoryItem[]> {
    const { data, error } = await this.supabaseService.client
      .from('restaurant_inventory')
      .select('*')
      .eq('negocio_id', this.negocioId)
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) {
      console.error('[InventoryRestaurantService] Error:', error.message);
      throw error;
    }

    const items = (data || []).map((item: RestaurantInventoryItem) => ({
      ...item,
      stock_bajo: item.cantidad_actual <= item.cantidad_minima
    }));

    this.inventarioSubject.next(items);
    return items;
  }

  async obtenerItem(id: string): Promise<RestaurantInventoryItem | null> {
    const { data, error } = await this.supabaseService.client
      .from('restaurant_inventory')
      .select('*')
      .eq('id', id)
      .eq('negocio_id', this.negocioId)
      .single();

    if (error) throw error;
    return data ? { ...data, stock_bajo: data.cantidad_actual <= data.cantidad_minima } : null;
  }

  async crearItem(item: Omit<RestaurantInventoryItem, 'id' | 'negocio_id' | 'created_at' | 'updated_at' | 'stock_bajo'>): Promise<RestaurantInventoryItem> {
    const { data, error } = await this.supabaseService.client
      .from('restaurant_inventory')
      .insert({ ...item, negocio_id: this.negocioId })
      .select()
      .single();

    if (error) throw error;
    await this.cargarInventario();
    return { ...data, stock_bajo: data.cantidad_actual <= data.cantidad_minima };
  }

  async actualizarItem(id: string, cambios: Partial<RestaurantInventoryItem>): Promise<RestaurantInventoryItem> {
    const { stock_bajo, ...camposSinCalc } = cambios as any;
    const { data, error } = await this.supabaseService.client
      .from('restaurant_inventory')
      .update(camposSinCalc)
      .eq('id', id)
      .eq('negocio_id', this.negocioId)
      .select()
      .single();

    if (error) throw error;
    await this.cargarInventario();
    return { ...data, stock_bajo: data.cantidad_actual <= data.cantidad_minima };
  }

  async eliminarItem(id: string): Promise<void> {
    const { error } = await this.supabaseService.client
      .from('restaurant_inventory')
      .update({ activo: false })
      .eq('id', id)
      .eq('negocio_id', this.negocioId);

    if (error) throw error;
    await this.cargarInventario();
  }

  async obtenerStockBajo(): Promise<RestaurantInventoryItem[]> {
    const items = await this.cargarInventario();
    return items.filter(i => i.cantidad_actual <= i.cantidad_minima);
  }

  // ============================================================
  // MOVIMIENTOS (via función RPC atómica de la BD)
  // ============================================================

  async registrarMovimiento(
    inventoryItemId: string,
    tipo: TipoMovimientoInventario,
    cantidad: number,
    razon?: string,
    referenciaId?: string,
    referenciaTipo?: string
  ): Promise<string> {
    const { data, error } = await this.supabaseService.client.rpc('registrar_movimiento_inventario', {
      p_negocio_id:        this.negocioId,
      p_inventory_item_id: inventoryItemId,
      p_tipo:              tipo,
      p_cantidad:          cantidad,
      p_razon:             razon || null,
      p_referencia_id:     referenciaId || null,
      p_referencia_tipo:   referenciaTipo || null,
      p_usuario_id:        this.usuarioId || null
    });

    if (error) throw error;
    await this.cargarInventario();
    return data;
  }

  async obtenerHistorialMovimientos(
    inventoryItemId?: string,
    limite = 100
  ): Promise<RestaurantInventoryMovement[]> {
    let query = this.supabaseService.client
      .from('restaurant_inventory_movements')
      .select('*')
      .eq('negocio_id', this.negocioId)
      .order('created_at', { ascending: false })
      .limit(limite);

    if (inventoryItemId) query = query.eq('inventory_item_id', inventoryItemId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // ============================================================
  // RECETAS
  // ============================================================

  async obtenerRecetaDeItem(menuItemId: string): Promise<MenuItemRecipe[]> {
    const { data, error } = await this.supabaseService.client
      .from('menu_item_recipes')
      .select(`
        *,
        item_inventario:restaurant_inventory(id, nombre, unidad_medida, cantidad_actual)
      `)
      .eq('menu_item_id', menuItemId);

    if (error) throw error;
    return data || [];
  }

  async guardarReceta(menuItemId: string, ingredientes: Omit<MenuItemRecipe, 'id' | 'created_at'>[]): Promise<void> {
    // Eliminar receta anterior
    await this.supabaseService.client
      .from('menu_item_recipes')
      .delete()
      .eq('menu_item_id', menuItemId);

    if (!ingredientes.length) return;

    const { error } = await this.supabaseService.client
      .from('menu_item_recipes')
      .insert(ingredientes.map(i => ({ ...i, menu_item_id: menuItemId })));

    if (error) throw error;
  }

  /** Descuenta ingredientes del inventario cuando se cierra una orden */
  async descontarIngredientesPorOrden(orderId: string): Promise<void> {
    const { data: items } = await this.supabaseService.client
      .from('restaurant_order_items')
      .select(`
        cantidad, menu_item_id,
        menu_item:menu_items!inner(
          requiere_inventario,
          receta:menu_item_recipes(inventory_item_id, cantidad_requerida)
        )
      `)
      .eq('order_id', orderId)
      .neq('estado', 'cancelado');

    for (const item of items || []) {
      if (!(item.menu_item as any)?.requiere_inventario) continue;
      const recetas = (item.menu_item as any)?.receta || [];

      for (const receta of recetas) {
        const totalRequerido = receta.cantidad_requerida * item.cantidad;
        try {
          await this.registrarMovimiento(
            receta.inventory_item_id,
            'produccion',
            totalRequerido,
            `Producción orden ${orderId}`,
            orderId,
            'restaurant_order'
          );
        } catch (e: any) {
          console.warn(
            `[InventoryRestaurantService] Stock insuficiente (${receta.inventory_item_id}): ${e.message}`
          );
        }
      }
    }
  }

  // ============================================================
  // CRUD MENÚ (categorías e items)
  // ============================================================

  async crearCategoria(categoria: { nombre: string; descripcion?: string; orden?: number; icono?: string }): Promise<any> {
    const { data, error } = await this.supabaseService.client
      .from('menu_categories')
      .insert({ ...categoria, negocio_id: this.negocioId })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async crearMenuItem(item: {
    categoria_id: string; nombre: string; descripcion?: string;
    precio: number; tiempo_preparacion_minutos?: number;
    requiere_inventario?: boolean; notas_cocina?: string;
  }): Promise<any> {
    const { data, error } = await this.supabaseService.client
      .from('menu_items')
      .insert({ ...item, negocio_id: this.negocioId })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async actualizarDisponibilidadItem(menuItemId: string, disponible: boolean): Promise<void> {
    const { error } = await this.supabaseService.client
      .from('menu_items')
      .update({ disponible })
      .eq('id', menuItemId)
      .eq('negocio_id', this.negocioId);

    if (error) throw error;
  }
}
