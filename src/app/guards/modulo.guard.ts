import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { NegociosService, ModuloSistema } from '../services/negocios.service';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class ModuloGuard implements CanActivate {

  constructor(
    private negociosService: NegociosService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    
    // El módulo requerido se define en la data de la ruta
    const moduloRequerido = route.data['modulo'] as ModuloSistema;

    // Si la ruta no especifica un módulo, permitimos el acceso
    if (!moduloRequerido) {
      return true;
    }

    // Verificamos si el negocio tiene el módulo activo
    // Usamos el observable del negocio para asegurar que tenemos los datos más recientes
    return this.negociosService.negocio$.pipe(
      take(1),
      map(negocio => {
        // Si no hay negocio cargado (raro si pasó el AuthGuard), permitimos por ahora
        // pero cargamos los datos por si acaso
        if (!negocio) {
          return true;
        }

        const tieneAcceso = this.negociosService.tieneModulo(moduloRequerido);

        if (!tieneAcceso) {
          Swal.fire({
            title: '🚫 Módulo no activo',
            text: `El módulo "${this.obtenerNombreModulo(moduloRequerido)}" no está habilitado para su plan o negocio actual.`,
            icon: 'warning',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#3699ff'
          });
          
          // Redirigir al dashboard
          this.router.navigate(['/dashboard']);
          return false;
        }

        return true;
      })
    );
  }

  /**
   * Retorna un nombre amigable para el módulo en el mensaje de error
   */
  private obtenerNombreModulo(modulo: ModuloSistema): string {
    const nombres: Record<string, string> = {
      'ventas': 'Ventas',
      'inventario': 'Inventario',
      'caja': 'Caja Registradora',
      'clientes': 'Gestión de Clientes',
      'mesas': 'Mesas y Pedidos',
      'cocina': 'Pantalla de Cocina',
      'cuentas_cobrar': 'Cuentas por Cobrar',
      'cuentas_pagar': 'Cuentas por Pagar',
      'compras': 'Compras',
      'proveedores': 'Proveedores',
      'fiscal': 'Facturación Fiscal (DGII)',
      'usuarios': 'Gestión de Usuarios',
      'reportes': 'Reportes y Estadísticas'
    };
    return nombres[modulo] || modulo;
  }
}
