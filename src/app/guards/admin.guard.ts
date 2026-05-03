import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guards every route under the admin shell. A non-admin session is
 * actively signed out before redirect — we don't want a stale "I'm
 * authed but rejected" state hanging around in localStorage.
 */
export const adminGuard: CanActivateFn = async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.whenReady;

    if (!auth.isAuthed()) {
        return router.createUrlTree(['/auth/login']);
    }

    if (!auth.isAdmin()) {
        await auth.signOut();
        return router.createUrlTree(['/auth/login'], {
            queryParams: { reason: 'not-admin' }
        });
    }

    return true;
};
