import { Routes } from '@angular/router';
import { Login } from './login';
import { AuthCallback } from './callback';

export default [
    { path: 'login', component: Login },
    { path: 'callback', component: AuthCallback },
    { path: '', pathMatch: 'full', redirectTo: 'login' }
] as Routes;
