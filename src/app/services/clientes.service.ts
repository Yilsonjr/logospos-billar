import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Cliente, CrearCliente } from '../models/clientes.model';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ClientesService {
  private clientesSubject = new BehaviorSubject<Cliente[]>([]);
  public clientes$ = this.clientesSubject.asObservable();

  constructor(private supabaseService: SupabaseService) {
    // NO cargar automáticamente en el constructor
  }

  // Cargar clientes activos
  async cargarClientes(): Promise<void> {
    try {
      console.log('🔄 Cargando clientes...');
      
      const { data, error } = await this.supabaseService.client
        .from('clientes')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (error) {
        console.error('❌ Error al cargar clientes:', error);
        throw error;
      }

      console.log('✅ Clientes cargados:', data?.length || 0);
      this.clientesSubject.next(data || []);
      
    } catch (error) {
      console.error('💥 Error en cargarClientes:', error);
      throw error;
    }
  }

  // Cargar TODOS los clientes (activos e inactivos)
  async cargarTodosClientes(): Promise<Cliente[]> {
    try {
      console.log('🔄 Cargando todos los clientes...');
      
      const { data, error } = await this.supabaseService.client
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) {
        console.error('❌ Error al cargar todos los clientes:', error);
        throw error;
      }

      console.log('✅ Todos los clientes cargados:', data?.length || 0);
      return data || [];
      
    } catch (error) {
      console.error('💥 Error en cargarTodosClientes:', error);
      throw error;
    }
  }

  // Crear nuevo cliente
  async crearCliente(cliente: CrearCliente): Promise<Cliente> {
    try {
      console.log('🔄 Creando cliente:', cliente.nombre);
      
      const { data, error } = await this.supabaseService.client
        .from('clientes')
        .insert([{
          ...cliente,
          balance_pendiente: 0 // Inicializar balance en 0
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Error al crear cliente:', error);
        throw error;
      }

      console.log('✅ Cliente creado:', data.nombre);
      await this.cargarClientes();
      return data;
      
    } catch (error) {
      console.error('💥 Error en crearCliente:', error);
      throw error;
    }
  }

  // Actualizar cliente
  async actualizarCliente(id: number, cliente: Partial<Cliente>): Promise<Cliente> {
    try {
      console.log('🔄 Actualizando cliente ID:', id);
      
      const { data, error } = await this.supabaseService.client
        .from('clientes')
        .update({
          ...cliente,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error al actualizar cliente:', error);
        throw error;
      }

      console.log('✅ Cliente actualizado:', data.nombre);
      await this.cargarClientes();
      return data;
      
    } catch (error) {
      console.error('💥 Error en actualizarCliente:', error);
      throw error;
    }
  }

  // Desactivar cliente (soft delete)
  async desactivarCliente(id: number): Promise<void> {
    try {
      console.log('🔄 Desactivando cliente ID:', id);
      
      const { error } = await this.supabaseService.client
        .from('clientes')
        .update({ 
          activo: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('❌ Error al desactivar cliente:', error);
        throw error;
      }

      console.log('✅ Cliente desactivado');
      await this.cargarClientes();
      
    } catch (error) {
      console.error('💥 Error en desactivarCliente:', error);
      throw error;
    }
  }

  // Eliminar cliente físicamente
  async eliminarClienteFisicamente(id: number): Promise<void> {
    try {
      console.log('🔄 Eliminando físicamente cliente ID:', id);
      
      const { error } = await this.supabaseService.client
        .from('clientes')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Error al eliminar cliente:', error);
        throw error;
      }

      console.log('✅ Cliente eliminado físicamente');
      await this.cargarClientes();
      
    } catch (error) {
      console.error('💥 Error en eliminarClienteFisicamente:', error);
      throw error;
    }
  }

  // Actualizar balance pendiente del cliente
  async actualizarBalance(id: number, nuevoBalance: number): Promise<void> {
    try {
      console.log('🔄 Actualizando balance cliente ID:', id);
      
      const { error } = await this.supabaseService.client
        .from('clientes')
        .update({ 
          balance_pendiente: nuevoBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('❌ Error al actualizar balance:', error);
        throw error;
      }

      console.log('✅ Balance actualizado');
      await this.cargarClientes();
      
    } catch (error) {
      console.error('💥 Error en actualizarBalance:', error);
      throw error;
    }
  }

  // Verificar si el cliente puede comprar a crédito
  puedeComprarACredito(cliente: Cliente, montoCompra: number): boolean {
    const nuevoBalance = cliente.balance_pendiente + montoCompra;
    return nuevoBalance <= cliente.limite_credito;
  }

  // Obtener clientes activos
  getClientesActivos(): Cliente[] {
    return this.clientesSubject.value.filter(c => c.activo);
  }

  // Buscar cliente por cédula
  buscarPorCedula(cedula: string): Cliente | undefined {
    return this.clientesSubject.value.find(
      c => c.cedula?.toLowerCase() === cedula.toLowerCase()
    );
  }

  // Obtener cliente general (para ventas sin cliente específico)
  async getClienteGeneral(): Promise<Cliente | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('clientes')
        .select('*')
        .eq('nombre', 'Cliente General')
        .single();

      if (error) {
        console.error('❌ Error al obtener cliente general:', error);
        return null;
      }

      return data;
      
    } catch (error) {
      console.error('💥 Error en getClienteGeneral:', error);
      return null;
    }
  }
}
