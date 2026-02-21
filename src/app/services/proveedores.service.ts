import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Proveedor, CrearProveedor } from '../models/proveedores.model';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProveedoresService {
  private proveedoresSubject = new BehaviorSubject<Proveedor[]>([]);
  public proveedores$ = this.proveedoresSubject.asObservable();

  constructor(private supabaseService: SupabaseService) {
    // No cargar automáticamente en el constructor
    // Dejar que cada componente llame a cargarProveedores() cuando lo necesite
  }

  // Cargar proveedores activos
  async cargarProveedores(): Promise<void> {
    try {
      console.log('🔄 Cargando proveedores...');
      
      const { data, error } = await this.supabaseService.client
        .from('proveedores')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (error) {
        console.error('❌ Error al cargar proveedores:', error);
        throw error;
      }

      console.log('✅ Proveedores cargados:', data?.length || 0);
      this.proveedoresSubject.next(data || []);
      
    } catch (error) {
      console.error('💥 Error en cargarProveedores:', error);
      throw error;
    }
  }

  // Cargar TODOS los proveedores (activos e inactivos)
  async cargarTodosProveedores(): Promise<Proveedor[]> {
    try {
      console.log('🔄 Cargando todos los proveedores...');
      
      const { data, error } = await this.supabaseService.client
        .from('proveedores')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) {
        console.error('❌ Error al cargar todos los proveedores:', error);
        throw error;
      }

      console.log('✅ Todos los proveedores cargados:', data?.length || 0);
      return data || [];
      
    } catch (error) {
      console.error('💥 Error en cargarTodosProveedores:', error);
      throw error;
    }
  }

  // Crear nuevo proveedor
  async crearProveedor(proveedor: CrearProveedor): Promise<Proveedor> {
    try {
      console.log('🔄 Creando proveedor:', proveedor.nombre);
      
      const { data, error } = await this.supabaseService.client
        .from('proveedores')
        .insert([proveedor])
        .select()
        .single();

      if (error) {
        console.error('❌ Error al crear proveedor:', error);
        throw error;
      }

      console.log('✅ Proveedor creado:', data.nombre);
      await this.cargarProveedores();
      return data;
      
    } catch (error) {
      console.error('💥 Error en crearProveedor:', error);
      throw error;
    }
  }

  // Actualizar proveedor
  async actualizarProveedor(id: number, proveedor: Partial<Proveedor>): Promise<Proveedor> {
    try {
      console.log('🔄 Actualizando proveedor ID:', id);
      
      const { data, error } = await this.supabaseService.client
        .from('proveedores')
        .update({
          ...proveedor,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error al actualizar proveedor:', error);
        throw error;
      }

      console.log('✅ Proveedor actualizado:', data.nombre);
      await this.cargarProveedores();
      return data;
      
    } catch (error) {
      console.error('💥 Error en actualizarProveedor:', error);
      throw error;
    }
  }

  // Desactivar proveedor (soft delete)
  async desactivarProveedor(id: number): Promise<void> {
    try {
      console.log('🔄 Desactivando proveedor ID:', id);
      
      const { error } = await this.supabaseService.client
        .from('proveedores')
        .update({ 
          activo: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('❌ Error al desactivar proveedor:', error);
        throw error;
      }

      console.log('✅ Proveedor desactivado');
      await this.cargarProveedores();
      
    } catch (error) {
      console.error('💥 Error en desactivarProveedor:', error);
      throw error;
    }
  }

  // Eliminar proveedor físicamente
  async eliminarProveedorFisicamente(id: number): Promise<void> {
    try {
      console.log('🔄 Eliminando físicamente proveedor ID:', id);
      
      const { error } = await this.supabaseService.client
        .from('proveedores')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Error al eliminar proveedor:', error);
        throw error;
      }

      console.log('✅ Proveedor eliminado físicamente');
      await this.cargarProveedores();
      
    } catch (error) {
      console.error('💥 Error en eliminarProveedorFisicamente:', error);
      throw error;
    }
  }

  // Obtener proveedores activos
  getProveedoresActivos(): Proveedor[] {
    return this.proveedoresSubject.value.filter(p => p.activo);
  }

  // Buscar proveedor por nombre
  buscarPorNombre(nombre: string): Proveedor | undefined {
    return this.proveedoresSubject.value.find(
      p => p.nombre.toLowerCase() === nombre.toLowerCase()
    );
  }
}
