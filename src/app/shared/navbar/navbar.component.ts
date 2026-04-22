import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Subscription, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { OfflineService } from '../../services/offline.service';
import { NegociosService } from '../../services/negocios.service';
import { Usuario } from '../../models/usuario.model';
import { Negocio } from '../../models/negocio.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit, OnDestroy {
  public isMobileMenuOpen = false;
  public isCollapsed = false;
  public isMobile = false;
  public usuario: Usuario | null = null;
  public subscriptions: Subscription[] = [];
  public online$: Observable<boolean>;
  public isSyncing$: Observable<boolean>;
  public negocio: Negocio | null = null;

  quickActions = [
    { label: 'Nueva Venta', icon: 'fa-solid fa-plus-circle', link: '/ventas/nueva', permissions: ['ventas.crear'], color: '#3699ff', modulo: 'ventas' },
    { label: 'Mesas', icon: 'fa-solid fa-table-tennis-paddle-ball', link: '/ventas/mesas', permissions: ['ventas.crear'], color: '#ef4444', modulo: 'mesas' },
    { label: 'Cierre', icon: 'fa-solid fa-door-closed', link: '/caja/cierre', permissions: ['caja.cerrar'], color: '#f59e0b', modulo: 'caja' }
  ];

  constructor(
    private authService: AuthService,
    private sidebarService: SidebarService,
    private router: Router,
    private offlineService: OfflineService,
    private negociosService: NegociosService,
    private cdr: ChangeDetectorRef
  ) {
    this.isCollapsed = this.sidebarService.getCollapsed();
    this.online$ = this.offlineService.online$;
    this.isSyncing$ = this.offlineService.syncing$;
  }

  ngOnInit() {
    this.checkMobile();
    
    const sidebarSub = this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.isCollapsed = collapsed;
      this.cdr.detectChanges();
    });

    const authSub = this.authService.authState$.subscribe(authState => {
      this.usuario = authState.usuario;
      this.filtrarMenuPorPermisos();
      this.autoExpandActualRoute();
      this.cdr.detectChanges();
    });

    const routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.autoExpandActualRoute();
      this.cdr.detectChanges();
    });

    const negocioSub = this.negociosService.negocio$.subscribe((data: Negocio | null) => {
      this.negocio = data;
      this.filtrarMenuPorPermisos(); // 💡 Re-filtrar cuando cambien los módulos del negocio
      this.cdr.detectChanges();
    });

    this.subscriptions.push(sidebarSub, authSub, routerSub, negocioSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  menuItems = [
    {
      label: 'Dashboard',
      icon: 'fa-solid fa-chart-line',
      link: '/dashboard',
      active: false,
      permissions: ['dashboard.ver'],
      modulo: 'dashboard'
    },
    {
      label: 'Inventario',
      icon: 'fa-solid fa-boxes-stacked',
      link: '/inventario',
      active: false,
      permissions: ['inventario.ver'],
      modulo: 'inventario',
      submenu: [
        { label: 'Productos', link: '/inventario', icon: 'fa-solid fa-box', permissions: ['inventario.ver'] }
      ],
      expanded: false
    },
    {
      label: 'Compras',
      icon: 'fa-solid fa-shopping-bag',
      link: '/compras',
      active: false,
      permissions: ['inventario.ver'],
      modulo: 'compras',
      submenu: [
        { label: 'Lista de Compras', link: '/compras', icon: 'fa-solid fa-list', permissions: ['inventario.ver'] },
        { label: 'Nueva Compra', link: '/compras/nueva', icon: 'fa-solid fa-plus-circle', permissions: ['inventario.crear'] },
        { label: 'Proveedores', link: '/inventario/proveedores', icon: 'fa-solid fa-truck', permissions: ['proveedores.ver'] }
      ],
      expanded: false
    },
    {
      label: 'Ventas',
      icon: 'fa-solid fa-shopping-cart',
      link: '/ventas',
      active: false,
      permissions: ['ventas.ver'],
      modulo: 'ventas',
      submenu: [
        { label: 'Nueva Transaccion', link: '/ventas/nueva', icon: 'fa-solid fa-plus-circle', permissions: ['ventas.crear'] },
        { label: 'Mesas', link: '/ventas/mesas', icon: 'fa-solid fa-table-tennis-paddle-ball', permissions: ['ventas.crear'], modulo: 'mesas' },
        { label: 'Historial', link: '/ventas/historial', icon: 'fa-solid fa-clock-rotate-left', permissions: ['ventas.historial'] }
      ],
      expanded: false
    },
    {
      label: 'Caja',
      icon: 'fa-solid fa-cash-register',
      link: '/caja',
      active: false,
      permissions: ['caja.ver'],
      modulo: 'caja',
      submenu: [
        { label: 'Apertura de Caja', link: '/caja/apertura', icon: 'fa-solid fa-door-open', permissions: ['caja.abrir'] },
        { label: 'Cierre de Caja', link: '/caja/cierre', icon: 'fa-solid fa-door-closed', permissions: ['caja.cerrar'] },
        { label: 'Salida de Efectivo', link: '/caja/salida-efectivo', icon: 'fa-solid fa-money-bill-transfer', permissions: ['caja.movimientos'] },
        { label: 'Entrada de Efectivo', link: '/caja/entrada-efectivo', icon: 'fa-solid fa-hand-holding-dollar', permissions: ['caja.movimientos'] },
        { label: 'Arqueo de Caja', link: '/caja/arqueo', icon: 'fa-solid fa-calculator', permissions: ['caja.arqueo'] },
        { label: 'Historial de Movimientos', link: '/caja/historial', icon: 'fa-solid fa-list-ul', permissions: ['caja.historial'] }
      ],
      expanded: false
    },
    {
      label: 'Clientes',
      icon: 'fa-solid fa-users',
      link: '/clientes',
      active: false,
      permissions: ['clientes.ver'],
      modulo: 'clientes'
    },
    {
      label: 'Cuentas por Cobrar',
      icon: 'fa-solid fa-money-bill-trend-up',
      link: '/cuentas-cobrar',
      active: false,
      permissions: ['cuentas.ver'],
      modulo: 'cuentas_cobrar',
      submenu: [
        { label: 'Cuentas Pendientes', link: '/cuentas-cobrar', icon: 'fa-solid fa-hourglass-half', permissions: ['cuentas.ver'] },
        { label: 'Recordatorios', link: '/cuentas-cobrar/recordatorios', icon: 'fa-solid fa-bell', permissions: ['cuentas.recordatorios'] }
      ],
      expanded: false
    },
    {
      label: 'Cuentas por Pagar',
      icon: 'fa-solid fa-file-invoice-dollar',
      link: '/cuentas-pagar',
      active: false,
      permissions: ['cuentas.ver'],
      modulo: 'cuentas_pagar',
      submenu: [
        { label: 'Deudas Pendientes', link: '/cuentas-pagar', icon: 'fa-solid fa-exclamation-triangle', permissions: ['cuentas.ver'] },
        { label: 'Nueva Cuenta', link: '/cuentas-pagar/nueva', icon: 'fa-solid fa-plus-circle', permissions: ['cuentas.crear'] }
      ],
      expanded: false
    },
    {
      label: 'Administración',
      icon: 'fa-solid fa-user-gear',
      link: '/admin',
      active: false,
      permissions: ['usuarios.ver', 'roles.ver', 'config.general'],
      submenu: [
        { label: 'Identidad del Negocio', link: '/admin/negocio', icon: 'fa-solid fa-id-card', permissions: ['config.general'], modulo: 'identidad' },
        { label: 'Usuarios', link: '/admin/usuarios', icon: 'fa-solid fa-users', permissions: ['usuarios.ver'], modulo: 'usuarios' },
        { label: 'Roles', link: '/admin/roles', icon: 'fa-solid fa-user-tag', permissions: ['roles.ver'], modulo: 'roles' },
        { label: 'Sistema', link: '/admin/sistema', icon: 'fa-solid fa-cogs', permissions: ['config.general'], modulo: 'sistema' },
        { label: 'Gestión de Negocios', link: '/admin/developer/negocios', icon: 'fa-solid fa-server', permissions: ['config.general'], superAdminOnly: true },
        { label: 'Fiscal (DGII)', link: '/admin/fiscal', icon: 'fa-solid fa-file-invoice', permissions: ['config.general'], modulo: 'fiscal' }
      ],
      expanded: false
    },
    {
      label: 'Reportes',
      icon: 'fa-solid fa-chart-bar',
      link: '/reportes',
      active: false,
      permissions: ['reportes.ventas', 'reportes.inventario', 'reportes.caja', 'reportes.clientes'],
      modulo: 'reportes',
      submenu: [
        { label: 'Reportes de Ventas', link: '/reportes/ventas', icon: 'fa-solid fa-chart-line', permissions: ['reportes.ventas'] },
        { label: 'Reportes de Inventario', link: '/reportes/inventario', icon: 'fa-solid fa-boxes-stacked', permissions: ['reportes.inventario'] },
        { label: 'Reportes de Caja', link: '/reportes/caja', icon: 'fa-solid fa-cash-register', permissions: ['reportes.caja'] },
        { label: 'Reportes de Clientes', link: '/reportes/clientes', icon: 'fa-solid fa-users', permissions: ['reportes.clientes'] }
      ],
      expanded: false
    }
  ];

  menuItemsFiltrados: any[] = [];
  quickActionsFiltrados: any[] = [];

  filtrarMenuPorPermisos() {
    if (!this.usuario) {
      this.menuItemsFiltrados = [];
      this.quickActionsFiltrados = [];
      return;
    }

    const esSuperAdmin = this.authService.isSuperAdmin();

    this.quickActionsFiltrados = this.quickActions.filter(action => {
      const tienePermiso = action.permissions.some((p: string) => this.authService.tienePermiso(p));
      const tieneModulo = !action.modulo || this.negociosService.tieneModulo(action.modulo as any); 
      
      // El Desarrollador Global (Dev) siempre tiene acceso a todo para soporte
      if (esSuperAdmin) return true;
      
      return tienePermiso && tieneModulo;
    });

    this.menuItemsFiltrados = this.menuItems.map(item => ({ 
      ...item,
      submenu: item.submenu ? [...item.submenu] : undefined 
    })).filter(item => {
      const tienePermisoItem = !item.permissions ||
        item.permissions.some((permiso: string) => this.authService.tienePermiso(permiso));

      if (!tienePermisoItem) return false;

      // El Desarrollador Global (Dev) siempre ve todo el menú
      if (esSuperAdmin) return true;

      // Si el ítem tiene módulo, verificamos si el negocio lo tiene activo
      const esAdminNegocio = this.authService.tienePermiso('admin');
      const esModuloCore = ((item as any).modulo === 'dashboard' || item.label.includes('Administración'));

      if ((item as any).modulo && !this.negociosService.tieneModulo((item as any).modulo)) {
        // PERMISO ESPECIAL: El administrador del negocio siempre ve el Dashboard y Administración
        if (!esAdminNegocio || !esModuloCore) {
          return false;
        }
      }

      if (item.submenu) {
        // Filtramos una copia del submenu para no mutar el array original
        item.submenu = item.submenu.filter((subitem: any) => {
          const tienePermisoSub = !subitem.permissions ||
            subitem.permissions.some((permiso: string) => this.authService.tienePermiso(permiso));
          if (!tienePermisoSub) return false;

          if (subitem.superAdminOnly && !esSuperAdmin) return false;

          // Respetar módulos activos excepto para Desarrollador Global
          if (!esSuperAdmin && subitem.modulo && !this.negociosService.tieneModulo(subitem.modulo)) {
             // Bypass para los submenús de módulos Core si es Admin del Negocio
             if (!esAdminNegocio || !esModuloCore) {
               return false;
             }
          }

          return true;
        });

        if (item.submenu.length === 0) return false;
      }

      return true;
    });
    this.cdr.detectChanges();
  }

  autoExpandActualRoute() {
    const currentUrl = this.router.url;
    this.menuItemsFiltrados.forEach(item => {
      if (item.submenu) {
        const isChildActive = item.submenu.some((sub: any) => currentUrl.startsWith(sub.link));
        if (isChildActive) {
          item.expanded = true;
        }
      }
    });
    this.cdr.detectChanges();
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    this.cdr.detectChanges();
  }

  toggleSidebar() {
    this.sidebarService.toggleSidebar();
  }

  toggleSubmenu(item: any) {
    item.expanded = (!this.isCollapsed || this.isMobile) && !item.expanded;
    this.cdr.detectChanges();
  }

  @HostListener('window:resize')
  onResize() {
    this.checkMobile();
  }

  private checkMobile() {
    this.isMobile = window.innerWidth <= 992;
    this.cdr.detectChanges();
  }

  handleMenuClick(event: Event, item: any) {
    if (item.submenu) {
      event.preventDefault();

      if (this.isCollapsed) {
        this.sidebarService.setCollapsed(false);
        setTimeout(() => {
          item.expanded = true;
          this.cdr.detectChanges();
        }, 100);
      } else {
        this.toggleSubmenu(item);
      }
    }
  }

  irAPerfil() {
    this.router.navigate(['/perfil']);
  }

  async cerrarSesion() {
    await this.authService.logout();
  }

  obtenerIniciales(): string {
    if (!this.usuario) return 'U';
    return `${this.usuario.nombre.charAt(0)}${this.usuario.apellido.charAt(0)}`.toUpperCase();
  }

  obtenerColorRol(): string {
    return this.usuario?.rol?.color || '#3b82f6';
  }

  obtenerPrimerNombre(): string {
    return this.usuario?.nombre ? this.usuario.nombre.split(' ')[0] : 'Usuario';
  }
}