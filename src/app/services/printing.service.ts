import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type TicketFormat = '80mm' | '58mm' | 'a4';

@Injectable({
  providedIn: 'root'
})
export class PrintingService {
  private readonly STORAGE_KEY = 'preferred_ticket_format';
  private formatSubject = new BehaviorSubject<TicketFormat>(this.getStoredFormat());
  
  format$ = this.formatSubject.asObservable();

  constructor() { }

  private getStoredFormat(): TicketFormat {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored === '80mm' || stored === '58mm' || stored === 'a4') {
      return stored as TicketFormat;
    }
    return '80mm'; // Default
  }

  setFormat(format: TicketFormat) {
    localStorage.setItem(this.STORAGE_KEY, format);
    this.formatSubject.next(format);
  }

  get currentFormat(): TicketFormat {
    return this.formatSubject.value;
  }
}
