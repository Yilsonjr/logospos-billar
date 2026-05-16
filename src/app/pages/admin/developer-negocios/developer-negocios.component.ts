import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Negocio } from '../../../models/negocio.model';
import { NegociosService, TipoNegocio, ModuloSistema, MODULOS_POR_TIPO, MODULOS_LABELS, TIPOS_NEGOCIO_LABELS } from '../../../services/negocios.service';
import { AuthService } from '../../../services/auth.service';
import { LicenciaService } from '../../../services/licencia.service';
import Swal from 'sweetalert2';

interface GrupoModulo {
    grupo: string;
    icono: string;
    color: string;
    modulos: ModuloSistema[];
}

const MODULOS_CORE: ModuloSistema[] = ['ventas', 'caja', 'clientes', 'dashboard', 'usuarios', 'roles', 'identidad', 'sistema'];

const PLAN_PRESETS: Partial<Record<TipoNegocio, Record<string, ModuloSistema[]>>> = {
    // Tipos con módulo restaurante completo
    restaurante: {
        basico:      [...MODULOS_CORE, 'mesas', 'restaurante'],
        profesional: [...MODULOS_CORE, 'mesas', 'restaurante', 'cocina', 'inventario', 'compras', 'proveedores', 'reportes'],
        pro:         [...MODULOS_CORE, 'mesas', 'restaurante', 'cocina', 'inventario', 'compras', 'proveedores', 'fiscal', 'cuentas_cobrar', 'reportes'],
        perpetual:   [...MODULOS_CORE, 'mesas', 'restaurante', 'cocina', 'inventario', 'compras', 'proveedores', 'fiscal', 'cuentas_cobrar', 'cuentas_pagar', 'reportes']
    },
    cafeteria: {
        basico:      [...MODULOS_CORE, 'mesas', 'restaurante'],
        profesional: [...MODULOS_CORE, 'mesas', 'restaurante', 'inventario', 'compras', 'proveedores', 'reportes'],
        pro:         [...MODULOS_CORE, 'mesas', 'restaurante', 'inventario', 'compras', 'proveedores', 'fiscal', 'cuentas_cobrar', 'reportes'],
        perpetual:   [...MODULOS_CORE, 'mesas', 'restaurante', 'inventario', 'compras', 'proveedores', 'fiscal', 'cuentas_cobrar', 'cuentas_pagar', 'reportes']
    },
    bar: {
        basico:      [...MODULOS_CORE, 'mesas', 'restaurante'],
        profesional: [...MODULOS_CORE, 'mesas', 'restaurante', 'inventario', 'compras', 'proveedores', 'cuentas_cobrar', 'reportes'],
        pro:         [...MODULOS_CORE, 'mesas', 'restaurante', 'cocina', 'inventario', 'compras', 'proveedores', 'cuentas_cobrar', 'fiscal', 'reportes'],
        perpetual:   [...MODULOS_CORE, 'mesas', 'restaurante', 'cocina', 'inventario', 'compras', 'proveedores', 'cuentas_cobrar', 'cuentas_pagar', 'fiscal', 'reportes']
    },
    food_truck: {
        basico:      [...MODULOS_CORE, 'restaurante'],
        profesional: [...MODULOS_CORE, 'restaurante', 'inventario', 'fiscal', 'reportes'],
        pro:         [...MODULOS_CORE, 'restaurante', 'inventario', 'fiscal', 'cuentas_cobrar', 'reportes'],
        perpetual:   [...MODULOS_CORE, 'restaurante', 'inventario', 'fiscal', 'cuentas_cobrar', 'cuentas_pagar', 'reportes']
    },
    // Tipos SIN módulo restaurante (usan /ventas/mesas para sus mesas)
    billar: {
        basico:      [...MODULOS_CORE, 'mesas'],
        profesional: [...MODULOS_CORE, 'mesas', 'inventario', 'cuentas_cobrar', 'reportes'],
        pro:         [...MODULOS_CORE, 'mesas', 'inventario', 'cuentas_cobrar', 'cuentas_pagar', 'compras', 'proveedores', 'reportes'],
        perpetual:   [...MODULOS_CORE, 'mesas', 'inventario', 'cuentas_cobrar', 'cuentas_pagar', 'compras', 'proveedores', 'fiscal', 'reportes']
    },
    tienda: {
        basico:      [...MODULOS_CORE, 'inventario'],
        profesional: [...MODULOS_CORE, 'inventario', 'compras', 'proveedores', 'cuentas_cobrar', 'reportes'],
        pro:         [...MODULOS_CORE, 'inventario', 'compras', 'proveedores', 'cuentas_cobrar', 'cuentas_pagar', 'fiscal', 'reportes'],
        perpetual:   [...MODULOS_CORE, 'inventario', 'compras', 'proveedores', 'cuentas_cobrar', 'cuentas_pagar', 'fiscal', 'reportes']
    },
    general: {
        basico:      [...MODULOS_CORE],
        profesional: [...MODULOS_CORE, 'inventario', 'reportes'],
        pro:         [...MODULOS_CORE, 'inventario', 'compras', 'proveedores', 'cuentas_cobrar', 'cuentas_pagar', 'fiscal', 'reportes'],
        perpetual:   [...MODULOS_CORE, 'inventario', 'compras', 'proveedores', 'cuentas_cobrar', 'cuentas_pagar', 'fiscal', 'reportes']
    }
};

