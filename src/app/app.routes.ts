import { Routes } from '@angular/router';
import { Inventario } from './pages/inventario/inventario.component';
import { Dashboard } from './pages/dashboard/dashboard';
import { ProveedoresComponent } from './pages/inventario/proveedores/proveedores.component';
import { ComprasComponent } from './pages/compras/compras.component';
import { NuevaCompraComponent } from './pages/compras/nueva-compra/nueva-compra.component';
import { DetalleCompraComponent } from './pages/compras/detalle-compra/detalle-compra.component';
import { ClientesComponent } from './pages/clientes/clientes.component';
import { PosComponent } from './pages/ventas/pos/pos.component';
import { MesasComponent } from './pages/ventas/mesas/mesas.component';
import { HistorialVentasComponent } from './pages/ventas/historial/historial-ventas.component';
import { CuentasCobrarComponent } from './pages/cuentas-cobrar/cuentas-cobrar.component';
import { RecordatoriosComponent } from './pages/cuentas-cobrar/recordatorios/recordatorios';
import { CuentasPagarComponent } from './pages/cuentas-pagar/cuentas-pagar.component';
import { NuevaCuentaComponent } from './pages/cuentas-pagar/nueva-cuenta/nueva-cuenta.component';
import { DetalleCuentaPagarComponent } from './pages/cuentas-pagar/detalle/detalle-cuenta-pagar.component';
import { PlanPagosComponent } from './pages/cuentas-pagar/plan-pagos/plan-pagos.component';
import { AperturaCajaComponent } from './pages/caja/apertura/apertura-caja.component';
import { CierreCajaComponent } from './pages/caja/cierre/cierre-caja.component';
import { MovimientoCajaComponent } from './pages/caja/movimiento/movimiento-caja.component';
import { ArqueoCajaComponent } from './pages/caja/arqueo/arqueo-caja.component';
import { HistorialCajaComponent } from './pages/caja/historial/historial-caja.component';

// Componentes de Autenticación
import { LoginComponent } from './pages/auth/login/login.component';
import { PerfilComponent } from './pages/auth/perfil/perfil.component';
import { UsuariosComponent } from './pages/admin/usuarios/usuarios.component';
import { RolesComponent } from './pages/admin/roles/roles.component';
import { SistemaComponent } from './pages/admin/sistema/sistema.component';
import { ConfiguracionFiscalComponent } from './pages/admin/configuracion-fiscal/configuracion-fiscal.component';

// Componentes de Reportes
import { ReportesVentasComponent } from './pages/reportes/ventas/reportes-ventas.component';
import { ReportesInventarioComponent } from './pages/reportes/inventario/reportes-inventario.component';
import { ReportesCajaComponent } from './pages/reportes/caja/reportes-caja.component';
import { ReportesClientesComponent } from './pages/reportes/clientes/reportes-clientes.component';

// Guards
import { AuthGuard } from './guards/auth.guard';
import { PermissionGuard } from './guards/permission.guard';

export const routes: Routes = [
    // Ruta de Login (sin protección)
    { path: 'login', component: LoginComponent },


    // Rutas protegidas con autenticación
    {
        path: 'dashboard',
        component: Dashboard,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['dashboard.ver'] }
    },

    // Inventario
    {
        path: 'inventario',
        component: Inventario,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['inventario.ver'] }
    },
    {
        path: 'inventario/proveedores',
        component: ProveedoresComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['proveedores.ver'] }
    },

    // Compras
    {
        path: 'compras',
        component: ComprasComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['inventario.ver'] }
    },
    {
        path: 'compras/nueva',
        component: NuevaCompraComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['inventario.crear'] }
    },
    {
        path: 'compras/:id',
        component: DetalleCompraComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['inventario.ver'] }
    },

    // Clientes
    {
        path: 'clientes',
        component: ClientesComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['clientes.ver'] }
    },

    // Ventas
    {
        path: 'ventas/nueva',
        component: PosComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['ventas.crear'] }
    },
    {
        path: 'ventas/mesas',
        component: MesasComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['ventas.crear'] }
    },
    {
        path: 'ventas/historial',
        component: HistorialVentasComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['ventas.historial'] }
    },

    // Caja
    {
        path: 'caja/apertura',
        component: AperturaCajaComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['caja.abrir'] }
    },
    {
        path: 'caja/cierre',
        component: CierreCajaComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['caja.cerrar'] }
    },
    {
        path: 'caja/entrada-efectivo',
        component: MovimientoCajaComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['caja.movimientos'] }
    },
    {
        path: 'caja/salida-efectivo',
        component: MovimientoCajaComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['caja.movimientos'] }
    },
    {
        path: 'caja/arqueo',
        component: ArqueoCajaComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['caja.arqueo'] }
    },
    {
        path: 'caja/historial',
        component: HistorialCajaComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['caja.historial'] }
    },

    // Cuentas por Cobrar
    {
        path: 'cuentas-cobrar',
        component: CuentasCobrarComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['cuentas.ver'] }
    },
    {
        path: 'cuentas-cobrar/recordatorios',
        component: RecordatoriosComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['cuentas.recordatorios'] }
    },

    // Cuentas por Pagar
    {
        path: 'cuentas-pagar',
        component: CuentasPagarComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['cuentas.ver'] }
    },
    {
        path: 'cuentas-pagar/nueva',
        component: NuevaCuentaComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['cuentas.crear'] }
    },
    {
        path: 'cuentas-pagar/editar/:id',
        component: NuevaCuentaComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['cuentas.editar'] }
    },
    {
        path: 'cuentas-pagar/detalle/:id',
        component: DetalleCuentaPagarComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['cuentas.ver'] }
    },
    {
        path: 'cuentas-pagar/plan-pagos',
        component: PlanPagosComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['cuentas.ver'] }
    },

    // Perfil de Usuario
    {
        path: 'perfil',
        component: PerfilComponent,
        canActivate: [AuthGuard]
    },

    // Reportes
    {
        path: 'reportes/ventas',
        component: ReportesVentasComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['reportes.ventas'] }
    },
    {
        path: 'reportes/inventario',
        component: ReportesInventarioComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['reportes.inventario'] }
    },
    {
        path: 'reportes/caja',
        component: ReportesCajaComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['reportes.caja'] }
    },
    {
        path: 'reportes/clientes',
        component: ReportesClientesComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['reportes.clientes'] }
    },
    {
        path: 'reportes',
        redirectTo: 'reportes/ventas',
        pathMatch: 'full'
    },

    // Administración
    {
        path: 'admin/usuarios',
        component: UsuariosComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['usuarios.ver'] }
    },
    {
        path: 'admin/roles',
        component: RolesComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['roles.ver'] }
    },
    {
        path: 'admin/sistema',
        component: SistemaComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['config.general'] }
    },
    {
        path: 'admin/fiscal',
        component: ConfiguracionFiscalComponent,
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['config.general'] }
    },

    // Redirecciones
    { path: '', redirectTo: 'ventas/mesas', pathMatch: 'full' },
    { path: '**', redirectTo: 'ventas/mesas' }
];
