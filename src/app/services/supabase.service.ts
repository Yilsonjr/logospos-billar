import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environment/environment';
import Dexie, { Table } from 'dexie';

export interface UsuarioOffline {
  id?: number;
  username: string;
  email: string;
  password_hash: string; // Contraseña plana o hasheada para offline
  perfil_json: string; // Usuario completo incluyendo Rol
  ultimo_login: string;
}

export interface SesionOffline {
  token: string;
  usuario_id?: number;
  fecha_expiracion: string;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  public db!: Dexie & {
    usuarios_offline: Table<UsuarioOffline>;
    sesiones_offline: Table<SesionOffline>;
  };

  /** URL pública del proyecto Supabase (sin trailing slash) */
  readonly supabaseUrl     = environment.SUPABASE_URL;
  /** Anon key pública (safe para exponer, limita permisos) */
  readonly supabaseAnonKey = environment.SUPABASE_KEY;

  constructor() {
    this.supabase = createClient(
      environment.SUPABASE_URL,
      environment.SUPABASE_KEY
    );
    this.initDexie();
    // Restaurar JWT de sesión previa al iniciar
    this.restaurarJwt();
  }

  /**
   * Establece el JWT firmado por la Edge Function.
   * A partir de aquí TODAS las queries usan este JWT en el header
   * Authorization → PostgREST lo pasa a las políticas RLS.
   */
  setJwt(jwt: string): void {
    this.supabase = createClient(
      environment.SUPABASE_URL,
      environment.SUPABASE_KEY,
      {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth:   { persistSession: false, autoRefreshToken: false }
      }
    );
  }

  /** Elimina el JWT y vuelve al cliente anónimo (al hacer logout). */
  clearJwt(): void {
    localStorage.removeItem('logos_jwt');
    sessionStorage.removeItem('logos_jwt');
    this.supabase = createClient(
      environment.SUPABASE_URL,
      environment.SUPABASE_KEY
    );
  }

  /** Intenta restaurar el JWT guardado en storage al recargar la página. */
  private restaurarJwt(): void {
    const jwt = localStorage.getItem('logos_jwt') || sessionStorage.getItem('logos_jwt');
    if (jwt) {
      this.setJwt(jwt);
    }
  }

  private initDexie() {
    this.db = new Dexie('LogosPOS_DB') as any;
    this.db.version(1).stores({
      usuarios_offline: '++id, username, email',
      sesiones_offline: 'token, usuario_id'
    });
  }

  // Verificar si hay conexión
  get isOnline(): boolean {
    return navigator.onLine;
  }

  // Getter para acceder al cliente de Supabase
  get client() {
    return this.supabase;
  }

  // Método para probar la conexión
  async testConnection() {
    try {
      const { data, error } = await this.supabase
        .from('productos')
        .select('count')
        .limit(1);

      if (error) {
        console.error('Error de conexión:', error);
        return false;
      }

      console.log('✅ Conexión exitosa a Supabase');
      return true;
    } catch (error) {
      console.error('❌ Error al conectar con Supabase:', error);
      return false;
    }
  }
}