const GRUPOS_MODULOS: GrupoModulo[] = [
    { grupo: 'Núcleo del Sistema',    icono: 'fa-solid fa-star',          color: 'primary',   modulos: ['ventas', 'caja', 'clientes', 'dashboard'] },
    { grupo: 'Mesas y Restaurante',   icono: 'fa-solid fa-utensils',      color: 'warning',   modulos: ['mesas', 'restaurante', 'cocina'] },
    { grupo: 'Inventario y Compras',  icono: 'fa-solid fa-boxes-stacked', color: 'success',   modulos: ['inventario', 'compras', 'proveedores'] },
    { grupo: 'Finanzas y Reportes',   icono: 'fa-solid fa-coins',         color: 'info',      modulos: ['cuentas_cobrar', 'cuentas_pagar', 'fiscal', 'reportes'] },
    { grupo: 'Administración',        icono: 'fa-solid fa-gears',         color: 'secondary', modulos: ['usuarios', 'roles', 'identidad', 'sistema'] }
];

@Component({
    selector: 'app-developer-negocios',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './developer-negocios.component.html',
    styleUrls: ['./developer-negocios.component.css']
})
export class DeveloperNegociosComponent implements OnInit, OnDestroy {
    negocios: Negocio[] = [];
    negociosFiltrados: Negocio[] = [];
    isLoading = false;
    isSaving = false;
    filtroTexto = '';

    // Modal
    mostrarModal = false;
    modoModal: 'crear' | 'editar' = 'crear';
    negocioSeleccionado: Negocio | null = null;

    formularioNegocio: Partial<Negocio> = {
        nombre: '',
        subdominio: '',
        rnc: '',
        plan_tipo: 'basico',
        estado_licencia: 'activa',
        fecha_vencimiento: '',
        tipo_negocio: 'general',
        modulos_activos: []
    };

    // 💡 NUEVO: Datos para el administrador inicial
    formularioAdmin = {
        email: '',
        username: '',
        password: '',
        nombre: '',
        apellido: ''
    };

    // Constantes expuestas al template
    tiposNegocio = TIPOS_NEGOCIO_LABELS;
    modulosLabels = MODULOS_LABELS;
    modulosPorTipo = MODULOS_POR_TIPO;
    tiposKeys = Object.keys(TIPOS_NEGOCIO_LABELS) as TipoNegocio[];
    modulosKeys = Object.keys(MODULOS_LABELS) as ModuloSistema[];
    gruposModulos = GRUPOS_MODULOS;

