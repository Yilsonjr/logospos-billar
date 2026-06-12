export interface Gasto {
  id?: number;
  negocio_id?: string;
  categoria: string;
  subcategoria?: string;
  descripcion: string;
  proveedor?: string;
  numero_comprobante?: string;
  monto: number;
  metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia' | 'cheque';
  fecha: string;
  caja_id?: number | null;
  movimiento_caja_id?: number | null;
  usuario_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type CrearGasto = Omit<Gasto, 'id' | 'negocio_id' | 'created_at' | 'updated_at'>;

export interface ResumenGastos {
  total_mes: number;
  total_semana: number;
  total_hoy: number;
  cantidad_registros: number;
  por_categoria: { categoria: string; total: number }[];
}

export interface FiltrosGastos {
  fecha_desde?: string;
  fecha_hasta?: string;
  categoria?: string;
  metodo_pago?: string;
  busqueda?: string;
}

export const CATEGORIAS_GASTOS = [
  {
    nombre: 'Nómina y Personal',
    subcategorias: ['Salarios', 'Horas extras', 'Bonificaciones', 'Seguridad Social (TSS)']
  },
  {
    nombre: 'Servicios Públicos',
    subcategorias: ['Luz (EDENORTE/EDESUR)', 'Agua', 'Gas', 'Internet', 'Teléfono']
  },
  {
    nombre: 'Alquiler y Local',
    subcategorias: ['Alquiler', 'Mantenimiento', 'Limpieza', 'Seguridad']
  },
  {
    nombre: 'Insumos y Suministros',
    subcategorias: ['Empaques', 'Uniformes', 'Artículos de limpieza', 'Papelería']
  },
  {
    nombre: 'Proveedores',
    subcategorias: ['Pago directo a suplidor', 'Materia prima', 'Mercancía']
  },
  {
    nombre: 'Marketing y Publicidad',
    subcategorias: ['Redes sociales', 'Impresiones', 'Promociones', 'Eventos']
  },
  {
    nombre: 'Impuestos y Tasas',
    subcategorias: ['DGII', 'Municipio', 'Licencias', 'Patentes']
  },
  {
    nombre: 'Mantenimiento y Reparación',
    subcategorias: ['Equipos', 'Infraestructura', 'Vehículos', 'Tecnología']
  },
  {
    nombre: 'Tecnología',
    subcategorias: ['Software', 'POS', 'Hardware', 'Suscripciones']
  },
  {
    nombre: 'Otros',
    subcategorias: ['Gastos varios', 'Imprevistos']
  }
] as const;

export const METODOS_PAGO_GASTO = [
  { valor: 'efectivo',      etiqueta: 'Efectivo',      icono: 'fa-money-bill-wave',   color: 'success' },
  { valor: 'tarjeta',       etiqueta: 'Tarjeta',       icono: 'fa-credit-card',       color: 'primary' },
  { valor: 'transferencia', etiqueta: 'Transferencia', icono: 'fa-building-columns',  color: 'info'    },
  { valor: 'cheque',        etiqueta: 'Cheque',        icono: 'fa-money-check',       color: 'warning' }
] as const;
