import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { CajaService } from './caja.service';
import { Caja } from '../models/caja.model';
import { Gasto, CrearGasto, ResumenGastos, FiltrosGastos } from '../models/gastos.model';
import { sdFechaHoy } from '../utils/fecha-sd';

@Injectable({ providedIn: 'root' })
export class GastosService {
  private gastosSubject = new BehaviorSubject<Gasto[]>([]);
  public gastos$ = this.gastosSubject.asObservable();

  private resumenSubject = new BehaviorSubject<ResumenGastos>({
    total_mes: 0,
    total_semana: 0,
    total_hoy: 0,
    cantidad_registros: 0,
    por_categoria: []
  });
  public resumen$ = this.resumenSubject.asObservable();

  private cajaActual: Caja | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService,
    private cajaService: CajaService
  ) {
    this.cajaService.cajaActual$.subscribe(c => { this.cajaActual = c; });
  }

  async cargarGastos(filtros?: FiltrosGastos): Promise<void> {
    const negocioId = this.authService.getNegocioId();
    let query = this.supabaseService.client
      .from('gastos')
      .select('*')
      .eq('negocio_id', negocioId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });

    if (filtros?.fecha_desde) query = query.gte('fecha', filtros.fecha_desde);
    if (filtros?.fecha_hasta) query = query.lte('fecha', filtros.fecha_hasta);
    if (filtros?.categoria)   query = query.eq('categoria', filtros.categoria);
    if (filtros?.metodo_pago) query = query.eq('metodo_pago', filtros.metodo_pago);
    if (filtros?.busqueda) {
      query = query.or(
        `descripcion.ilike.%${filtros.busqueda}%,proveedor.ilike.%${filtros.busqueda}%,numero_comprobante.ilike.%${filtros.busqueda}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    this.gastosSubject.next(data || []);
    this.calcularResumen(data || []);
  }

  async registrarGasto(gasto: CrearGasto): Promise<Gasto> {
    const negocioId = this.authService.getNegocioId();
    const usuarioId = this.authService.getUserId();
    const cajaActual = this.cajaActual;

    let cajaId: number | null = null;
    let movimientoCajaId: number | null = null;

    // Si es efectivo y hay caja abierta, registrar salida en caja
    if (gasto.metodo_pago === 'efectivo' && cajaActual?.id) {
      cajaId = cajaActual.id;
      const { data: mov, error: movErr } = await this.supabaseService.client
        .from('movimientos_caja')
        .insert([{
          caja_id: cajaId,
          negocio_id: negocioId,
          tipo: 'salida',
          concepto: `Gasto - ${gasto.categoria}: ${gasto.descripcion}`,
          monto: gasto.monto,
          referencia: gasto.numero_comprobante || null,
          usuario_id: usuarioId ? parseInt(usuarioId, 10) : null
        }])
        .select()
        .single();
      if (movErr) throw movErr;
      movimientoCajaId = mov?.id ?? null;
    }

    const { data, error } = await this.supabaseService.client
      .from('gastos')
      .insert([{
        ...gasto,
        negocio_id: negocioId,
        usuario_id: usuarioId,
        caja_id: cajaId,
        movimiento_caja_id: movimientoCajaId
      }])
      .select()
      .single();

    if (error) throw error;

    // Actualizar lista local
    const actual = this.gastosSubject.value;
    this.gastosSubject.next([data, ...actual]);
    this.calcularResumen([data, ...actual]);

    return data;
  }

  async eliminarGasto(id: number): Promise<void> {
    const { error } = await this.supabaseService.client
      .from('gastos')
      .delete()
      .eq('id', id);
    if (error) throw error;

    const actualizado = this.gastosSubject.value.filter(g => g.id !== id);
    this.gastosSubject.next(actualizado);
    this.calcularResumen(actualizado);
  }

  private calcularResumen(gastos: Gasto[]): void {
    const hoy = sdFechaHoy();
    const inicioSemana = (() => {
      const d = new Date(`${hoy}T00:00:00-04:00`);
      d.setDate(d.getDate() - d.getDay());
      return d.toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' });
    })();
    const inicioMes = hoy.substring(0, 7) + '-01';

    let total_hoy = 0, total_semana = 0, total_mes = 0;
    const categoriaMap: Record<string, number> = {};

    for (const g of gastos) {
      if (g.fecha >= inicioMes) total_mes += g.monto;
      if (g.fecha >= inicioSemana) total_semana += g.monto;
      if (g.fecha === hoy) total_hoy += g.monto;
      categoriaMap[g.categoria] = (categoriaMap[g.categoria] || 0) + g.monto;
    }

    const por_categoria = Object.entries(categoriaMap)
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total);

    this.resumenSubject.next({
      total_hoy,
      total_semana,
      total_mes,
      cantidad_registros: gastos.length,
      por_categoria
    });
  }
}
