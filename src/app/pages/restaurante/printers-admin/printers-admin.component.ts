import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrintService } from '../../../services/print.service';
import { NegociosService } from '../../../services/negocios.service';
import { RestaurantPrinter, TipoImpresora } from '../../../models/restaurant.models';
import Swal from 'sweetalert2';

interface TipoInfo {
    value: TipoImpresora;
    label: string;
    icon: string;
    color: string;
}

const TIPOS: TipoInfo[] = [
    { value: 'cocina',   label: 'Cocina',           icon: 'fa-fire-burner',    color: 'danger'  },
    { value: 'barra',    label: 'Barra / Bar',       icon: 'fa-martini-glass',  color: 'purple'  },
    { value: 'caja',     label: 'Caja / Recibo',     icon: 'fa-receipt',        color: 'success' },
    { value: 'comanda',  label: 'Comanda General',   icon: 'fa-clipboard-list', color: 'warning' },
    { value: 'otro',     label: 'Otro',              icon: 'fa-print',          color: 'secondary'}
];

@Component({
    selector: 'app-printers-admin',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './printers-admin.component.html',
    styleUrls: ['./printers-admin.component.css']
})
export class PrintersAdminComponent implements OnInit {

    impresoras: RestaurantPrinter[] = [];
    isLoading = false;
    isSaving = false;
    testingId: string | null = null;

    mostrarModal = false;
    modoModal: 'crear' | 'editar' = 'crear';
    printerSeleccionada: RestaurantPrinter | null = null;

    formulario: Partial<RestaurantPrinter> = this.formularioVacio();

    // URL del agente de impresión local
    agentUrl = '';
    savingAgent = false;

    tipos = TIPOS;

    constructor(
        private printService: PrintService,
        private negociosService: NegociosService,
        private cdr: ChangeDetectorRef
    ) {}

    async ngOnInit() {
        await this.cargarImpresoras();
        this.agentUrl = this.printService.agentUrl || '';
    }

    private formularioVacio(): Partial<RestaurantPrinter> {
        return {
            nombre: '',
            descripcion: '',
            ip: '',
            puerto: 9100,
            tipo: 'cocina',
            caracteres_por_linea: 42,
            corte_automatico: true,
            copies: 1,
            activa: true
        };
    }

    async cargarImpresoras() {
        this.isLoading = true;
        try {
            this.impresoras = await this.printService.cargarImpresoras();
        } catch (e: any) {
            Swal.fire('Error', e.message || 'No se pudieron cargar las impresoras', 'error');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    abrirModalCrear() {
        this.modoModal = 'crear';
        this.printerSeleccionada = null;
        this.formulario = this.formularioVacio();
        this.mostrarModal = true;
    }

    abrirModalEditar(printer: RestaurantPrinter) {
        this.modoModal = 'editar';
        this.printerSeleccionada = printer;
        this.formulario = { ...printer };
        this.mostrarModal = true;
    }

    cerrarModal() {
        this.mostrarModal = false;
    }

    async guardar() {
        if (!this.formulario.nombre?.trim() || !this.formulario.ip?.trim()) {
            Swal.fire('Atención', 'Nombre e IP son obligatorios', 'warning');
            return;
        }

        this.isSaving = true;
        try {
            if (this.modoModal === 'crear') {
                await this.printService.crearImpresora(this.formulario as any);
                Swal.fire({ icon: 'success', title: 'Impresora registrada', timer: 1500, showConfirmButton: false });
            } else {
                await this.printService.actualizarImpresora(this.printerSeleccionada!.id, this.formulario);
                Swal.fire({ icon: 'success', title: 'Cambios guardados', timer: 1500, showConfirmButton: false });
            }
            this.cerrarModal();
            await this.cargarImpresoras();
        } catch (e: any) {
            Swal.fire('Error', e.message || 'No se pudo guardar', 'error');
        } finally {
            this.isSaving = false;
            this.cdr.detectChanges();
        }
    }

    async eliminar(printer: RestaurantPrinter) {
        const result = await Swal.fire({
            title: `¿Eliminar "${printer.nombre}"?`,
            text: 'Las categorías asignadas a esta impresora quedarán sin destino de impresión.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            confirmButtonColor: '#ef4444'
        });
        if (!result.isConfirmed) return;

        try {
            await this.printService.eliminarImpresora(printer.id);
            await this.cargarImpresoras();
        } catch (e: any) {
            Swal.fire('Error', e.message || 'No se pudo eliminar', 'error');
        }
    }

    async probarConexion(printer: RestaurantPrinter) {
        if (!this.agentUrl) {
            Swal.fire('Sin agente', 'Configura primero la URL del agente de impresión.', 'info');
            return;
        }
        this.testingId = printer.id;
        this.cdr.detectChanges();
        try {
            const ok = await this.printService.probarConexion(printer);
            Swal.fire({
                icon: ok ? 'success' : 'error',
                title: ok ? '¡Impresora alcanzable!' : 'Sin respuesta',
                text: ok
                    ? `${printer.ip}:${printer.puerto} respondió correctamente.`
                    : `No se pudo conectar a ${printer.ip}:${printer.puerto}. Verifica que el agente esté corriendo y la impresora encendida.`,
                timer: ok ? 2000 : undefined,
                showConfirmButton: !ok
            });
        } catch (e: any) {
            Swal.fire('Error', e.message, 'error');
        } finally {
            this.testingId = null;
            this.cdr.detectChanges();
        }
    }

    async guardarAgentUrl() {
        this.savingAgent = true;
        try {
            const url = this.agentUrl.trim().replace(/\/$/, '');
            // Persiste en localStorage como override rápido
            if (url) {
                localStorage.setItem('logos_print_agent_url', url);
            } else {
                localStorage.removeItem('logos_print_agent_url');
            }
            // Persiste en el negocio (Supabase) como valor permanente
            await this.negociosService.actualizarNegocio({ print_agent_url: url || null });
            Swal.fire({ icon: 'success', title: 'URL del agente guardada', timer: 1500, showConfirmButton: false });
        } catch (e: any) {
            Swal.fire('Error', e.message || 'No se pudo guardar la URL', 'error');
        } finally {
            this.savingAgent = false;
            this.cdr.detectChanges();
        }
    }

    tipoInfo(tipo: TipoImpresora): TipoInfo {
        return TIPOS.find(t => t.value === tipo) ?? TIPOS[TIPOS.length - 1];
    }

    toggleActiva(printer: RestaurantPrinter) {
        this.printService.actualizarImpresora(printer.id, { activa: !printer.activa })
            .then(() => this.cargarImpresoras())
            .catch(e => Swal.fire('Error', e.message, 'error'));
    }
}
