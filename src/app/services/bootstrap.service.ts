import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ROLES_PREDEFINIDOS } from '../models/usuario.model';
import * as bcrypt from 'bcryptjs';

@Injectable({
  providedIn: 'root'
})
export class BootstrapService {

  constructor(private supabaseService: SupabaseService) { }

  // Inicializar sistema (crear roles y admin)
  async inicializarSistema(): Promise<void> {
    try {
      // Verificar Supabase con timeout muy corto
      const supabaseDisponible = await Promise.race([
        this.verificarSupabase(),
        new Promise<boolean>((resolve) => setTimeout(() => {
          resolve(false);
        }, 5000)) // Aumentado a 5 segundos para db de prueba
      ]);

      if (supabaseDisponible) {
        // Configurar datos con timeout
        await Promise.race([
          this.configurarDatosIniciales(),
          new Promise<void>((resolve) => setTimeout(() => {
            resolve();
          }, 2000))
        ]);
      } else {
        this.inicializarModoDemo();
      }

    } catch (error) {
      console.error('⚠️ Error en inicialización del sistema:', error);
    }
  }

  private async configurarDatosIniciales(): Promise<void> {
    try {
      await this.crearRolesPredefinidos();
      await this.crearUsuarioAdmin();
    } catch (error) {
      console.error('⚠️ Error configurando datos iniciales:', error);
    }
  }

  private async verificarSupabase(): Promise<boolean> {
    try {
      // Simplemente intentar conectar y ver si responde
      const { error } = await this.supabaseService.client
        .from('roles')
        .select('*')
        .limit(1);

      // Si el error es que no hay filas, está bien (la tabla existe)
      // Si el error es de conexión o autenticación, devolvemos false
      if (error && (error.code === 'PGRST116' || error.message.includes('No rows'))) {
        return true;
      }

      return !error;

    } catch (error) {
      return false;
    }
  }

  private inicializarModoDemo(): void {
    console.log('🎭 Iniciando modo demostración sin base de datos');
    console.log(`
🎯 MODO DEMO ACTIVADO

👑 CREDENCIALES DE ACCESO:
   Usuario: admin
   Contraseña: admin123

📝 NOTA: 
   - Los datos se almacenan en memoria
   - Se reinician al recargar la página
   - Todas las funcionalidades están disponibles
   - Perfecto para demostración y pruebas

🚀 Ve a /login para acceder al sistema
    `);
  }

  private async crearRolesPredefinidos(): Promise<void> {
    try {
      console.log('📋 Verificando roles...');

      // Intentar crear todos los roles en paralelo
      const promesas = ROLES_PREDEFINIDOS.map(async (rolData) => {
        try {
          const { data: existeRol } = await this.supabaseService.client
            .from('roles')
            .select('id')
            .eq('nombre', rolData.nombre)
            .maybeSingle();

          if (!existeRol) {
            await this.supabaseService.client
              .from('roles')
              .insert([rolData]);
            console.log(`✅ Rol: ${rolData.nombre}`);
          }
        } catch (error) {
          // Ignorar errores individuales
        }
      });

      await Promise.all(promesas);
      console.log('✅ Roles verificados');

    } catch (error) {
      console.log('⚠️ Error con roles:', error);
    }
  }

