import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '@/services/auth.service';

/**
 * Lands here after Google OAuth round-trip — supabase-js auto-detects
 * the `?code=...` param (because `detectSessionInUrl: true`) and
 * exchanges it for a session. We just wait for the session + profile
 * signals to materialize, then route based on admin role.
 *
 * Three timeout-bound failure modes — all redirect back to /auth/login
 * with a `reason=` query param the login page surfaces inline:
 *  - `oauth-failed` — provider returned an error or the URL had no code
 *  - `oauth-timeout` — supabase-js never fired SIGNED_IN within 8s
 *  - `not-admin` — session arrived but user.role is 'client'
 */
@Component({
    selector: 'app-auth-callback',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="callback-shell">
            <div class="callback-card">
                <div class="spinner-ring"></div>
                <div class="callback-title">{{ message() }}</div>
                <div class="callback-sub">Almost there…</div>
            </div>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
            }
            .callback-shell {
                position: fixed;
                inset: 0;
                background: var(--p-primary-950, #050608);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            }
            .callback-card {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 14px;
                color: #fff;
                text-align: center;
            }
            .spinner-ring {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                border: 3px solid rgba(255, 255, 255, 0.15);
                border-top-color: #e27a34;
                animation: cb-spin 800ms linear infinite;
            }
            .callback-title {
                font-size: 16px;
                font-weight: 700;
                letter-spacing: -0.2px;
            }
            .callback-sub {
                font-size: 13px;
                font-weight: 500;
                color: rgba(255, 255, 255, 0.55);
            }
            @keyframes cb-spin {
                to {
                    transform: rotate(360deg);
                }
            }
        `
    ]
})
export class AuthCallback {
    private auth = inject(AuthService);
    private router = inject(Router);

    readonly message = signal('Signing you in');

    private settled = false;

    constructor() {
        // React to session + profile arriving from the OAuth code exchange.
        effect(async () => {
            if (this.settled) return;
            const session = this.auth.session();
            const profile = this.auth.profile();
            if (!session || !profile) return;

            this.settled = true;

            if (profile.role === 'admin' || profile.role === 'superadmin') {
                this.message.set('Welcome back');
                await this.router.navigateByUrl('/');
                return;
            }

            // Authed but not admin — clear session and bounce back.
            await this.auth.signOut();
            await this.router.navigate(['/auth/login'], {
                replaceUrl: true,
                queryParams: { reason: 'not-admin' }
            });
        });

        // Timeout safety net — if supabase-js never fires SIGNED_IN
        // (provider error, blocked popup, etc.) bail back to login.
        setTimeout(async () => {
            if (this.settled) return;
            this.settled = true;
            const reason = this.auth.session() ? 'profile-load-failed' : 'oauth-failed';
            await this.router.navigate(['/auth/login'], {
                replaceUrl: true,
                queryParams: { reason }
            });
        }, 8000);
    }
}
