import { Routes } from '@angular/router';
import { AppLayout } from '@/layout/components/app.layout';
import { Notfound } from '@/pages/notfound/notfound';
import { adminGuard } from '@/guards/admin.guard';
import { redirectIfAuthedGuard } from '@/guards/redirect-if-authed.guard';

export const appRoutes: Routes = [
    {
        path: '',
        component: AppLayout,
        canActivate: [adminGuard],
        children: [
            {
                path: '',
                loadComponent: () => import('@/pages/dashboard/dashboard').then(c => c.Dashboard),
                data: { breadcrumb: 'Dashboard' },
            },
            {
                path: 'users',
                loadComponent: () => import('@/pages/users/users').then(c => c.Users),
                data: { breadcrumb: 'Users' },
            },
            {
                path: 'agencies',
                loadComponent: () => import('@/pages/agencies/agencies').then(c => c.Agencies),
                data: { breadcrumb: 'Agencies' },
            },
            {
                path: 'vehicles',
                loadComponent: () => import('@/pages/vehicles/vehicles').then(c => c.Vehicles),
                data: { breadcrumb: 'Vehicles' },
            },
            {
                path: 'reservations',
                loadComponent: () => import('@/pages/reservations/reservations').then(c => c.Reservations),
                data: { breadcrumb: 'Reservations' },
            },
            {
                path: 'payments',
                loadComponent: () => import('@/pages/payments/payments').then(c => c.Payments),
                data: { breadcrumb: 'Payments' },
            },
            {
                path: 'reviews',
                loadComponent: () => import('@/pages/reviews/reviews').then(c => c.Reviews),
                data: { breadcrumb: 'Reviews' },
            },
            {
                path: 'plans',
                loadComponent: () => import('@/pages/plans/plans').then(c => c.Plans),
                data: { breadcrumb: 'Subscription plans' },
            },
            {
                path: 'help-articles',
                loadComponent: () => import('@/pages/help-articles/help-articles').then(c => c.HelpArticles),
                data: { breadcrumb: 'Help articles' },
            },
            {
                path: 'platform-config',
                loadComponent: () => import('@/pages/platform-config/platform-config').then(c => c.PlatformConfig),
                data: { breadcrumb: 'Platform config' },
            },
        ],
    },
    { path: 'notfound', component: Notfound },
    {
        path: 'auth',
        canActivate: [redirectIfAuthedGuard],
        loadChildren: () => import('@/pages/auth/auth.routes'),
    },
    { path: '**', redirectTo: '/notfound' },
];
