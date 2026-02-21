export interface Mesa {
    id?: number;
    numero: string;
    estado: 'disponible' | 'ocupada' | 'mantenimiento';
    area?: string;
    created_at?: string;
}

export interface PedidoMesa {
    id?: number;
    mesa_id: number;
    usuario_id: number; // Quien abrió la cuenta
    cliente_id?: number | null;
    nombre_cliente?: string; // Alias para búsqueda rápida
    estado: 'abierto' | 'finalizado' | 'cancelado';
    total: number;
    created_at?: string;
    updated_at?: string;

    // Virtual field for UI
    mesa_numero?: string;
    detalles?: PedidoMesaDetalle[];
}

export interface PedidoMesaDetalle {
    id?: number;
    pedido_id: number;
    producto_id: number;
    producto_nombre: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    estado_pago: 'pendiente' | 'pagado'; // Para permitir pagos parciales
    estado_preparacion?: 'solicitado' | 'en_cocina' | 'listo' | 'entregado';
    notas?: string; // Ej: "Sin cebolla", "Bien cocido"
    created_at?: string;
}

export const ESTADOS_MESA = [
    { valor: 'disponible', etiqueta: 'Disponible', color: 'success' },
    { valor: 'ocupada', etiqueta: 'Ocupada', color: 'danger' },
    { valor: 'mantenimiento', etiqueta: 'Mantenimiento', color: 'warning' }
];
