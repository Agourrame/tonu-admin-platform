import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Attached to /auth/* — bounces already-authed admins straight to the
 * dashboard so they don't see the login page after a refresh.
 * Non-admins (somehow ending up at /auth/login while authed) are
 * allowed through so the login page can show "wrong account" errors.
 */
export const redirectIfAuthedGuard: CanActivateFn = async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.whenReady;

    if (auth.isAuthed() && auth.isAdmin()) {
        return router.createUrlTree(['/']);
    }

    return true;
};
