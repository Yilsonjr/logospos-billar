import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Desactivar logs en producción para seguridad y rendimiento
// ngDevMode es un global que Angular establece automáticamente:
// - true en development build (ng serve / ng build --configuration=development)
// - false/undefined en production build (ng build --configuration=production)
if (typeof ngDevMode === 'undefined' || !ngDevMode) {
  console.log = () => { };
  console.warn = () => { };
  // console.error se mantiene para errores críticos
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
