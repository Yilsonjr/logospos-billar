import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class ImagenService {
  private readonly DEFAULT_BUCKET = 'productos-imagenes';

  constructor(private supabaseService: SupabaseService) {}

  /**
   * Subir imagen a Supabase Storage
   */
  async subirImagen(file: File, options?: { bucket?: string, id?: number | string }): Promise<{ url: string; nombre: string }> {
    try {
      const bucket = options?.bucket || this.DEFAULT_BUCKET;
      const id = options?.id;

      const timestamp = Date.now();
      const extension = file.name.split('.').pop();
      const nombreArchivo = id 
        ? `img_${id}_${timestamp}.${extension}`
        : `img_${timestamp}.${extension}`;

      const { data, error } = await this.supabaseService.client.storage
        .from(bucket)
        .upload(nombreArchivo, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      const { data: urlData } = this.supabaseService.client.storage
        .from(bucket)
        .getPublicUrl(nombreArchivo);

      return { url: urlData.publicUrl, nombre: nombreArchivo };
    } catch (error) {
      console.error('💥 Error en subirImagen:', error);
      throw error;
    }
  }

  /**
   * Eliminar imagen de Supabase Storage
   */
  async eliminarImagen(nombreArchivo: string, bucket: string = this.DEFAULT_BUCKET): Promise<void> {
    try {
      const { error } = await this.supabaseService.client.storage
        .from(bucket)
        .remove([nombreArchivo]);
      if (error) throw error;
    } catch (error) {
      console.error('💥 Error en eliminarImagen:', error);
      throw error;
    }
  }

  /**
   * Actualizar imagen
   */
  async actualizarImagen(
    file: File, 
    imagenAnterior: string | undefined, 
    options?: { bucket?: string, id?: number | string }
  ): Promise<{ url: string; nombre: string }> {
    try {
      const bucket = options?.bucket || this.DEFAULT_BUCKET;
      if (imagenAnterior) {
        await this.eliminarImagen(imagenAnterior, bucket);
      }
      return await this.subirImagen(file, options);
    } catch (error) {
      console.error('💥 Error en actualizarImagen:', error);
      throw error;
    }
  }

  /**
   * Validar archivo de imagen
   */
  validarImagen(file: File): { valido: boolean; mensaje?: string } {
    const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(file.type)) {
      return { valido: false, mensaje: 'Solo se permiten imágenes JPG, PNG o WebP' };
    }
    const tamañoMaximo = 5 * 1024 * 1024;
    if (file.size > tamañoMaximo) {
      return { valido: false, mensaje: 'La imagen no debe superar los 5MB' };
    }
    return { valido: true };
  }
}

