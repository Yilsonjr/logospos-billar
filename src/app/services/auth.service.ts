import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { Usuario, Rol, LoginCredentials, LoginResponse, AuthState, Sesion } from '../models/usuario.model';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authStateSubject = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    usuario: null,
    token: null,
    permisos: []
  });

  public authState$ = this.authStateSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {
    this.initializeAuth();
  }

  // Inicializar autenticación al cargar la app
  private async initializeAuth() {
    try {
      // Intentar recuperar de localStorage o sessionStorage
      let token = localStorage.getItem('dolvin_token') || sessionStorage.getItem('dolvin_token');
      let usuarioData = localStorage.getItem('dolvin_usuario') || sessionStorage.getItem('dolvin_usuario');

      if (token && usuarioData) {
        const usuario = JSON.parse(usuarioData);

        // 1. Actualización Optimista: Asumir que es válido mientras verificamos
        // Esto permite que el AuthGuard pase inmediatamente y evita el redirect al login
        this.authStateSubject.next({
          isAuthenticated: true,
          usuario,
          token,
          permisos: [] // Se cargarán en el siguiente paso
        });

        // 2. Verificar validez en segundo plano
        const isValid = await this.verificarToken(token);

        if (isValid) {
          // Cargar permisos actualizados
          const permisos = await this.cargarPermisosUsuario(usuario.id);

          // Actualizar estado con permisos confirmados
          this.authStateSubject.next({
            isAuthenticated: true,
            usuario,
            token,
            permisos
          });
        } else {
          // Si el token no es válido, cerrar sesión
          console.warn('Token inválido o expirado durante inicialización');
          this.logout();
        }
      }
    } catch (error) {
      console.error('Error al inicializar autenticación:', error);
      this.logout();
    }
  }

  // Login
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      // Buscar usuario por username o email
      const { data: usuario, error: errorUsuario } = await this.supabaseService.client
        .from('usuarios')
        .select('*')
        .or(`username.eq.${credentials.username},email.eq.${credentials.username}`)
        .eq('activo', true)
        .single();

      if (errorUsuario || !usuario) {
        throw new Error('Usuario no encontrado o inactivo');
      }

      // Cargar información del rol por separado
      const { data: rol, error: errorRol } = await this.supabaseService.client
        .from('roles')
        .select('*')
        .eq('id', usuario.rol_id)
        .single();

      if (!errorRol && rol) {
        usuario.rol = rol;
      }

      // Verificar contraseña (en producción usar bcrypt)
      if (usuario.password !== credentials.password) {
        throw new Error('Contraseña incorrecta');
      }

      // Generar token de sesión
      const token = this.generarToken();
      const expiracion = new Date();
      expiracion.setHours(expiracion.getHours() + (credentials.recordar ? 24 * 7 : 8)); // 7 días si "recordar", 8 horas si no

      // Crear sesión en BD
      const sesion: Omit<Sesion, 'id'> = {
        usuario_id: usuario.id,
        token,
        fecha_inicio: new Date().toISOString(),
        fecha_expiracion: expiracion.toISOString(),
        ip_address: await this.obtenerIP(),
        user_agent: navigator.userAgent,
        activa: true
      };

      await this.supabaseService.client
        .from('sesiones')
        .insert([sesion]);

      // Actualizar último acceso
      await this.supabaseService.client
        .from('usuarios')
        .update({ ultimo_acceso: new Date().toISOString() })
        .eq('id', usuario.id);

      // Cargar permisos
      const permisos = await this.cargarPermisosUsuario(usuario.id);

      // Guardar en Dexie para acceso offline
      await this.guardarUsuarioOffline(usuario, credentials.password, token, expiracion.toISOString());

      // Guardar en localStorage
      if (credentials.recordar) {
        localStorage.setItem('dolvin_token', token);
        localStorage.setItem('dolvin_usuario', JSON.stringify(usuario));
      } else {
        sessionStorage.setItem('dolvin_token', token);
        sessionStorage.setItem('dolvin_usuario', JSON.stringify(usuario));
      }

      // Actualizar estado
      this.authStateSubject.next({
        isAuthenticated: true,
        usuario,
        token,
        permisos
      });

      const response: LoginResponse = {
        usuario,
        token,
        expiracion: expiracion.toISOString()
      };

      return response;

    } catch (error: any) {
      console.error('Error en login:', error);

      // Si es error de red o timeout, intentar login offline
      if (!this.supabaseService.isOnline || error.message?.includes('FetchError') || error.message?.includes('Network Error')) {
        console.log('📶 Intento de login offline...');
        try {
          return await this.loginOffline(credentials);
        } catch (offlineError: any) {
          throw new Error(offlineError.message || 'Error en login offline');
        }
      }

      throw new Error(error.message || 'Error al iniciar sesión');
    }
  }

  // --- LOGICA OFFLINE (Dexie) ---

  private async guardarUsuarioOffline(usuario: Usuario, password_plana: string, token: string, fecha_expiracion: string) {
    try {
      // 1. Guardar perfil de usuario
      await this.supabaseService.db.usuarios_offline.put({
        id: usuario.id!,
        username: usuario.username,
        email: usuario.email || '',
        password_hash: password_plana, // Guardar plana para el fallback (o usar bcrypt local)
        perfil_json: JSON.stringify(usuario),
        ultimo_login: new Date().toISOString()
      });

      // 2. Guardar sesión
      await this.supabaseService.db.sesiones_offline.put({
        token,
        usuario_id: usuario.id!,
        fecha_expiracion
      });

      console.log('💾 Usuario cacheado para uso offline');
    } catch (e) {
      console.error('Error al cachear usuario offline:', e);
    }
  }

  private async loginOffline(credentials: LoginCredentials): Promise<LoginResponse> {
    const usuarioOffline = await this.supabaseService.db.usuarios_offline
      .where('username').equalsIgnoreCase(credentials.username)
      .or('email').equalsIgnoreCase(credentials.username)
      .first();

    if (!usuarioOffline) {
      throw new Error('Usuario no encontrado en modo offline (debe iniciar sesión online primero)');
    }

    if (usuarioOffline.password_hash !== credentials.password) {
      throw new Error('Contraseña offline incorrecta');
    }

    const usuario = JSON.parse(usuarioOffline.perfil_json);
    const token = this.generarToken(); // Token local para esta sesión
    const expiracion = new Date();
    expiracion.setHours(expiracion.getHours() + 8);

    // Actualizar estado
    this.authStateSubject.next({
      isAuthenticated: true,
      usuario,
      token,
      permisos: usuario.rol?.permisos || []
    });

    // Guardar temporalmente en localStorage para que refrescos no saquen al usuario
    sessionStorage.setItem('dolvin_token', token);
    sessionStorage.setItem('dolvin_usuario', JSON.stringify(usuario));

    await Swal.fire({
      title: '📶 Modo Offline',
      text: 'Has iniciado sesión en modo local. Algunas funciones de sincronización no estarán disponibles.',
      icon: 'info',
      confirmButtonText: 'Aceptar'
    });

    return {
      usuario,
      token,
      expiracion: expiracion.toISOString()
    };
  }

  // Logout
  async logout() {
    try {
      const currentState = this.authStateSubject.value;

      if (currentState.token) {
        // Marcar sesión como inactiva
        await this.supabaseService.client
          .from('sesiones')
          .update({ activa: false })
          .eq('token', currentState.token);
      }

      // Limpiar almacenamiento
      localStorage.removeItem('dolvin_token');
      localStorage.removeItem('dolvin_usuario');
      sessionStorage.removeItem('dolvin_token');
      sessionStorage.removeItem('dolvin_usuario');

      // Actualizar estado
      this.authStateSubject.next({
        isAuthenticated: false,
        usuario: null,
        token: null,
        permisos: []
      });

      // Redirigir al login
      this.router.navigate(['/login']);

    } catch (error) {
      console.error('Error en logout:', error);
    }
  }

  // Verificar si el usuario tiene un permiso específico
  tienePermiso(permiso: string): boolean {
    const currentState = this.authStateSubject.value;
    // Si es administrador (rol_id 1 o nombre 'admin'), tiene acceso total
    if (currentState.usuario?.rol_id === 1 || currentState.usuario?.rol?.nombre.toLowerCase() === 'admin') {
      return true;
    }
    return currentState.permisos.includes(permiso);
  }

  // Verificar si el usuario tiene alguno de los permisos
  tieneAlgunPermiso(permisos: string[]): boolean {
    const currentState = this.authStateSubject.value;

    // Si es administrador, acceso total
    if (currentState.usuario?.rol_id === 1 || currentState.usuario?.rol?.nombre.toLowerCase() === 'admin') {
      return true;
    }

    return permisos.some(permiso => currentState.permisos.includes(permiso));
  }

  // Verificar si el usuario tiene todos los permisos
  tieneTodosPermisos(permisos: string[]): boolean {
    const currentState = this.authStateSubject.value;

    // Si es administrador, acceso total
    if (currentState.usuario?.rol_id === 1 || currentState.usuario?.rol?.nombre.toLowerCase() === 'admin') {
      return true;
    }

    return permisos.every(permiso => currentState.permisos.includes(permiso));
  }

  // Obtener usuario actual
  get usuarioActual(): Usuario | null {
    return this.authStateSubject.value.usuario;
  }

  // Verificar si está autenticado
  get isAuthenticated(): boolean {
    return this.authStateSubject.value.isAuthenticated;
  }

  // Cargar permisos del usuario
  private async cargarPermisosUsuario(usuarioId: number): Promise<string[]> {
    try {
      // Primero obtener el rol_id del usuario
      const { data: usuario, error: errorUsuario } = await this.supabaseService.client
        .from('usuarios')
        .select('rol_id')
        .eq('id', usuarioId)
        .single();

      if (errorUsuario || !usuario) {
        return [];
      }

      // Luego obtener los permisos del rol
      const { data: rol, error: errorRol } = await this.supabaseService.client
        .from('roles')
        .select('permisos')
        .eq('id', usuario.rol_id)
        .single();

      if (errorRol || !rol) {
        return [];
      }

      return rol.permisos || [];
    } catch (error) {
      console.error('Error al cargar permisos:', error);
      return [];
    }
  }

  // Verificar validez del token
  private async verificarToken(token: string): Promise<boolean> {
    try {
      const { data: sesion, error } = await this.supabaseService.client
        .from('sesiones')
        .select('fecha_expiracion, activa')
        .eq('token', token)
        .eq('activa', true)
        .single();

      if (error || !sesion) {
        return false;
      }

      const ahora = new Date();
      const expiracion = new Date(sesion.fecha_expiracion);

      return ahora < expiracion;
    } catch (error) {
      console.error('Error al verificar token:', error);
      return false;
    }
  }

  // Generar token único
  private generarToken(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    return `dolvin_${timestamp}_${random}`;
  }

  // Obtener IP del usuario (simulado)
  private async obtenerIP(): Promise<string> {
    try {
      // En producción, usar un servicio real para obtener la IP
      return '127.0.0.1';
    } catch (error) {
      return 'unknown';
    }
  }

  // Cambiar contraseña
  async cambiarContrasena(contrasenaActual: string, contrasenaNueva: string): Promise<void> {
    try {
      const usuario = this.usuarioActual;
      if (!usuario) {
        throw new Error('No hay usuario autenticado');
      }

      // Verificar contraseña actual
      const { data: usuarioData, error } = await this.supabaseService.client
        .from('usuarios')
        .select('password')
        .eq('id', usuario.id)
        .single();

      if (error || usuarioData.password !== contrasenaActual) {
        throw new Error('Contraseña actual incorrecta');
      }

      // Actualizar contraseña
      await this.supabaseService.client
        .from('usuarios')
        .update({
          password: contrasenaNueva
        })
        .eq('id', usuario.id);

      await Swal.fire({
        title: '✅ Contraseña Actualizada',
        text: 'Tu contraseña ha sido cambiada exitosamente',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });

    } catch (error: any) {
      console.error('Error al cambiar contraseña:', error);
      throw new Error(error.message || 'Error al cambiar contraseña');
    }
  }

  // Obtener sesiones activas del usuario
  async obtenerSesionesActivas(): Promise<Sesion[]> {
    try {
      const usuario = this.usuarioActual;
      if (!usuario) return [];

      const { data, error } = await this.supabaseService.client
        .from('sesiones')
        .select('*')
        .eq('usuario_id', usuario.id)
        .eq('activa', true)
        .order('fecha_inicio', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al obtener sesiones:', error);
      return [];
    }
  }

  // Cerrar sesión específica
  async cerrarSesion(sesionId: number): Promise<void> {
    try {
      await this.supabaseService.client
        .from('sesiones')
        .update({ activa: false })
        .eq('id', sesionId);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      throw error;
    }
  }

  // Cerrar todas las sesiones excepto la actual
  async cerrarTodasLasSesiones(): Promise<void> {
    try {
      const usuario = this.usuarioActual;
      const tokenActual = this.authStateSubject.value.token;

      if (!usuario || !tokenActual) return;

      await this.supabaseService.client
        .from('sesiones')
        .update({ activa: false })
        .eq('usuario_id', usuario.id)
        .neq('token', tokenActual);

      await Swal.fire({
        title: 'Sesiones Cerradas',
        text: 'Se han cerrado todas las demás sesiones activas',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });

    } catch (error) {
      console.error('Error al cerrar sesiones:', error);
      throw error;
    }
  }
}