import { NgClass, NgFor } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-video-grid',
  imports: [NgFor, NgClass],
  templateUrl: './video-grid.component.html',
  styleUrl: './video-grid.component.css'
})
export class VideoGridComponent {
  @Input() participants: any[] = [];

  get gridClass() {
    const count = this.participants.length;
    if (count <= 1) return 'grid-cols-1';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 9) return 'grid-cols-3';
    return 'grid-cols-4';
  }
}
