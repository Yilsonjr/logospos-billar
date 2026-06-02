-- =====================================================================
-- LOGOSPOS — Negocio Demo para Video Promocional
-- =====================================================================
-- Crea un tenant de prueba completo, sin afectar negocios reales.
--
-- Credenciales del admin demo:
--   Usuario:     demoadmin
--   Contraseña:  Demo1234
--
-- Para borrar todo y volver a empezar:
--   DELETE FROM negocios WHERE subdominio = 'demo-logospos';
-- =====================================================================

DO $$
DECLARE
  v_negocio_id UUID := gen_random_uuid();
  v_rol_id     BIGINT;

  v_cat_entradas  UUID;
  v_cat_carnes    UUID;
  v_cat_mariscos  UUID;
  v_cat_pizzas    UUID;
  v_cat_bebidas   UUID;
  v_cat_cocteles  UUID;
  v_cat_postres   UUID;

  v_zona_salon    UUID;
  v_zona_terraza  UUID;
  v_zona_barra    UUID;

  v_item_carne_asada   UUID;
  v_item_camarones     UUID;
  v_item_pizza_queso   UUID;
  v_item_cerveza       UUID;
  v_item_mojito        UUID;
  v_item_agua          UUID;
  v_item_flan          UUID;
  v_item_tostones      UUID;

  v_mesa_1  UUID;
  v_mesa_3  UUID;
  v_mesa_6  UUID;
  v_mesa_9  UUID;
  v_ord_id  UUID;
