import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NegociosService } from '../../../services/negocios.service';
import { ImagenService } from '../../../services/imagen.service';
import { Negocio } from '../../../models/negocio.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-identidad-negocio',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './identidad-negocio.component.html',
  styleUrl: './identidad-negocio.component.css'
})
export class IdentidadNegocioComponent implements OnInit {
  negocioForm: FormGroup;
  loading = false;
  saving = false;
  logoPreview: string | null = null;
  selectedFile: File | null = null;
  negocioActual: Negocio | null = null;

  constructor(
    private fb: FormBuilder,
    private negociosService: NegociosService,
    private imagenService: ImagenService,
    private cdr: ChangeDetectorRef // Inyectamos el detector de cambios
  ) {
    this.negocioForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      rnc: [''],
      telefono: [''],
      direccion: [''],
      lema: [''],
      email: ['', Validators.email],
      web: ['']
    });
  }

  async ngOnInit() {
    await this.cargarDatos();
  }

  async cargarDatos() {
    this.loading = true;
    this.cdr.detectChanges(); // Forzamos mostrar el spinner

    try {
      const data = await this.negociosService.cargarNegocio();
      
      if (data) {
        this.negocioActual = data;
        this.negocioForm.patchValue(data);
        if (data.logo_url) {
          this.logoPreview = data.logo_url;
        }
      } else {
        console.error('No se pudo cargar la información del negocio.');
        // No mostramos el Swal aquí para evitar interrumpir el flujo si es un error de Zone.js
      }
    } catch (error) {
      console.error('Error al cargar datos del negocio:', error);
    } finally {
      this.loading = false;
      this.cdr.detectChanges(); // 💡 CRÍTICO: Forzamos a Angular a ocultar el spinner y mostrar los datos
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const validation = this.imagenService.validarImagen(file);
      if (!validation.valido) {
        Swal.fire('Error', validation.mensaje, 'error');
        return;
      }

      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.logoPreview = reader.result as string;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  async guardarCambios() {
    if (this.negocioForm.invalid) {
      this.negocioForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.cdr.detectChanges();

    try {
      let logoUrl = this.negocioActual?.logo_url;

      if (this.selectedFile) {
        const uploadResult = await this.imagenService.actualizarImagen(
          this.selectedFile,
          this.negocioActual?.logo_url?.split('/').pop(),
          { bucket: 'productos-imagenes', id: this.negocioActual?.id || 'logo-negocio' }
        );
        logoUrl = uploadResult.url;
      }

      const datosActualizar = {
        ...this.negocioForm.value,
        logo_url: logoUrl
      };

      await this.negociosService.actualizarNegocio(datosActualizar);
      
      await Swal.fire({
        title: '¡Guardado!',
        text: 'La identidad del negocio se ha actualizado correctamente.',
        icon: 'success',
        confirmButtonColor: '#3699ff'
      });

      this.selectedFile = null;
      await this.cargarDatos();
    } catch (error) {
      console.error('Error al guardar cambios:', error);
      Swal.fire('Error', 'No se pudieron guardar los cambios.', 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  eliminarLogo() {
      this.logoPreview = null;
      this.selectedFile = null;
      this.cdr.detectChanges();
  }
}
