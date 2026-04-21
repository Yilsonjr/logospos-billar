import { Component, OnInit } from '@angular/core';
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
    private imagenService: ImagenService
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
    try {
      const data = await this.negociosService.cargarNegocio();
      if (data) {
        this.negocioActual = data;
        this.negocioForm.patchValue(data);
        if (data.logo_url) {
          this.logoPreview = data.logo_url;
        }
      }
    } catch (error) {
      console.error('Error al cargar datos del negocio:', error);
    } finally {
      this.loading = false;
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
    try {
      let logoUrl = this.negocioActual?.logo_url;

      // Subir logo si se seleccionó uno nuevo
      if (this.selectedFile) {
        const uploadResult = await this.imagenService.actualizarImagen(
          this.selectedFile,
          this.negocioActual?.logo_url?.split('/').pop(), // Nombre del archivo anterior
          { bucket: 'productos-imagenes', id: 'logo-negocio' }
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
    }
  }

  eliminarLogo() {
      this.logoPreview = null;
      this.selectedFile = null;
      // Nota: Aquí podrías añadir lógica para eliminarlo de storage si lo deseas
  }
}
