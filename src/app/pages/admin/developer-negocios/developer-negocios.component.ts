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

    // Constantes expuestas al template
    tiposNegocio = TIPOS_NEGOCIO_LABELS;
    modulosLabels = MODULOS_LABELS;
    modulosPorTipo = MODULOS_POR_TIPO;
    tiposKeys = Object.keys(TIPOS_NEGOCIO_LABELS) as TipoNegocio[];
    modulosKeys = Object.keys(MODULOS_LABELS) as ModuloSistema[];

    private subscriptions: Subscription[] = [];

    constructor(
        private negociosService: NegociosService,
        private authService: AuthService,
        private licenciaService: LicenciaService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) { }

    async ngOnInit() {
        // Solo permitir al Super Admin Global del sistema
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
        if (!this.filtroTexto.trim()) {
            this.negociosFiltrados = [...this.negocios];
        } else {
            const texto = this.filtroTexto.toLowerCase();
            this.negociosFiltrados = this.negocios.filter(n =>
                n.nombre.toLowerCase().includes(texto) ||
                n.subdominio.toLowerCase().includes(texto) ||
                n.rnc?.includes(texto)
            );
        }
        this.cdr.detectChanges();
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
            modulos_activos: [...MODULOS_POR_TIPO['general']]
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
        this.mostrarModal = true;
    }

    cerrarModal() {
        this.mostrarModal = false;
    }

    // Cuando cambia el tipo de negocio, cargar módulos por defecto
    onTipoNegocioChange() {
        const tipo = this.formularioNegocio.tipo_negocio as TipoNegocio;
        if (tipo && MODULOS_POR_TIPO[tipo]) {
            this.formularioNegocio.modulos_activos = [...MODULOS_POR_TIPO[tipo]];
        }
    }

    // Toggle un módulo individual
    toggleModulo(modulo: ModuloSistema) {
        const activos = this.formularioNegocio.modulos_activos || [];
        const index = activos.indexOf(modulo);
        if (index > -1) {
            activos.splice(index, 1);
        } else {
            activos.push(modulo);
        }
        this.formularioNegocio.modulos_activos = [...activos];
    }

    moduloActivo(modulo: ModuloSistema): boolean {
        return this.formularioNegocio.modulos_activos?.includes(modulo) ?? false;
    }

    async guardarNegocio() {
        if (!this.formularioNegocio.nombre || !this.formularioNegocio.subdominio) {
            Swal.fire('Atención', 'Nombre y Subdominio son obligatorios', 'warning');
            return;
        }

        this.isSaving = true;
        try {
            if (this.modoModal === 'crear') {
                await this.negociosService.crearNegocio(this.formularioNegocio);
                Swal.fire('Éxito', 'Negocio creado correctamente', 'success');
            } else {
                await this.negociosService.actualizarLicencia(this.negocioSeleccionado!.id, this.formularioNegocio);
                Swal.fire('Éxito', 'Licencia actualizada', 'success');
            }
            this.cerrarModal();
            await this.cargarNegocios();
        } catch (error: any) {
            console.error('Error al guardar negocio:', error);
            Swal.fire('Error', error.message || 'No se pudo guardar el negocio', 'error');
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