  private async crearUsuarioAdmin(): Promise<void> {
    try {
      console.log('👤 Verificando usuario admin...');

      // Verificar si existe
      const { data: existeAdmin } = await this.supabaseService.client
        .from('usuarios')
        .select('id')
        .eq('username', 'admin')
        .maybeSingle();

      if (existeAdmin) {
        console.log('ℹ️ Usuario admin ya existe');
        return;
      }

      // Buscar rol
      const { data: rolAdmin } = await this.supabaseService.client
        .from('roles')
        .select('id')
        .eq('nombre', 'Super Administrador')
        .single();

      if (!rolAdmin) {
        console.log('⚠️ Rol no encontrado');
        return;
      }

      // Hashear contraseña inicial
      const passwordHasheada = await bcrypt.hash('admin123', 10);

      // Crear admin
      await this.supabaseService.client
        .from('usuarios')
        .insert([{
          nombre: 'Administrador',
          apellido: 'Sistema',
          email: 'admin@dolvinpos.com',
          username: 'admin',
          password: passwordHasheada,
          telefono: '+1234567890',
          rol_id: rolAdmin.id,
          activo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      console.log('✅ Usuario admin creado');

    } catch (error) {
      console.log('⚠️ Error con usuario admin:', error);
    }
  }

  // Método para crear todos los usuarios demo (opcional)
  async crearUsuariosDemo(): Promise<void> {
    try {
      console.log('🎭 Creando usuarios de demostración...');

      // Cargar roles
      const { data: roles } = await this.supabaseService.client
        .from('roles')
        .select('id, nombre');

      if (!roles) {
        console.error('❌ No se pudieron cargar los roles');
        return;
      }

      const rolesMap: { [nombre: string]: number } = {};
      roles.forEach(rol => {
        rolesMap[rol.nombre] = rol.id;
      });

      const usuariosDemo = [
        {
          nombre: 'Juan',
          apellido: 'Pérez',
          email: 'cajero@dolvinpos.com',
          username: 'cajero',
          password: 'cajero123',
          telefono: '+1234567891',
          rol_id: rolesMap['Cajero'],
          activo: true
        },
        {
          nombre: 'María',
          apellido: 'González',
          email: 'vendedor@dolvinpos.com',
          username: 'vendedor',
          password: 'vendedor123',
          telefono: '+1234567892',
          rol_id: rolesMap['Vendedor'],
          activo: true
        },
        {
          nombre: 'Carlos',
          apellido: 'Rodríguez',
          email: 'supervisor@dolvinpos.com',
          username: 'supervisor',
          password: 'supervisor123',
          telefono: '+1234567893',
          rol_id: rolesMap['Administrador'],
          activo: true
        },
        {
          nombre: 'Ana',
          apellido: 'López',
          email: 'consulta@dolvinpos.com',
          username: 'consulta',
          password: 'consulta123',
          telefono: '+1234567894',
          rol_id: rolesMap['Solo Lectura'],
          activo: true
        }
      ];

      for (const usuarioData of usuariosDemo) {
        // Verificar si ya existe
        const { data: existeUsuario } = await this.supabaseService.client
          .from('usuarios')
          .select('id')
          .eq('username', usuarioData.username)
          .maybeSingle();

        if (!existeUsuario && usuarioData.rol_id) {
          const passwordHasheada = await bcrypt.hash(usuarioData.password, 10);

          const { error } = await this.supabaseService.client
            .from('usuarios')
            .insert([{
              ...usuarioData,
              password: passwordHasheada,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);

          if (error) {
            console.error(`❌ Error creando usuario ${usuarioData.username}:`, error);
          } else {
            console.log(`✅ Usuario demo creado: ${usuarioData.username}`);
          }
        }
      }

      console.log('🎉 Usuarios demo creados exitosamente');
      this.mostrarCredenciales();

    } catch (error) {
      console.error('❌ Error creando usuarios demo:', error);
    }
  }

  private mostrarCredenciales(): void {
    console.log(`
🔐 CREDENCIALES DE ACCESO DISPONIBLES:

👑 SUPER ADMINISTRADOR
   Usuario: admin
   Contraseña: admin123
   ✅ Creado automáticamente

💰 CAJERO (Demo)
   Usuario: cajero
   Contraseña: cajero123

🛒 VENDEDOR (Demo)
   Usuario: vendedor
   Contraseña: vendedor123

🔧 SUPERVISOR (Demo)
   Usuario: supervisor
   Contraseña: supervisor123

👁️ CONSULTA (Demo)
   Usuario: consulta
   Contraseña: consulta123

🚀 Accede en: /login
    `);
  }

  // Verificar estado del sistema
  async verificarEstadoSistema(): Promise<{
    rolesCreados: boolean;
    adminCreado: boolean;
    usuariosDemo: number;
  }> {
    try {
      // Verificar roles
      const { data: roles } = await this.supabaseService.client
        .from('roles')
        .select('count');

      // Verificar admin
      const { data: admin } = await this.supabaseService.client
        .from('usuarios')
        .select('id')
        .eq('username', 'admin')
        .maybeSingle();

      // Contar usuarios demo
      const { data: usuarios } = await this.supabaseService.client
        .from('usuarios')
        .select('count');

      return {
        rolesCreados: (roles?.length || 0) > 0,
        adminCreado: !!admin,
        usuariosDemo: usuarios?.length || 0
      };

    } catch (error) {
      console.error('Error verificando estado del sistema:', error);
      return {
        rolesCreados: false,
        adminCreado: false,
        usuariosDemo: 0
      };
    }
  }
}