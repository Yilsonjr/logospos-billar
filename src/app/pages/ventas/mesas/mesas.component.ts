import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MesasService } from '../../../services/mesas.service';
import { PedidosMesaService } from '../../../services/pedidos-mesa.service';
import { AuthService } from '../../../services/auth.service';
import { Mesa, PedidoMesa, ESTADOS_MESA } from '../../../models/mesa.model';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { TicketPrecuentaComponent } from '../../../shared/ticket-precuenta/ticket-precuenta.component';

@Component({
    selector: 'app-mesas',
    standalone: true,
    imports: [CommonModule, FormsModule, TicketPrecuentaComponent],
    templateUrl: './mesas.component.html',
    styleUrls: ['./mesas.component.css']
})
export class MesasComponent implements OnInit, OnDestroy {
    mesas: Mesa[] = [];
    pedidosActivos: PedidoMesa[] = [];
    isLoading = false;
    estadosMesa = ESTADOS_MESA;
    private subscriptions: Subscription[] = [];
    menuAbierto: number | null = null; // ID de la mesa con el menú abierto
    busquedaMesa: string = '';

    // Pre-cuenta
    mostrarPrecuenta: boolean = false;
    pedidoParaPrecuenta?: PedidoMesa;

    constructor(
        private mesasService: MesasService,
        private pedidosMesaService: PedidosMesaService,
        private authService: AuthService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        const mesasSub = this.mesasService.mesas$.subscribe(mesas => {
            this.mesas = mesas;
            this.cdr.detectChanges();
        });

        const pedidosSub = this.pedidosMesaService.pedidosActivos$.subscribe(pedidos => {
            this.pedidosActivos = pedidos;
            this.cdr.detectChanges();
        });

        this.subscriptions.push(mesasSub, pedidosSub);

        // Cargar datos inmediatamente al entrar
        this.cargarDatos();
    }

