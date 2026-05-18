import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PrintService } from '../../../services/print.service';
import { NegociosService } from '../../../services/negocios.service';
import { RestaurantPrinter, TipoImpresora, TipoConexionImpresora } from '../../../models/restaurant.models';
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
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './printers-admin.component.html',
    styleUrls: ['./printers-admin.component.css']
})
export class PrintersAdminComponent implements OnInit {

    impresoras: RestaurantPrinter[] = [];
    isLoading = false;
    isSaving = false;
    testingId: string | null = null;
    testPrintingId: string | null = null;

    mostrarModal = false;
    modoModal: 'crear' | 'editar' = 'crear';
    printerSeleccionada: RestaurantPrinter | null = null;

    formulario: Partial<RestaurantPrinter> = this.formularioVacio();

    // URL del agente de impresión local
    agentUrl = '';
    savingAgent = false;
    agentStatus: 'desconocido' | 'conectado' | 'desconectado' = 'desconocido';
    checkingAgent = false;

    // Impresoras Windows detectadas por el agente
    impresorasWindows: { Name: string; PortName: string }[] = [];
    cargandoWindows = false;

    tipos = TIPOS;
    readonly tiposConexion: { value: TipoConexionImpresora; label: string; icon: string }[] = [
        { value: 'red', label: 'Red / TCP-IP',  icon: 'fa-network-wired' },
        { value: 'usb', label: 'USB (local)',    icon: 'fa-plug' }
    ];

    constructor(
        private printService: PrintService,
        private negociosService: NegociosService,
        private cdr: ChangeDetectorRef
    ) {}

    async ngOnInit() {
        await this.cargarImpresoras();
        this.agentUrl = this.printService.agentUrl || '';
        if (this.agentUrl) await this.verificarAgente();
    }

    async verificarAgente(): Promise<void> {
        this.checkingAgent = true;
        this.cdr.detectChanges();
        try {
            const ok = await this.printService.verificarAgente();
            this.agentStatus = ok ? 'conectado' : 'desconectado';
        } catch {
            this.agentStatus = 'desconectado';
        } finally {
            this.checkingAgent = false;
            this.cdr.detectChanges();
        }
    }

    private formularioVacio(): Partial<RestaurantPrinter> {
        return {
            nombre: '',
            descripcion: '',
            tipo_conexion: 'red',
            ip: '',
            puerto: 9100,
            puerto_usb: '',
            tipo: 'cocina',
            caracteres_por_linea: 42,
            corte_automatico: true,
            copies: 1,
            activa: true
        };
    }

    get esUsb(): boolean { return this.formulario.tipo_conexion === 'usb'; }

    async detectarImpresorasWindows(): Promise<void> {
        if (!this.agentUrl) {
            Swal.fire('Sin agente', 'Guarda primero la URL del agente de impresión.', 'info');
            return;
        }
        this.cargandoWindows = true;
        this.cdr.detectChanges();
        try {
            this.impresorasWindows = await this.printService.listarImpresoras();
        } catch { this.impresorasWindows = []; }
        finally { this.cargandoWindows = false; this.cdr.detectChanges(); }
    }

    seleccionarImpresoraWindows(imp: { Name: string; PortName: string }): void {
        this.formulario.nombre     = this.formulario.nombre || imp.Name;
        this.formulario.puerto_usb = imp.PortName;
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
        const esUsb = this.formulario.tipo_conexion === 'usb';
        if (!this.formulario.nombre?.trim()) {
            Swal.fire('Atención', 'El nombre es obligatorio', 'warning'); return;
        }
        if (!esUsb && !this.formulario.ip?.trim()) {
            Swal.fire('Atención', 'La IP es obligatoria para impresoras de red', 'warning'); return;
        }
        if (esUsb && !this.formulario.puerto_usb?.trim()) {
            Swal.fire('Atención', 'Selecciona o escribe el puerto USB (ej: USB001)', 'warning'); return;
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
        // USB: no se puede hacer ping TCP, se prueba imprimiendo una línea de prueba
        if (printer.tipo_conexion === 'usb') {
            Swal.fire({
                icon: 'info',
                title: 'Impresora USB',
                text: `Las impresoras USB no soportan ping. Usa "Imprimir prueba" para verificar que funciona correctamente.`
            });
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
                    : `No se pudo conectar a ${printer.ip}:${printer.puerto}.`,
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
            if (url) {
                localStorage.setItem('logos_print_agent_url', url);
            } else {
                localStorage.removeItem('logos_print_agent_url');
            }
            await this.negociosService.actualizarNegocio({ print_agent_url: url || null });
            Swal.fire({ icon: 'success', title: 'URL del agente guardada', timer: 1500, showConfirmButton: false });
            if (url) await this.verificarAgente();
        } catch (e: any) {
            Swal.fire('Error', e.message || 'No se pudo guardar la URL', 'error');
        } finally {
            this.savingAgent = false;
            this.cdr.detectChanges();
        }
    }

    async imprimirPrueba(printer: RestaurantPrinter): Promise<void> {
        if (!this.agentUrl) {
            Swal.fire('Sin agente', 'Configura primero la URL del agente de impresión.', 'info');
            return;
        }
        this.testPrintingId = printer.id;
        this.cdr.detectChanges();
        try {
            const negocio = (this.negociosService as any)['negocioSubject']?.value?.nombre || 'LogosPOS';
            await this.printService.imprimirPrueba(printer, negocio);
            Swal.fire({ icon: 'success', title: '¡Impresión enviada!', text: `Prueba enviada a "${printer.nombre}".`, timer: 2000, showConfirmButton: false });
        } catch (e: any) {
            Swal.fire('Error de impresión', e.message, 'error');
        } finally {
            this.testPrintingId = null;
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
