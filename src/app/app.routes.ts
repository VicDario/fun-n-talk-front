import { Routes } from '@angular/router';
import { chatRoomGuard } from './guards/chat-room.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./join-screen/join-screen.component').then((c) => c.JoinScreenComponent) },
  { path: 'chat-room', loadComponent: () => import('./chat-room/chat-room.component').then((c) => c.ChatRoomComponent), canActivate: [chatRoomGuard] },
];