    // Historial de cambios
    historial: any[] = [];
    cargandoHistorial = false;
    tabActiva: 'config' | 'historial' = 'config';

    // Filtros
    filtroEstado: '' | 'activa' | 'suspendida' | 'vencida' = '';
    mostrarAlertaVencimiento = true;

    // ── Stats (getters) ────────────────────────────────────
    get totalNegocios()           { return this.negocios.length; }
    get negociosActivosCount()    { return this.negocios.filter(n => n.estado_licencia === 'activa').length; }
    get negociosSuspendidosCount(){ return this.negocios.filter(n => n.estado_licencia !== 'activa').length; }

    get negociosProximosVencer(): Negocio[] {
        const hoy   = Date.now();
        const limit = hoy + 30 * 86_400_000;
        return this.negocios.filter(n => {
            if (!n.fecha_vencimiento || n.estado_licencia !== 'activa') return false;
            const t = new Date(n.fecha_vencimiento).getTime();
            return t >= hoy && t <= limit;
        });
    }

    get mrrEstimado(): number {
        const precios: Record<string, number> = { basico: 1500, profesional: 3000, pro: 5000, perpetual: 0 };
        return this.negocios
            .filter(n => n.estado_licencia === 'activa')
            .reduce((acc, n) => acc + (precios[n.plan_tipo] ?? 0), 0);
    }

    private subscriptions: Subscription[] = [];

    constructor(
        private negociosService: NegociosService,
        private authService: AuthService,
        private licenciaService: LicenciaService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) { }

    async ngOnInit() {
        if (!this.authService.isSuperAdmin()) {
            this.router.navigate(['/dashboard']);
            return;
        }
        await this.cargarNegocios();
    }

