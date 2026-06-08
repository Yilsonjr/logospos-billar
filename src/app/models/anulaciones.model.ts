export type MotivoAnulacion =
  | 'error_cobro'
  | 'devolucion'
  | 'pedido_duplicado'
  | 'error_precio'
  | 'cliente_solicitud'
  | 'otro';

export const MOTIVOS_ANULACION: { valor: MotivoAnulacion; etiqueta: string }[] = [
  { valor: 'error_cobro',        etiqueta: 'Error en el cobro'         },
  { valor: 'devolucion',         etiqueta: 'Devolución del cliente'    },
  { valor: 'pedido_duplicado',   etiqueta: 'Pedido duplicado'          },
  { valor: 'error_precio',       etiqueta: 'Error en el precio'        },
  { valor: 'cliente_solicitud',  etiqueta: 'Solicitud del cliente'     },
  { valor: 'otro',               etiqueta: 'Otro motivo'               },
];

export interface Anulacion {
  id?: number;
  negocio_id: string;
  venta_id?: number | null;
  order_payment_id?: string | null;
  ncf_original?: string | null;
  tipo_ncf_original?: string | null;
  ncf_nota_credito?: string | null;
  tiene_nota_credito: boolean;
  motivo_categoria: MotivoAnulacion;
  motivo_detalle?: string | null;
  usuario_id?: string | null;
  created_at?: string;
}
