import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent, merge, Observable, of } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { db, VentaPendiente } from '../core/db/dexie.db';
import { CrearVenta } from '../models/ventas.model';

@Injectable({
    providedIn: 'root'
})
export class OfflineService {
    private onlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
    public online$ = this.onlineSubject.asObservable();

    private syncRequestSubject = new BehaviorSubject<void>(undefined);
    public syncRequest$ = this.syncRequestSubject.asObservable();

    private syncingSubject = new BehaviorSubject<boolean>(false);
    public syncing$ = this.syncingSubject.asObservable();

    constructor() {
        this.initConnectivityListeners();
    }

    private initConnectivityListeners() {
        merge(
            fromEvent(window, 'online').pipe(map(() => true)),
            fromEvent(window, 'offline').pipe(map(() => false))
        ).subscribe(isOnline => {
            this.onlineSubject.next(isOnline);
            if (isOnline) {
                console.log('🌐 Connection restored, preparing sync...');
                this.triggerSync();
            } else {
                console.log('📵 Connection lost, switching to local mode.');
            }
        });
    }

    triggerSync() {
        this.syncRequestSubject.next();
    }

    get isOnline(): boolean {
        return this.onlineSubject.value;
    }

    // Ventas
    async guardarVentaOffline(venta: CrearVenta): Promise<number> {
        const id = await db.ventasPendientes.add({
            data: venta,
            timestamp: new Date().toISOString()
        });
        console.log(`💾 Sale saved offline with ID: ${id}`);
        return id;
    }

    async obtenerVentasPendientes(): Promise<VentaPendiente[]> {
        return await db.ventasPendientes.toArray();
    }

    async eliminarVentaPendiente(id: number): Promise<void> {
        await db.ventasPendientes.delete(id);
    }

    setSyncing(status: boolean) {
        this.syncingSubject.next(status);
    }

    // Catálogo (Productos)
    async actualizarProductosLocales(productos: any[]): Promise<void> {
        await db.productos.clear();
        await db.productos.bulkAdd(productos);
    }

    async obtenerProductosLocales(): Promise<any[]> {
        return await db.productos.toArray();
    }

    // Categorías
    async actualizarCategoriasLocales(categorias: any[]): Promise<void> {
        await db.categorias.clear();
        await db.categorias.bulkAdd(categorias);
    }

    async obtenerCategoriasLocales(): Promise<any[]> {
        return await db.categorias.toArray();
    }

    // Clientes
    async actualizarClientesLocales(clientes: any[]): Promise<void> {
        await db.clientes.clear();
        await db.clientes.bulkAdd(clientes);
    }

    async obtenerClientesLocales(): Promise<any[]> {
        return await db.clientes.toArray();
    }
}
