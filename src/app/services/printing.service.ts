import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import 'tslib';

/**
 * Service to manage printing preferences across the application.
 * Persists the preferred ticket format (80mm, 58mm, a4) in localStorage.
 */

export type TicketFormat = '80mm' | '58mm' | 'a4';

@Injectable({
  providedIn: 'root'
})
export class PrintingService {
  private readonly STORAGE_KEY = 'preferred_ticket_format';
  private formatSubject: BehaviorSubject<TicketFormat>;
  
  public format$;

  constructor() {
    const initialFormat = this.getStoredFormat();
    this.formatSubject = new BehaviorSubject<TicketFormat>(initialFormat);
    this.format$ = this.formatSubject.asObservable();
  }

  private getStoredFormat(): TicketFormat {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored === '80mm' || stored === '58mm' || stored === 'a4') {
        return stored as TicketFormat;
      }
    }
    return '80mm'; // Default format
  }

  setFormat(format: TicketFormat): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, format);
    }
    this.formatSubject.next(format);
  }

  get currentFormat(): TicketFormat {
    return this.formatSubject.value;
  }
}
