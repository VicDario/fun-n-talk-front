import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./join-screen/join-screen.component').then((c) => c.JoinScreenComponent) },
];
