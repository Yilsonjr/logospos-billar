import { Injectable } from '@angular/core';
import { NegociosService, Negocio } from './negocios.service';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

export interface EstadoLicencia {
    bloqueado: boolean;
    mensaje: string | null;
    diasRestantes: number | null;
    tipo: 'activa' | 'vencida' | 'suspendida';
    plan: string;
}

@Injectable({
    providedIn: 'root'
})
export class LicenciaService {
    private estadoSubject = new BehaviorSubject<EstadoLicencia>({
        bloqueado: false,
        mensaje: null,
        diasRestantes: null,
        tipo: 'activa',
        plan: 'basico'
    });
    public estado$ = this.estadoSubject.asObservable();

    constructor(private negociosService: NegociosService) {
        this.negociosService.negocioActual$.subscribe(negocio => {
            if (negocio) {
                this.procesarEstadoNegocio(negocio);
            }
        });
    }

    private procesarEstadoNegocio(negocio: Negocio) {
        let bloqueado = false;
        let mensaje = null;
        let diasRestantes = null;

        // 1. Verificar suspensión manual
        if (negocio.estado_licencia === 'suspendida') {
            bloqueado = true;
            mensaje = 'Su acceso ha sido suspendido por el administrador del sistema.';
        }

        // 2. Verificar vencimiento (SaaS)
        if (negocio.fecha_vencimiento) {
            const hoy = new Date();
            const vencimiento = new Date(negocio.fecha_vencimiento);
            const diffTime = vencimiento.getTime() - hoy.getTime();
            diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diasRestantes <= 0) {
                // Bloqueo si pasó la fecha (puedes añadir días de gracia aquí)
                bloqueado = true;
                mensaje = 'Su suscripción ha vencido. Por favor, renueve su plan para continuar.';
            } else if (diasRestantes <= 7) {
                mensaje = `Su suscripción vencerá en ${diasRestantes} días.`;
            }
        }

        this.estadoSubject.next({
            bloqueado,
            mensaje,
            diasRestantes,
            tipo: negocio.estado_licencia,
            plan: negocio.plan_tipo
        });
    }

    /**
     * Helper para saber si el negocio actual tiene acceso a features Pro
     */
    get esPro(): boolean {
        const s = this.estadoSubject.value;
        return s.plan === 'pro' || s.plan === 'profesional' || s.plan === 'perpetual';
    }
}
