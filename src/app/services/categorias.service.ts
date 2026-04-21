import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Categoria, CrearCategoria } from '../models/categorias.model';
import { BehaviorSubject } from 'rxjs';

// @Injectable hace que esta clase se pueda inyectar en otros componentes
@Injectable({
  providedIn: 'root' // Singleton: una sola instancia en toda la app
})
export class CategoriasService {
  // BehaviorSubject: Observable que mantiene el último valor emitido
  private categoriasSubject = new BehaviorSubject<Categoria[]>([]);

  // Observable público para que los componentes se suscriban
  public categorias$ = this.categoriasSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService
  ) {
    // Cargar categorías al inicializar el servicio
    this.cargarCategorias();
  }

  // Método para obtener todas las categorías
  async cargarCategorias(): Promise<void> {
    try {
      console.log('🔄 Cargando categorías...');

      const { data, error } = await this.supabaseService.client
        .from('categorias')
        .select('*')
        .eq('activo', true) // Solo categorías activas
        .order('nombre', { ascending: true }); // Ordenar alfabéticamente

      if (error) {
        console.error('❌ Error al cargar categorías:', error);
        throw error;
      }

      console.log('✅ Categorías cargadas:', data?.length || 0);

      // Emitir las nuevas categorías a todos los suscriptores
      this.categoriasSubject.next(data || []);

    } catch (error) {
      console.error('💥 Error en cargarCategorias:', error);
      throw error;
    }
  }

  // Método para obtener TODAS las categorías (activas e inactivas)
  async cargarTodasCategorias(): Promise<Categoria[]> {
    try {
      console.log('🔄 Cargando todas las categorías...');

      const { data, error } = await this.supabaseService.client
        .from('categorias')
        .select('*')
        .order('nombre', { ascending: true }); // Ordenar alfabéticamente

      if (error) {
        console.error('❌ Error al cargar todas las categorías:', error);
        throw error;
      }

      console.log('✅ Todas las categorías cargadas:', data?.length || 0);
      return data || [];

    } catch (error) {
      console.error('💥 Error en cargarTodasCategorias:', error);
      throw error;
    }
  }

  // Método para crear una nueva categoría
  async crearCategoria(categoria: CrearCategoria): Promise<Categoria> {
    try {
      console.log('🔄 Creando categoría:', categoria.nombre);

      const { data, error } = await this.supabaseService.client
        .from('categorias')
        .insert([{
          nombre: categoria.nombre,
          descripcion: categoria.descripcion || null,
          color: categoria.color,
          activo: categoria.activo !== false,
          negocio_id: this.authService.getNegocioId() // Multi-tenant support
        }])
        .select() // Devolver el registro creado
        .single(); // Esperar un solo resultado

      if (error) {
        console.error('❌ Error al crear categoría:', error);

        // Manejar error de nombre duplicado
        if (error.code === '23505') {
          throw new Error(`Ya existe una categoría con el nombre "${categoria.nombre}"`);
        }

        throw error;
      }

      console.log('✅ Categoría creada:', data.nombre);

      // Recargar la lista para actualizar todos los componentes
      try {
        await this.cargarCategorias();
      } catch (reloadError) {
        console.warn('⚠️ Categoría creada pero error al recargar lista:', reloadError);
        // No lanzamos el error para que la UI sepa que se creó correctamente
      }

      return data;

    } catch (error) {
      console.error('💥 Error en crearCategoria:', error);
      throw error;
    }
  }

  // Método para actualizar una categoría
  async actualizarCategoria(id: number, categoria: Partial<Categoria>): Promise<Categoria> {
    try {
      if (!id || typeof id !== 'number') {
        throw new Error('ID de categoría inválido para actualización');
      }

      // Crear objeto de actualización explícito para evitar errores 400
      const updateData: any = {};

      if (categoria.nombre !== undefined) updateData.nombre = categoria.nombre;
      if (categoria.descripcion !== undefined) updateData.descripcion = categoria.descripcion || null;
      if (categoria.color !== undefined) updateData.color = categoria.color;
      if (categoria.activo !== undefined) updateData.activo = categoria.activo;

      console.log('📡 Enviando actualización a Supabase:', { id, updateData });

      const { data, error } = await this.supabaseService.client
        .from('categorias')
        .update(updateData)
        .eq('id', id)
        .select();

      if (error) {
        console.error('❌ Error al actualizar categoría:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error(`No se encontró la categoría con ID ${id} para actualizar`);
      }

      const updatedCategory = data[0];
      console.log('✅ Categoría actualizada:', updatedCategory.nombre);

      // Recargar la lista
      await this.cargarCategorias();

      return updatedCategory;

    } catch (error) {
      console.error('💥 Error en actualizarCategoria:', error);
      throw error;
    }
  }

  // Método para "eliminar" (desactivar) una categoría
  async eliminarCategoria(id: number): Promise<void> {
    try {
      console.log('🔄 Desactivando categoría ID:', id);

      // No eliminamos físicamente, solo desactivamos
      // Eliminado updated_at ya que no existe en la tabla 'categorias'
      const { error } = await this.supabaseService.client
        .from('categorias')
        .update({
          activo: false
        })
        .eq('id', id);

      if (error) {
        console.error('❌ Error al desactivar categoría:', error);
        throw error;
      }

      console.log('✅ Categoría desactivada');

      // Recargar la lista
      await this.cargarCategorias();

    } catch (error) {
      console.error('💥 Error en eliminarCategoria:', error);
      throw error;
    }
  }

  // Método para verificar si una categoría tiene productos asociados
  async verificarProductosEnCategoria(categoriaId: number): Promise<number> {
    try {
      console.log('🔄 Verificando productos en categoría ID:', categoriaId);

      const { count, error } = await this.supabaseService.client
        .from('productos')
        .select('*', { count: 'exact', head: true })
        .eq('categoria_id', categoriaId);

      if (error) {
        console.error('❌ Error al verificar productos:', error);
        throw error;
      }

      console.log('✅ Productos encontrados:', count || 0);
      return count || 0;

    } catch (error) {
      console.error('💥 Error en verificarProductosEnCategoria:', error);
      throw error;
    }
  }

  // Método para eliminar físicamente una categoría (solo si no tiene productos)
  async eliminarCategoriaFisicamente(id: number): Promise<void> {
    try {
      console.log('🔄 Eliminando físicamente categoría ID:', id);

      const { error } = await this.supabaseService.client
        .from('categorias')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Error al eliminar categoría:', error);
        throw error;
      }

      console.log('✅ Categoría eliminada físicamente');

      // Recargar la lista
      await this.cargarCategorias();

    } catch (error) {
      console.error('💥 Error en eliminarCategoriaFisicamente:', error);
      throw error;
    }
  }

  // Método para obtener categorías activas (útil para selects)
  getCategoriasActivas(): Categoria[] {
    return this.categoriasSubject.value.filter(cat => cat.activo);
  }

  // Método para buscar categoría por nombre
  buscarPorNombre(nombre: string): Categoria | undefined {
    return this.categoriasSubject.value.find(
      cat => cat.nombre.toLowerCase() === nombre.toLowerCase()
    );
  }
}