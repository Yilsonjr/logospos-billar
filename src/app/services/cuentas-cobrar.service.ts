import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { CuentaPorCobrar, PagoCuenta, CuentaConPagos, CrearCuentaPorCobrar, CrearPagoCuenta } from '../models/cuentas-cobrar.model';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CuentasCobrarService {
  private cuentasSubject = new BehaviorSubject<CuentaPorCobrar[]>([]);
  public cuentas$ = this.cuentasSubject.asObservable();

  constructor(private supabaseService: SupabaseService) {}

  // Cargar todas las cuentas
  async cargarCuentas(): Promise<void> {
    try {
      console.log('🔄 Cargando cuentas por cobrar...');
      
      const { data, error } = await this.supabaseService.client
        .from('cuentas_por_cobrar')
        .select(`
          *,
          clientes (nombre)
        `)
        .order('fecha_vencimiento', { ascending: true });

      if (error) {
        console.error('❌ Error al cargar cuentas:', error);
        throw error;
      }

      const cuentasConCliente = data?.map(cuenta => ({
        ...cuenta,
        cliente_nombre: cuenta.clientes?.nombre
      })) || [];

      console.log('✅ Cuentas cargadas:', cuentasConCliente.length);
      this.cuentasSubject.next(cuentasConCliente);
      
    } catch (error) {
      console.error('💥 Error en cargarCuentas:', error);
      throw error;
    }
  }

  // Obtener cuenta con sus pagos
  async obtenerCuentaConPagos(cuentaId: number): Promise<CuentaConPagos> {
    try {
      const { data: cuenta, error: errorCuenta } = await this.supabaseService.client
        .from('cuentas_por_cobrar')
        .select(`
          *,
          clientes (nombre)
        `)
        .eq('id', cuentaId)
        .single();

      if (errorCuenta) throw errorCuenta;

      const { data: pagos, error: errorPagos } = await this.supabaseService.client
        .from('pagos_cuentas')
        .select('*')
        .eq('cuenta_id', cuentaId)
        .order('fecha_pago', { ascending: false });

      if (errorPagos) throw errorPagos;

      return {
        ...cuenta,
        cliente_nombre: cuenta.clientes?.nombre,
        pagos: pagos || []
      };
      
    } catch (error) {
      console.error('Error al obtener cuenta con pagos:', error);
      throw error;
    }
  }

  // Crear cuenta por cobrar
  async crearCuenta(cuenta: CrearCuentaPorCobrar): Promise<CuentaPorCobrar> {
    try {
      console.log('🔄 Creando cuenta por cobrar...');
      
      const { data, error } = await this.supabaseService.client
        .from('cuentas_por_cobrar')
        .insert([cuenta])
        .select()
        .single();

      if (error) {
        console.error('❌ Error al crear cuenta:', error);
        throw error;
      }

      console.log('✅ Cuenta creada:', data.id);
      await this.cargarCuentas();
      return data;
      
    } catch (error) {
      console.error('💥 Error en crearCuenta:', error);
      throw error;
    }
  }

  // Registrar pago
  async registrarPago(pago: CrearPagoCuenta): Promise<PagoCuenta> {
    try {
      console.log('🔄 Registrando pago...');
      
      const { data, error } = await this.supabaseService.client
        .from('pagos_cuentas')
        .insert([pago])
        .select()
        .single();

      if (error) {
        console.error('❌ Error al registrar pago:', error);
        throw error;
      }

      console.log('✅ Pago registrado:', data.id);
      await this.cargarCuentas();
      return data;
      
    } catch (error) {
      console.error('💥 Error en registrarPago:', error);
      throw error;
    }
  }

  // Obtener cuentas por cliente
  async obtenerCuentasPorCliente(clienteId: number): Promise<CuentaPorCobrar[]> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('cuentas_por_cobrar')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('fecha_vencimiento', { ascending: true });

      if (error) throw error;
      return data || [];
      
    } catch (error) {
      console.error('Error al obtener cuentas por cliente:', error);
      throw error;
    }
  }

  // Obtener cuentas vencidas
  async obtenerCuentasVencidas(): Promise<CuentaPorCobrar[]> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('cuentas_por_cobrar')
        .select(`
          *,
          clientes (nombre)
        `)
        .eq('estado', 'vencida')
        .order('fecha_vencimiento', { ascending: true });

      if (error) throw error;
      
      return data?.map(cuenta => ({
        ...cuenta,
        cliente_nombre: cuenta.clientes?.nombre
      })) || [];
      
    } catch (error) {
      console.error('Error al obtener cuentas vencidas:', error);
      throw error;
    }
  }

  // Obtener cuentas por estado
  async obtenerCuentasPorEstado(estado: string): Promise<CuentaPorCobrar[]> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('cuentas_por_cobrar')
        .select(`
          *,
          clientes (nombre)
        `)
        .eq('estado', estado)
        .order('fecha_vencimiento', { ascending: true});

      if (error) throw error;
      
      return data?.map(cuenta => ({
        ...cuenta,
        cliente_nombre: cuenta.clientes?.nombre
      })) || [];
      
    } catch (error) {
      console.error('Error al obtener cuentas por estado:', error);
      throw error;
    }
  }

  // Actualizar estado de cuenta manualmente
  async actualizarEstadoCuenta(cuentaId: number, estado: string): Promise<void> {
    try {
      const { error } = await this.supabaseService.client
        .from('cuentas_por_cobrar')
        .update({ 
          estado,
          updated_at: new Date().toISOString()
        })
        .eq('id', cuentaId);

      if (error) throw error;
      await this.cargarCuentas();
      
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      throw error;
    }
  }
}