BEGIN

  -- ── 0. Verificar que no exista ya el demo ─────────────────────────
  IF EXISTS (SELECT 1 FROM negocios WHERE subdominio = 'demo-logospos') THEN
    SELECT id INTO v_negocio_id FROM negocios WHERE subdominio = 'demo-logospos';
    RAISE NOTICE 'Negocio demo ya existe (ID: %). Usando ID existente.', v_negocio_id;
  ELSE
    -- ── 1. CREAR NEGOCIO DEMO ───────────────────────────────────────
    INSERT INTO negocios (
      id, nombre, subdominio, rnc,
      plan_tipo, estado_licencia,
      fecha_vencimiento, tipo_negocio,
      modulos_activos,
      telefono, direccion,
      lema, email,
      tasa_itbis, modo_impuesto,
      formato_ticket, notas_internas
    ) VALUES (
      v_negocio_id,
      'La Terraza Restaurant',
      'demo-logospos',
      NULL,
      'profesional',
      'activa',
      (NOW() + INTERVAL '2 years')::date,
      'restaurante',
      to_jsonb(ARRAY[
        'caja','clientes','mesas','restaurante','cocina',
        'restaurante_inventario','fiscal','reportes',
        'usuarios','identidad','roles','sistema','dashboard',
        'cuentas_cobrar'
      ]::text[]),
      '809-555-0100',
      'Av. Demo 123, Santo Domingo',
      'El sabor que te enamora',
      'demo@laterraza.com',
      0.18,
      'encima',
      '80mm',
      'Tenant de DEMO para video promocional — NO ES CLIENTE REAL'
    );
    RAISE NOTICE 'Negocio demo creado: %', v_negocio_id;
  END IF;

  -- ── 2. CREAR ROL ADMIN PARA EL DEMO ──────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM roles WHERE negocio_id = v_negocio_id AND nombre = 'Administrador') THEN
    INSERT INTO roles (negocio_id, nombre, descripcion, color, permisos)
    VALUES (
      v_negocio_id,
      'Administrador',
      'Acceso completo al sistema',
      '#6366f1',
      to_jsonb(ARRAY[
        'ventas.ver','ventas.crear','ventas.editar','ventas.eliminar',
        'inventario.ver','inventario.crear','inventario.editar',
        'caja.ver','caja.abrir','caja.cerrar','caja.movimientos',
        'clientes.ver','clientes.crear','clientes.editar',
        'mesas.ver','mesas.crear','mesas.editar',
        'restaurante.ver','restaurante.ordenes','restaurante.menu',
        'restaurante.mesas','restaurante.cocina',
        'reportes.ver','reportes.exportar',
        'usuarios.ver','usuarios.crear','usuarios.editar',
        'roles.ver','roles.crear','roles.editar',
        'sistema.ver','sistema.configurar',
        'dashboard.ver'
      ]::text[])
    )
    RETURNING id INTO v_rol_id;
  ELSE
    SELECT id INTO v_rol_id FROM roles WHERE negocio_id = v_negocio_id AND nombre = 'Administrador' LIMIT 1;
  END IF;

  -- ── 3. CREAR USUARIO ADMIN DEMO ───────────────────────────────────
  -- Contraseña: Demo1234
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE negocio_id = v_negocio_id AND username = 'demoadmin') THEN
    INSERT INTO usuarios (negocio_id, rol_id, nombre, apellido, username, email, password, activo)
    VALUES (
      v_negocio_id,
      v_rol_id,
      'Admin',
      'Demo',
      'demoadmin',
      'demo@laterraza.com',
      '$2b$10$j8H6/4vv1XNTD4v91Lwl4OVyti4ufHdkvx3gSrKXi8eDAGF8aaM.a',
      true
    );
    RAISE NOTICE 'Usuario demoadmin creado';
  END IF;

  -- ── 4. CATEGORÍAS DEL MENÚ ───────────────────────────────────────
  INSERT INTO menu_categories (negocio_id, nombre, descripcion, orden, activa, icono)
  VALUES
    (v_negocio_id, 'Entradas',  'Aperitivos y entradas',        1, true, 'fa-solid fa-leaf'),
    (v_negocio_id, 'Carnes',    'Cortes y parrillas',           2, true, 'fa-solid fa-drumstick-bite'),
    (v_negocio_id, 'Mariscos',  'Frutos del mar frescos',       3, true, 'fa-solid fa-fish'),
    (v_negocio_id, 'Pizzas',    'Pizzas artesanales al horno',  4, true, 'fa-solid fa-pizza-slice'),
    (v_negocio_id, 'Bebidas',   'Refrescos, cervezas y agua',   5, true, 'fa-solid fa-bottle-water'),
    (v_negocio_id, 'Cócteles',  'Tragos y bebidas especiales',  6, true, 'fa-solid fa-martini-glass'),
    (v_negocio_id, 'Postres',   'Dulces y postres caseros',     7, true, 'fa-solid fa-ice-cream')
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_cat_entradas FROM menu_categories WHERE negocio_id = v_negocio_id AND nombre = 'Entradas'  LIMIT 1;
  SELECT id INTO v_cat_carnes   FROM menu_categories WHERE negocio_id = v_negocio_id AND nombre = 'Carnes'    LIMIT 1;
  SELECT id INTO v_cat_mariscos FROM menu_categories WHERE negocio_id = v_negocio_id AND nombre = 'Mariscos'  LIMIT 1;
  SELECT id INTO v_cat_pizzas   FROM menu_categories WHERE negocio_id = v_negocio_id AND nombre = 'Pizzas'    LIMIT 1;
  SELECT id INTO v_cat_bebidas  FROM menu_categories WHERE negocio_id = v_negocio_id AND nombre = 'Bebidas'   LIMIT 1;
  SELECT id INTO v_cat_cocteles FROM menu_categories WHERE negocio_id = v_negocio_id AND nombre = 'Cócteles'  LIMIT 1;
  SELECT id INTO v_cat_postres  FROM menu_categories WHERE negocio_id = v_negocio_id AND nombre = 'Postres'   LIMIT 1;

  -- ── 5. PLATOS DEL MENÚ ──────────────────────────────────────────
  INSERT INTO menu_items
    (negocio_id, categoria_id, nombre, descripcion, precio,
     tiempo_preparacion_minutos, requiere_inventario, enviar_a_cocina,
     disponible, activo, costo_estimado)
  VALUES
    -- Entradas
    (v_negocio_id, v_cat_entradas, 'Tostones con Ajo',      'Tostones fritos con mojo de ajo',          180, 10, false, true,  true, true, 60),
    (v_negocio_id, v_cat_entradas, 'Yuca Frita',            'Yuca frita crujiente con salsa rosada',    150, 10, false, true,  true, true, 50),
    (v_negocio_id, v_cat_entradas, 'Chicharrón de Pollo',   'Pollo frito crujiente con limón',          220, 12, false, true,  true, true, 80),
    (v_negocio_id, v_cat_entradas, 'Ensalada César',        'Lechuga, crutones, queso parmesano',       250,  8, false, false, true, true, 90),
    (v_negocio_id, v_cat_entradas, 'Ceviche de Camarones',  'Camarones marinados en limón y cilantro',  380,  5, false, false, true, true, 150),
    -- Carnes
    (v_negocio_id, v_cat_carnes, 'Carne Asada',             'Carne a la parrilla con papas y ensalada', 650, 20, false, true,  true, true, 250),
    (v_negocio_id, v_cat_carnes, 'Chuleta Ahumada',         'Chuleta de cerdo con arroz y habichuela',  580, 18, false, true,  true, true, 200),
    (v_negocio_id, v_cat_carnes, 'Pollo a la Brasa',        'Medio pollo a la brasa con tostones',      520, 25, false, true,  true, true, 180),
    (v_negocio_id, v_cat_carnes, 'Bistec Encebollado',      'Bistec de res con cebolla salteada',       480, 15, false, true,  true, true, 160),
    (v_negocio_id, v_cat_carnes, 'Costillas BBQ',           'Costillas de cerdo en salsa BBQ',          780, 30, false, true,  true, true, 300),
    -- Mariscos
    (v_negocio_id, v_cat_mariscos, 'Camarones al Ajillo',   'Camarones salteados en mantequilla y ajo', 750, 15, false, true,  true, true, 280),
    (v_negocio_id, v_cat_mariscos, 'Langosta a la Parrilla','Langosta entera a la brasa',              1800, 25, false, true,  true, true, 800),
    (v_negocio_id, v_cat_mariscos, 'Filete de Pescado',     'Filete empanizado con tostones',           580, 15, false, true,  true, true, 200),
    (v_negocio_id, v_cat_mariscos, 'Pulpo a la Gallega',    'Pulpo con papas y pimentón ahumado',       850, 20, false, true,  true, true, 350),
    -- Pizzas
    (v_negocio_id, v_cat_pizzas, 'Pizza Margarita',         '12" con salsa, mozzarella y albahaca',     380, 15, false, true,  true, true, 130),
    (v_negocio_id, v_cat_pizzas, 'Pizza Pepperoni',         '12" con pepperoni y extra queso',          450, 15, false, true,  true, true, 150),
    (v_negocio_id, v_cat_pizzas, 'Pizza 4 Quesos',          '12" con mozzarella, gouda, parm y brie',   480, 15, false, true,  true, true, 160),
    (v_negocio_id, v_cat_pizzas, 'Pizza BBQ Pollo',         '12" con pollo, BBQ y cebolla morada',      490, 18, false, true,  true, true, 170),
    -- Bebidas
    (v_negocio_id, v_cat_bebidas, 'Cerveza Presidente',     'Botella 12 oz bien fría',                  120,  1, false, false, true, true, 55),
    (v_negocio_id, v_cat_bebidas, 'Cerveza Heineken',       'Botella 12 oz importada',                  150,  1, false, false, true, true, 70),
    (v_negocio_id, v_cat_bebidas, 'Agua Mineral',           'Botella 500ml',                             80,  1, false, false, true, true, 25),
    (v_negocio_id, v_cat_bebidas, 'Jugo de Chinola',        'Jugo natural 16 oz',                       120,  3, false, false, true, true, 35),
    (v_negocio_id, v_cat_bebidas, 'Refresco Cola',          'Lata 12 oz',                                80,  1, false, false, true, true, 30),
    (v_negocio_id, v_cat_bebidas, 'Limonada Natural',       'Limonada natural 16 oz',                   100,  3, false, false, true, true, 30),
    -- Cócteles
    (v_negocio_id, v_cat_cocteles, 'Mojito Clásico',        'Ron, limón, menta, soda y hielo',          250,  5, false, false, true, true, 80),
    (v_negocio_id, v_cat_cocteles, 'Piña Colada',           'Ron, crema de coco, piña fresca',          280,  5, false, false, true, true, 90),
    (v_negocio_id, v_cat_cocteles, 'Margarita',             'Tequila, triple sec, jugo de limón',       280,  5, false, false, true, true, 90),
    (v_negocio_id, v_cat_cocteles, 'Whisky en las Rocas',   'Whisky premium con hielo',                 350,  2, false, false, true, true, 140),
    (v_negocio_id, v_cat_cocteles, 'Daiquiri de Fresa',     'Ron, fresa, limón, hielo frappé',          260,  5, false, false, true, true, 85),
    -- Postres
    (v_negocio_id, v_cat_postres, 'Flan de Vainilla',       'Flan casero con caramelo de la casa',      180,  2, false, false, true, true, 50),
    (v_negocio_id, v_cat_postres, 'Brownie con Helado',     'Brownie caliente con helado de vainilla',  220,  5, false, false, true, true, 70),
    (v_negocio_id, v_cat_postres, 'Tres Leches',            'Pastel tres leches casero',                200,  2, false, false, true, true, 60)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_item_carne_asada FROM menu_items WHERE negocio_id = v_negocio_id AND nombre = 'Carne Asada'         LIMIT 1;
  SELECT id INTO v_item_camarones   FROM menu_items WHERE negocio_id = v_negocio_id AND nombre = 'Camarones al Ajillo' LIMIT 1;
  SELECT id INTO v_item_pizza_queso FROM menu_items WHERE negocio_id = v_negocio_id AND nombre = 'Pizza 4 Quesos'      LIMIT 1;
  SELECT id INTO v_item_cerveza     FROM menu_items WHERE negocio_id = v_negocio_id AND nombre = 'Cerveza Presidente'  LIMIT 1;
  SELECT id INTO v_item_mojito      FROM menu_items WHERE negocio_id = v_negocio_id AND nombre = 'Mojito Clásico'      LIMIT 1;
  SELECT id INTO v_item_agua        FROM menu_items WHERE negocio_id = v_negocio_id AND nombre = 'Agua Mineral'        LIMIT 1;
  SELECT id INTO v_item_flan        FROM menu_items WHERE negocio_id = v_negocio_id AND nombre = 'Flan de Vainilla'    LIMIT 1;
  SELECT id INTO v_item_tostones    FROM menu_items WHERE negocio_id = v_negocio_id AND nombre = 'Tostones con Ajo'   LIMIT 1;

  -- ── 6. ZONAS ─────────────────────────────────────────────────────
  INSERT INTO restaurant_zones (negocio_id, nombre, descripcion, orden, activa)
  VALUES
    (v_negocio_id, 'Salón Principal', 'Área interior climatizada', 1, true),
    (v_negocio_id, 'Terraza',         'Área exterior con vista',   2, true),
    (v_negocio_id, 'Barra',           'Barra y zona de tragos',    3, true)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_zona_salon   FROM restaurant_zones WHERE negocio_id = v_negocio_id AND nombre = 'Salón Principal' LIMIT 1;
  SELECT id INTO v_zona_terraza FROM restaurant_zones WHERE negocio_id = v_negocio_id AND nombre = 'Terraza'         LIMIT 1;
  SELECT id INTO v_zona_barra   FROM restaurant_zones WHERE negocio_id = v_negocio_id AND nombre = 'Barra'           LIMIT 1;

  -- ── 7. MESAS ─────────────────────────────────────────────────────
  INSERT INTO restaurant_tables
    (negocio_id, zona_id, numero_mesa, nombre_mesa, capacidad, estado, ubicacion_x, ubicacion_y, activa)
  VALUES
    (v_negocio_id, v_zona_salon,   1,  'Mesa 1',   4, 'libre', 100, 80,  true),
    (v_negocio_id, v_zona_salon,   2,  'Mesa 2',   4, 'libre', 240, 80,  true),
    (v_negocio_id, v_zona_salon,   3,  'Mesa 3',   6, 'libre', 380, 80,  true),
    (v_negocio_id, v_zona_salon,   4,  'Mesa 4',   4, 'libre', 100, 220, true),
    (v_negocio_id, v_zona_salon,   5,  'Mesa 5',   4, 'libre', 240, 220, true),
    (v_negocio_id, v_zona_salon,   6,  'Mesa 6',   8, 'libre', 380, 220, true),
    (v_negocio_id, v_zona_salon,   7,  'Mesa 7',   4, 'libre', 100, 360, true),
    (v_negocio_id, v_zona_salon,   8,  'Mesa 8',   2, 'libre', 240, 360, true),
    (v_negocio_id, v_zona_terraza, 9,  'Terraza 1',4, 'libre', 100, 80,  true),
    (v_negocio_id, v_zona_terraza, 10, 'Terraza 2',4, 'libre', 260, 80,  true),
    (v_negocio_id, v_zona_terraza, 11, 'Terraza 3',6, 'libre', 100, 230, true),
    (v_negocio_id, v_zona_terraza, 12, 'Terraza 4',4, 'libre', 260, 230, true),
    (v_negocio_id, v_zona_barra,   13, 'Barra 1',  2, 'libre', 80,  80,  true),
    (v_negocio_id, v_zona_barra,   14, 'Barra 2',  2, 'libre', 210, 80,  true),
    (v_negocio_id, v_zona_barra,   15, 'Barra 3',  2, 'libre', 340, 80,  true)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_mesa_1 FROM restaurant_tables WHERE negocio_id = v_negocio_id AND numero_mesa = 1  LIMIT 1;
  SELECT id INTO v_mesa_3 FROM restaurant_tables WHERE negocio_id = v_negocio_id AND numero_mesa = 3  LIMIT 1;
  SELECT id INTO v_mesa_6 FROM restaurant_tables WHERE negocio_id = v_negocio_id AND numero_mesa = 6  LIMIT 1;
  SELECT id INTO v_mesa_9 FROM restaurant_tables WHERE negocio_id = v_negocio_id AND numero_mesa = 9  LIMIT 1;

  -- ── 8. INVENTARIO ────────────────────────────────────────────────
  INSERT INTO restaurant_inventory
    (negocio_id, nombre, categoria, unidad_medida,
     cantidad_actual, cantidad_minima, cantidad_maxima, costo_unitario, activo)
  VALUES
    (v_negocio_id, 'Carne de Res',             'Carnes',    'lb',   25, 5,  50, 220,  true),
    (v_negocio_id, 'Pollo Entero',             'Carnes',    'unidad',12, 4,  20, 350,  true),
    (v_negocio_id, 'Cerdo',                    'Carnes',    'lb',   15, 5,  30, 190,  true),
    (v_negocio_id, 'Camarones',               'Mariscos',  'lb',    8, 2,  15, 580,  true),
    (v_negocio_id, 'Filete de Pescado',        'Mariscos',  'lb',    6, 2,  12, 320,  true),
    (v_negocio_id, 'Pulpo',                    'Mariscos',  'lb',    4, 1,   8, 480,  true),
    (v_negocio_id, 'Cebolla',                  'Vegetales', 'lb',   10, 2,  20, 45,   true),
    (v_negocio_id, 'Tomate',                   'Vegetales', 'lb',    8, 2,  15, 55,   true),
    (v_negocio_id, 'Lechuga',                  'Vegetales', 'unidad', 5, 2, 10, 80,   true),
    (v_negocio_id, 'Ajo',                      'Vegetales', 'unidad',20, 5,  40, 25,   true),
    (v_negocio_id, 'Harina de Trigo',          'Granos',    'lb',   20, 5,  40, 40,   true),
    (v_negocio_id, 'Arroz',                    'Granos',    'lb',   30,10,  60, 35,   true),
    (v_negocio_id, 'Habichuelas Negras',       'Granos',    'lb',   15, 5,  30, 38,   true),
    (v_negocio_id, 'Cerveza Presidente',       'Bebidas',   'caja',  8, 2,  20,1380,  true),
    (v_negocio_id, 'Cerveza Heineken',         'Bebidas',   'caja',  6, 2,  15,1680,  true),
    (v_negocio_id, 'Agua Mineral',             'Bebidas',   'paquete',10,3, 25, 520,  true),
    (v_negocio_id, 'Refresco Cola',            'Bebidas',   'caja',  5, 2,  12, 780,  true),
    (v_negocio_id, 'Ron Brugal 750ml',         'Licores',   'botella',4,2,  10, 850,  true),
    (v_negocio_id, 'Whisky Jack Daniels 750ml','Licores',   'botella',3,1,   8,1850,  true),
    (v_negocio_id, 'Tequila 750ml',            'Licores',   'botella',2,1,   6,1200,  true),
    (v_negocio_id, 'Queso Mozzarella',         'Lácteos',   'lb',    6, 2,  12, 280,  true),
    (v_negocio_id, 'Mantequilla',              'Lácteos',   'lb',    4, 1,   8, 220,  true),
    (v_negocio_id, 'Aceite de Oliva',          'Cocina',    'litro', 5, 1,  10, 380,  true)
  ON CONFLICT DO NOTHING;

  -- ── 9. ÓRDENES ACTIVAS ───────────────────────────────────────────

  -- Mesa 1: en cocina
  INSERT INTO restaurant_orders
    (negocio_id, table_id, estado, tipo_orden, cantidad_comensales,
     subtotal, impuesto, descuento, total, propina, hora_apertura, hora_envio_cocina)
  VALUES
    (v_negocio_id, v_mesa_1, 'en_cocina', 'mesa', 2,
     1010, 0, 0, 1010, 0,
     NOW() - INTERVAL '22 minutes', NOW() - INTERVAL '18 minutes')
  RETURNING id INTO v_ord_id;

  INSERT INTO restaurant_order_items
    (order_id, menu_item_id, cantidad, precio_unitario, subtotal, modificadores, estado)
  VALUES
    (v_ord_id, v_item_carne_asada, 1, 650, 650, '[]', 'en_preparacion'),
    (v_ord_id, v_item_tostones,    1, 180, 180, '[]', 'listo'),
    (v_ord_id, v_item_cerveza,     2, 120, 240, '[]', 'entregado')
  ON CONFLICT DO NOTHING;

  UPDATE restaurant_tables SET estado = 'ocupada' WHERE id = v_mesa_1;

  -- Mesa 3: pagando
  INSERT INTO restaurant_orders
    (negocio_id, table_id, estado, tipo_orden, cantidad_comensales,
     subtotal, impuesto, descuento, total, propina, hora_apertura, hora_envio_cocina)
  VALUES
    (v_negocio_id, v_mesa_3, 'pagando', 'mesa', 4,
     2560, 0, 0, 2560, 150,
     NOW() - INTERVAL '80 minutes', NOW() - INTERVAL '70 minutes')
  RETURNING id INTO v_ord_id;

  INSERT INTO restaurant_order_items
    (order_id, menu_item_id, cantidad, precio_unitario, subtotal, modificadores, estado)
  VALUES
    (v_ord_id, v_item_camarones,   2, 750, 1500, '[]', 'entregado'),
    (v_ord_id, v_item_pizza_queso, 1, 480,  480, '[]', 'entregado'),
    (v_ord_id, v_item_mojito,      2, 250,  500, '[]', 'entregado'),
    (v_ord_id, v_item_flan,        1, 180,  180, '[]', 'entregado')
  ON CONFLICT DO NOTHING;

  UPDATE restaurant_tables SET estado = 'ocupada' WHERE id = v_mesa_3;

  -- Mesa 6: recién abierta
  INSERT INTO restaurant_orders
    (negocio_id, table_id, estado, tipo_orden, cantidad_comensales,
     subtotal, impuesto, descuento, total, propina, hora_apertura)
  VALUES
    (v_negocio_id, v_mesa_6, 'abierta', 'mesa', 5,
     720, 0, 0, 720, 0,
     NOW() - INTERVAL '6 minutes')
  RETURNING id INTO v_ord_id;

  INSERT INTO restaurant_order_items
    (order_id, menu_item_id, cantidad, precio_unitario, subtotal, modificadores, estado)
  VALUES
    (v_ord_id, v_item_cerveza, 5, 120, 600, '[]', 'entregado'),
    (v_ord_id, v_item_agua,    2,  80, 160, '[]', 'entregado')
  ON CONFLICT DO NOTHING;

  UPDATE restaurant_tables SET estado = 'ocupada' WHERE id = v_mesa_6;

  -- Terraza 1: reservada
  UPDATE restaurant_tables
  SET estado           = 'reservada',
      reserva_nombre   = 'Familia González',
      reserva_hora     = '20:30',
      reserva_personas = 6,
      reserva_notas    = 'Cumpleaños, pedir decoración'
  WHERE id = v_mesa_9;

  -- ── 10. HISTORIAL DE VENTAS (últimos 7 días) ─────────────────────
  INSERT INTO restaurant_orders
    (negocio_id, table_id, estado, tipo_orden, cantidad_comensales,
     subtotal, impuesto, descuento, total, propina, hora_apertura, hora_cierre)
  SELECT
    v_negocio_id,
    NULL,
    'cerrada',
    (ARRAY['mesa','llevar','barra'])[floor(random()*3+1)::int],
    floor(random()*5+1)::int,
    floor(random()*2000+300)::numeric,
    0, 0,
    floor(random()*2000+300)::numeric,
    floor(random()*250)::numeric,
    NOW() - (floor(random()*7) || ' days')::interval - (floor(random()*12+10) || ' hours')::interval,
    NOW() - (floor(random()*7) || ' days')::interval - (floor(random()*8)     || ' hours')::interval
  FROM generate_series(1, 48);

  RAISE NOTICE '';
  RAISE NOTICE '✅  Negocio demo listo!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '  Nombre:     La Terraza Restaurant';
  RAISE NOTICE '  Usuario:    demoadmin';
  RAISE NOTICE '  Contraseña: Demo1234';
  RAISE NOTICE '  Negocio ID: %', v_negocio_id;
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '  32 platos · 7 categorías';
  RAISE NOTICE '  15 mesas (Salón x8, Terraza x4, Barra x3)';
  RAISE NOTICE '  23 insumos en inventario';
  RAISE NOTICE '  3 órdenes activas + 1 reserva';
  RAISE NOTICE '  48 ventas históricas';

END;
$$;