    ngOnDestroy() {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    contarMesasPorEstado(estado: string): number {
        return this.mesas.filter(m => m.estado === estado).length;
    }

    get mesasFiltradas(): Mesa[] {
        if (!this.busquedaMesa) return this.mesas;

        const search = this.busquedaMesa.toLowerCase();
        return this.mesas.filter(m => {
            const pedido = this.getPedidoMesa(m.id!);
            const matchesNumero = m.numero.toString().includes(search);
            const matchesCliente = pedido?.nombre_cliente?.toLowerCase().includes(search);
            return matchesNumero || matchesCliente;
        });
    }

    async cargarDatos() {
        this.isLoading = true;
        try {
            await Promise.all([
                this.mesasService.cargarMesas(),
                this.pedidosMesaService.cargarPedidosActivos()
            ]);
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    getPedidoMesa(mesaId: number): PedidoMesa | undefined {
        return this.pedidosActivos.find(p => p.mesa_id === mesaId);
    }

    async ocuparMesa(mesa: Mesa) {
        if (mesa.estado !== 'disponible') return;

        const usuarioId = this.authService.usuarioActual?.id;
        if (!usuarioId) return;

        const { value: nombreCliente } = await Swal.fire({
            title: 'Ocupar Mesa ' + mesa.numero,
            input: 'text',
            inputLabel: 'Nombre del Cliente (Opcional)',
            inputPlaceholder: 'Ej: Juan Perez, Grupo VIP...',
            showCancelButton: true,
            confirmButtonText: 'Ocupar',
            cancelButtonText: 'Cancelar'
        });

        // Si el usuario cancela el prompt (undefined), no hacemos nada
        if (nombreCliente === undefined) return;

        try {
            await this.pedidosMesaService.abrirPedidoMesa(mesa.id!, usuarioId, nombreCliente);
            await Swal.fire({
                title: 'Mesa Ocupada',
                text: `Mesa ${mesa.numero} abierta correctamente`,
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            await Swal.fire('Error', 'No se pudo ocupar la mesa', 'error');
        }
    }

    async seleccionarMesa(mesa: Mesa) {
        if (mesa.estado === 'disponible') {
            await this.ocuparMesa(mesa);
        } else if (mesa.estado === 'ocupada') {
            const result = await Swal.fire({
                title: `Mesa ${mesa.numero}`,
                html: `
                    <div class="d-grid gap-3 p-2">
                        <button id="add-items" class="btn btn-primary btn-lg py-3 d-flex flex-column align-items-center">
                            <i class="fa-solid fa-plus-circle fa-2x mb-2"></i>
                            <span class="fw-bold">Agregar Productos</span>
                            <small class="opacity-75">Cervezas, tragos, comida...</small>
                        </button>
                        <button id="close-account" class="btn btn-success btn-lg py-3 d-flex flex-column align-items-center">
                            <i class="fa-solid fa-receipt fa-2x mb-2"></i>
                            <span class="fw-bold">Cerrar Cuenta</span>
                            <small class="opacity-75">Ir a facturación y pago</small>
                        </button>
                        <button id="print-precuenta" class="btn btn-outline-info btn-lg py-3 d-flex flex-column align-items-center">
                            <i class="fa-solid fa-print fa-2x mb-2"></i>
                            <span class="fw-bold">Imprimir Pre-cuenta</span>
                            <small class="opacity-75">Ticket informativo para el mesa</small>
                        </button>
                        <hr class="my-1">
                        <button id="release-error" class="btn btn-outline-warning btn-lg py-2 rounded-3 fw-bold">
                            <i class="fa-solid fa-unlock me-2"></i>
                            Liberar por Error / Cancelar
                        </button>
                    </div>
                `,
                showConfirmButton: false,
                showCancelButton: true,
                cancelButtonText: 'Cerrar',
                didOpen: () => {
                    const addBtn = document.getElementById('add-items');
                    const closeBtn = document.getElementById('close-account');
                    const releaseBtn = document.getElementById('release-error');

                    addBtn?.addEventListener('click', () => {
                        Swal.close();
                        this.verCuenta(mesa.id!);
                    });

                    closeBtn?.addEventListener('click', () => {
                        Swal.close();
                        this.verCuenta(mesa.id!);
                    });

                    const printBtn = document.getElementById('print-precuenta');
                    printBtn?.addEventListener('click', () => {
                        Swal.close();
                        this.imprimirPrecuenta(mesa.id!);
                    });

                    releaseBtn?.addEventListener('click', () => {
                        Swal.close();
                        this.liberarMesa(mesa);
                    });
                }
            });
        }
    }

    verCuenta(mesaId: number) {
        const pedido = this.getPedidoMesa(mesaId);
        if (pedido) {
            // Redirigir al POS con el contexto de la mesa
            this.router.navigate(['/ventas/nueva'], { queryParams: { mesaId, pedidoId: pedido.id } });
        }
    }

    imprimirPrecuenta(mesaId: number) {
        const pedido = this.getPedidoMesa(mesaId);
        if (pedido) {
            this.pedidoParaPrecuenta = pedido;
            this.mostrarPrecuenta = true;
            this.cdr.detectChanges();
        }
    }

    // --- CRUD de Mesas ---

    async nuevaMesa() {
        const { value: formValues } = await Swal.fire({
            title: 'Nueva Mesa',
            html: `
                <input id="swal-numero" class="swal2-input" placeholder="Número de mesa">
                <input id="swal-area" class="swal2-input" placeholder="Área (Terraza, Segundo Piso, etc.)">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Crear',
            preConfirm: () => {
                const numero = (document.getElementById('swal-numero') as HTMLInputElement).value;
                const area = (document.getElementById('swal-area') as HTMLInputElement).value;
                if (!numero) {
                    Swal.showValidationMessage('El número es obligatorio');
                }
                return { numero, area };
            }
        });

        if (formValues) {
            try {
                await this.mesasService.crearMesa({
                    numero: formValues.numero,
                    area: formValues.area,
                    estado: 'disponible'
                });
                await Swal.fire('Creada', 'Mesa creada correctamente', 'success');
            } catch (error) {
                await Swal.fire('Error', 'No se pudo crear la mesa', 'error');
            }
        }
    }

    async editarMesa(mesa: Mesa) {
        if (mesa.estado === 'ocupada') {
            await Swal.fire('Acción Prohibida', 'No puedes editar una mesa ocupada', 'warning');
            return;
        }

        const { value: formValues } = await Swal.fire({
            title: 'Editar Mesa',
            html: `
                <input id="swal-numero" class="swal2-input" placeholder="Número" value="${mesa.numero}">
                <input id="swal-area" class="swal2-input" placeholder="Área" value="${mesa.area || ''}">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            preConfirm: () => {
                const numero = (document.getElementById('swal-numero') as HTMLInputElement).value;
                const area = (document.getElementById('swal-area') as HTMLInputElement).value;
                return { numero, area };
            }
        });

        if (formValues) {
            try {
                await this.mesasService.actualizarMesa(mesa.id!, {
                    numero: formValues.numero,
                    area: formValues.area
                });
                await Swal.fire('Actualizada', 'Datos actualizados', 'success');
            } catch (error) {
                await Swal.fire('Error', 'No se pudo actualizar', 'error');
            }
        }
    }

    async eliminarMesa(mesa: Mesa) {
        if (mesa.estado === 'ocupada') {
            await Swal.fire('Error', 'No se puede eliminar una mesa ocupada', 'error');
            return;
        }

        const confirm = await Swal.fire({
            title: '¿Eliminar Mesa?',
            text: `¿Estás seguro de eliminar la mesa ${mesa.numero}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Sí, eliminar'
        });

        if (confirm.isConfirmed) {
            try {
                await this.mesasService.eliminarMesa(mesa.id!);
                await Swal.fire('Eliminada', 'La mesa ha sido borrada', 'success');
            } catch (error) {
                await Swal.fire('Error', 'Hubo un problema al eliminar', 'error');
            }
        }
    }

    async liberarMesa(mesa: Mesa) {
        const pedido = this.getPedidoMesa(mesa.id!);
        if (!pedido) return;

        const confirm = await Swal.fire({
            title: '¿Liberar Mesa?',
            text: `Se cancelará la comanda actual de la mesa ${mesa.numero}. Esta acción no se puede deshacer.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ffc107',
            confirmButtonText: 'Sí, liberar mesa',
            cancelButtonText: 'No, mantener'
        });

        if (confirm.isConfirmed) {
            try {
                await this.pedidosMesaService.cancelarPedido(pedido.id!, mesa.id!);
                await Swal.fire('Mesa Liberada', 'La mesa ahora está disponible', 'success');
            } catch (error) {
                await Swal.fire('Error', 'No se pudo liberar la mesa', 'error');
            }
        }
    }

    canManage(): boolean {
        const rol = this.authService.usuarioActual?.rol?.nombre;
        return rol === 'Super Administrador' || rol === 'Administrador' || rol === 'Admin';
    }

    toggleMenu(mesaId: number, event: Event) {
        event.stopPropagation();
        this.menuAbierto = this.menuAbierto === mesaId ? null : mesaId;
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        this.menuAbierto = null;
    }
}