    ngOnDestroy() {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    async cargarNegocios() {
        this.isLoading = true;
        this.cdr.detectChanges();
        try {
            this.negocios = await this.negociosService.obtenerTodos();
            this.aplicarFiltros();
        } catch (error) {
            console.error('Error al cargar negocios:', error);
            Swal.fire('Error', 'No se pudieron cargar los negocios', 'error');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    aplicarFiltros() {
        let result = [...this.negocios];
        if (this.filtroTexto.trim()) {
            const t = this.filtroTexto.toLowerCase();
            result = result.filter(n =>
                n.nombre.toLowerCase().includes(t) ||
                n.subdominio.toLowerCase().includes(t) ||
                n.rnc?.includes(t)
            );
        }
        if (this.filtroEstado) {
            result = result.filter(n => n.estado_licencia === this.filtroEstado);
        }
        this.negociosFiltrados = result;
        this.cdr.detectChanges();
    }

    // ── Helpers de vencimiento ─────────────────────────────
    diasParaVencer(fecha: string | null | undefined): number | null {
        if (!fecha) return null;
        return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86_400_000);
    }

    claseDiasVencimiento(negocio: Negocio): string {
        const d = this.diasParaVencer(negocio.fecha_vencimiento);
        if (d === null) return 'secondary';
        if (d < 0)     return 'danger';
        if (d <= 7)    return 'danger';
        if (d <= 30)   return 'warning';
        return 'success';
    }

    textoVencimiento(fecha: string | null | undefined): string {
        if (!fecha) return 'Licencia indefinida';
        const d = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86_400_000);
        if (d < 0)  return `Vencido hace ${Math.abs(d)} día(s)`;
        if (d === 0) return 'Vence hoy';
        if (d <= 30) return `Vence en ${d} día(s)`;
        return `Vence ${new Date(fecha).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }

    accentPlan(plan: string): string {
        const map: Record<string, string> = {
            basico:      '#6366f1',
            profesional: '#3b82f6',
            pro:         '#8b5cf6',
            perpetual:   '#f59e0b'
        };
        return map[plan] ?? '#6b7280';
    }

    abrirModalCrear() {
        this.modoModal = 'crear';
        this.negocioSeleccionado = null;
        this.formularioNegocio = {
            nombre: '',
            subdominio: '',
            rnc: '',
            plan_tipo: 'basico',
            estado_licencia: 'activa',
            fecha_vencimiento: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
            tipo_negocio: 'general',
            modulos_activos: [...(PLAN_PRESETS['general']?.['basico'] ?? MODULOS_POR_TIPO['general'])]
        };
        // Resetear admin form
        this.formularioAdmin = {
            email: '',
            username: '',
            password: '',
            nombre: '',
            apellido: ''
        };
        this.mostrarModal = true;
    }

    abrirModalEditar(negocio: Negocio) {
        this.modoModal = 'editar';
        this.negocioSeleccionado = negocio;
        this.formularioNegocio = { ...negocio };
        if (negocio.fecha_vencimiento) {
            this.formularioNegocio.fecha_vencimiento = new Date(negocio.fecha_vencimiento).toISOString().split('T')[0];
        }
        this.tabActiva = 'config';
        this.historial = [];
        this.mostrarModal = true;
        this.cargarHistorial(negocio.id);
    }

    cerrarModal() {
        this.mostrarModal = false;
        this.historial = [];
        this.tabActiva = 'config';
    }

    async cargarHistorial(negocioId: string) {
        this.cargandoHistorial = true;
        try {
            const { data } = await ((this.negociosService as any).supabaseService
                ? this.obtenerHistorialDirecto(negocioId)
                : Promise.resolve({ data: [] }));
            this.historial = data || [];
        } catch {
            this.historial = [];
        } finally {
            this.cargandoHistorial = false;
            this.cdr.detectChanges();
        }
    }

    private async obtenerHistorialDirecto(negocioId: string): Promise<{ data: any[] }> {
        const supabase = (this.negociosService as any)['supabaseService']?.client;
        if (!supabase) return { data: [] };
        const { data } = await supabase
            .from('negocio_cambios_modulos')
            .select('*')
            .eq('negocio_id', negocioId)
            .order('created_at', { ascending: false })
            .limit(30);
        return { data: data || [] };
    }

    onTipoNegocioChange() {
        const tipo = this.formularioNegocio.tipo_negocio as TipoNegocio;
        const plan = this.formularioNegocio.plan_tipo as string;
        if (tipo && PLAN_PRESETS[tipo]?.[plan]) {
            this.formularioNegocio.modulos_activos = [...PLAN_PRESETS[tipo]![plan]];
        } else if (tipo && MODULOS_POR_TIPO[tipo]) {
            this.formularioNegocio.modulos_activos = [...MODULOS_POR_TIPO[tipo]];
        }
    }

    onPlanChange() {
        const tipo = this.formularioNegocio.tipo_negocio as TipoNegocio;
        const plan = this.formularioNegocio.plan_tipo as string;
        if (tipo && plan && PLAN_PRESETS[tipo]?.[plan]) {
            this.formularioNegocio.modulos_activos = [...PLAN_PRESETS[tipo]![plan]];
        }
    }

    toggleModulo(modulo: ModuloSistema) {
        const activos = this.formularioNegocio.modulos_activos || [];
        const index = activos.indexOf(modulo);
        if (index > -1) activos.splice(index, 1);
        else activos.push(modulo);
        this.formularioNegocio.modulos_activos = [...activos];
    }

    moduloActivo(modulo: ModuloSistema): boolean {
        return this.formularioNegocio.modulos_activos?.includes(modulo) ?? false;
    }

    contarModulosActivos(modulos: ModuloSistema[]): number {
        return modulos.filter(m => this.moduloActivo(m)).length;
    }

    private async registrarCambioModulos(anterior: Negocio): Promise<void> {
        const modulosAnteriores: ModuloSistema[] = anterior.modulos_activos || [];
        const modulosNuevos: ModuloSistema[] = this.formularioNegocio.modulos_activos || [];
        const planAnterior = anterior.plan_tipo;
        const planNuevo = this.formularioNegocio.plan_tipo;

        const activados   = modulosNuevos.filter(m => !modulosAnteriores.includes(m));
        const desactivados = modulosAnteriores.filter(m => !modulosNuevos.includes(m));

        const sinCambios = activados.length === 0 && desactivados.length === 0 && planAnterior === planNuevo;
        if (sinCambios) return;

        const supabase = (this.negociosService as any)['supabaseService']?.client;
        if (!supabase) return;

        const devUser = JSON.parse(localStorage.getItem('logos_usuario') || '{}');

        await supabase.from('negocio_cambios_modulos').insert({
            negocio_id:          anterior.id,
            plan_anterior:       planAnterior || null,
            plan_nuevo:          planNuevo || null,
            modulos_activados:   activados,
            modulos_desactivados: desactivados,
            notas:               this.formularioNegocio.notas_internas || null,
            realizado_por:       devUser.username || devUser.email || 'dev'
        });
    }

    formatearFecha(fecha: string): string {
        return new Date(fecha).toLocaleString('es-DO', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    async guardarNegocio() {
        if (!this.formularioNegocio.nombre || !this.formularioNegocio.subdominio) {
            Swal.fire('Atención', 'Nombre y Subdominio son obligatorios', 'warning');
            return;
        }

        if (this.modoModal === 'crear' && (!this.formularioAdmin.email || !this.formularioAdmin.password)) {
            Swal.fire('Atención', 'Debe especificar un Email y Contraseña para el Administrador del nuevo negocio', 'warning');
            return;
        }

        this.isSaving = true;
        try {
            if (this.modoModal === 'crear') {
                await this.negociosService.crearNegocio(this.formularioNegocio, this.formularioAdmin);
                Swal.fire('¡Bien hecho!', 'Negocio y Administrador creados correctamente.', 'success');
            } else {
                const anterior = this.negocioSeleccionado!;
                await this.negociosService.actualizarLicencia(anterior.id, this.formularioNegocio);
                await this.registrarCambioModulos(anterior);
                Swal.fire('Éxito', 'Configuración actualizada', 'success');
            }
            this.cerrarModal();
            await this.cargarNegocios();
        } catch (error: any) {
            console.error('Error al guardar negocio:', error);
            Swal.fire('Error', error.message || 'No se pudo completar el registro', 'error');
        } finally {
            this.isSaving = false;
            this.cdr.detectChanges();
        }
    }

    async toggleEstado(negocio: Negocio) {
        const nuevoEstado = negocio.estado_licencia === 'activa' ? 'suspendida' : 'activa';
        const confirm = await Swal.fire({
            title: `¿${nuevoEstado === 'activa' ? 'Activar' : 'Suspender'} Negocio?`,
            text: `El negocio "${negocio.nombre}" ${nuevoEstado === 'activa' ? 'recuperará' : 'perderá'} acceso inmediatamente.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, confirmar',
            confirmButtonColor: nuevoEstado === 'activa' ? '#10b981' : '#ef4444'
        });

        if (confirm.isConfirmed) {
            try {
                await this.negociosService.actualizarLicencia(negocio.id, { estado_licencia: nuevoEstado });
                await this.cargarNegocios();
                Swal.fire('Actualizado', `El negocio ha sido ${nuevoEstado === 'activa' ? 'activado' : 'suspendido'}.`, 'success');
            } catch (error) {
                Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
            }
        }
    }

    obtenerClaseEstado(estado: string): string {
        switch (estado) {
            case 'activa': return 'bg-success-subtle text-success';
            case 'suspendida': return 'bg-danger-subtle text-danger';
            case 'vencida': return 'bg-warning-subtle text-warning';
            default: return 'bg-secondary-subtle text-secondary';
        }
    }
}
