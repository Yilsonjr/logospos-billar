import Dexie, { Table } from 'dexie';
import { Productos } from '../../models/productos.model';

export interface VentaPendiente {
    idLocal?: number;
    data: any;
    timestamp: string;
}

export class LicorPOSDatabase extends Dexie {
    productos!: Table<Productos>;
    categorias!: Table<{ id: number; nombre: string }>;
    clientes!: Table<any>;
    ventasPendientes!: Table<VentaPendiente>;
    metadata!: Table<{ key: string; value: any }>;

    constructor() {
        super('LicorPOSDatabase');

        this.version(1).stores({
            productos: 'id, nombre, categoria, sku, codigo_barras',
            categorias: 'id, nombre',
            clientes: 'id, nombre, cedula, rnc',
            ventasPendientes: '++idLocal, timestamp',
            metadata: 'key'
        });
    }
}

export const db = new LicorPOSDatabase();
