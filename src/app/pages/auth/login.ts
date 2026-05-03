import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { AuthService } from '@/services/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, ButtonModule, InputTextModule, IconFieldModule, InputIconModule],
    template: `
        <!-- Slate hero canvas — fills viewport, TOMO palette via Aura tokens -->
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1600 800"
            class="fixed left-0 top-0 min-h-screen min-w-[100vw] -z-10"
            preserveAspectRatio="none"
        >
            <rect fill="var(--p-primary-950)" width="1600" height="800" />
            <path
                fill="var(--p-primary-900)"
                d="M478.4 581c3.2 0.8 6.4 1.7 9.5 2.5c196.2 52.5 388.7 133.5 593.5 176.6c174.2 36.6 349.5 29.2 518.6-10.2V0H0v574.9c52.3-17.6 106.5-27.7 161.1-30.9C268.4 537.4 375.7 554.2 478.4 581z"
            />
            <path
                fill="var(--p-primary-800)"
                d="M181.8 259.4c98.2 6 191.9 35.2 281.3 72.1c2.8 1.1 5.5 2.3 8.3 3.4c171 71.6 342.7 158.5 531.3 207.7c198.8 51.8 403.4 40.8 597.3-14.8V0H0v283.2C59 263.6 120.6 255.7 181.8 259.4z"
            />
            <path
                fill="var(--p-primary-700)"
                d="M454.9 86.3C600.7 177 751.6 269.3 924.1 325c208.6 67.4 431.3 60.8 637.9-5.3c12.8-4.1 25.4-8.4 38.1-12.9V0H288.1c56 21.3 108.7 50.6 159.7 82C450.2 83.4 452.5 84.9 454.9 86.3z"
            />
            <path
                fill="var(--p-primary-600)"
                d="M1397.5 154.8c47.2-10.6 93.6-25.3 138.6-43.8c21.7-8.9 43-18.8 63.9-29.5V0H643.4c62.9 41.7 129.7 78.2 202.1 107.4C1020.4 178.1 1214.2 196.1 1397.5 154.8z"
            />
        </svg>

        <div class="px-8 min-h-screen flex justify-center items-center">
            <div class="login-card tomo-anim-item">
                <!-- TOMO mark -->
                <div class="login-brand">
                    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="TOMO">
                        <rect x="2" y="2" width="60" height="60" rx="14" fill="#242830" />
                        <path d="M14 38 L24 26 L40 26 L50 38" stroke="#e27a34" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                        <circle cx="22" cy="42" r="3.5" fill="#e27a34" />
                        <circle cx="42" cy="42" r="3.5" fill="#e27a34" />
                        <rect x="20" y="38" width="24" height="3" rx="1.5" fill="#e27a34" />
                    </svg>
                </div>

                <div class="tomo-page-titlebar" style="text-align: center; align-items: center;">
                    <span class="tomo-eyebrow">TOMO Admin</span>
                    <h1 class="tomo-h1">Sign in</h1>
                    <p class="tomo-sub">Authorized accounts only — admin or superadmin role required.</p>
                </div>

                <form class="login-form" (ngSubmit)="onSubmit()" #f="ngForm">
                    <div class="form-row">
                        <p-iconfield class="w-full">
                            <p-inputicon class="pi pi-envelope" />
                            <input
                                id="email"
                                type="email"
                                pInputText
                                class="login-input"
                                placeholder="Email"
                                autocomplete="username"
                                required
                                [(ngModel)]="email"
                                name="email"
                                (ngModelChange)="error.set(null)"
                                [disabled]="loading()"
                            />
                        </p-iconfield>
                    </div>

                    <div class="form-row">
                        <p-iconfield class="w-full">
                            <p-inputicon class="pi pi-lock" />
                            <input
                                id="password"
                                [type]="showPassword() ? 'text' : 'password'"
                                pInputText
                                class="login-input"
                                placeholder="Password"
                                autocomplete="current-password"
                                required
                                [(ngModel)]="password"
                                name="password"
                                (ngModelChange)="error.set(null)"
                                [disabled]="loading()"
                            />
                            <button
                                type="button"
                                class="reveal-btn"
                                (click)="showPassword.set(!showPassword())"
                                [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                            >
                                <i [class]="showPassword() ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                            </button>
                        </p-iconfield>
                    </div>

                    @if (error(); as err) {
                        <div class="login-error" role="alert">
                            <i class="pi pi-exclamation-circle"></i>
                            <span>{{ err }}</span>
                        </div>
                    }

                    <button
                        type="submit"
                        class="tomo-pill-cta w-full"
                        [disabled]="!canSubmit()"
                    >
                        @if (loading()) {
                            <i class="pi pi-spin pi-spinner mr-2"></i>
                        }
                        {{ loading() ? 'Signing in…' : 'Sign in' }}
                    </button>

                    <div class="auth-divider">
                        <span>or continue with</span>
                    </div>

                    <button
                        type="button"
                        class="oauth-btn"
                        (click)="onGoogleClick()"
                        [disabled]="loading() || googleLoading()"
                    >
                        @if (googleLoading()) {
                            <i class="pi pi-spin pi-spinner"></i>
                        } @else {
                            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            <span>Continue with Google</span>
                        }
                    </button>
                </form>
            </div>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
                position: relative;
            }
            .login-card {
                position: relative;
                width: 100%;
                max-width: 420px;
                padding: 40px 32px;
                background: rgba(255, 255, 255, 0.98);
                backdrop-filter: blur(8px);
                border-radius: 20px;
                box-shadow:
                    0 24px 80px rgba(0, 0, 0, 0.32),
                    0 0 0 1px rgba(255, 255, 255, 0.06);
                z-index: 10;
            }
            .login-brand {
                display: flex;
                justify-content: center;
                margin-bottom: 24px;
                svg {
                    width: 56px;
                    height: 56px;
                    display: block;
                    filter: drop-shadow(0 4px 12px rgba(36, 40, 48, 0.18));
                }
            }
            .login-form {
                display: flex;
                flex-direction: column;
                gap: 14px;
                margin-top: 4px;
            }
            .form-row {
                position: relative;
            }
            .login-input {
                width: 100%;
                height: 52px;
                border: 0;
                border-radius: 999px;
                padding-left: 50px;
                padding-right: 50px;
                background: #f5f6f8;
                font-size: 14.5px;
                font-weight: 500;
                color: #1a1a1a;
                outline: none;
                transition: background 200ms ease, box-shadow 200ms ease;
            }
            .login-input::placeholder {
                color: #888;
            }
            .login-input:focus {
                background: #fff;
                box-shadow: 0 0 0 1.5px #242830;
            }
            ::ng-deep p-iconfield .p-iconfield {
                width: 100%;
            }
            ::ng-deep p-inputicon.pi {
                left: 18px;
                color: #888;
                z-index: 1;
            }
            .reveal-btn {
                position: absolute;
                right: 14px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: 0;
                padding: 8px;
                cursor: pointer;
                color: #888;
                line-height: 0;
                z-index: 2;
            }
            .reveal-btn:hover {
                color: #242830;
            }
            .login-error {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 12px 14px;
                background: rgba(229, 57, 53, 0.08);
                border-radius: 12px;
                font-size: 13px;
                color: #c92a27;
                font-weight: 500;
                line-height: 1.4;
                i {
                    flex-shrink: 0;
                    margin-top: 1px;
                }
            }
            .tomo-pill-cta {
                margin-top: 8px;
            }
            .auth-divider {
                display: flex;
                align-items: center;
                gap: 12px;
                margin: 16px 0 4px;
                color: #aaa;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 1.4px;
                text-transform: uppercase;
            }
            .auth-divider::before,
            .auth-divider::after {
                content: '';
                flex: 1;
                height: 1px;
                background: #ececec;
            }
            .oauth-btn {
                width: 100%;
                height: 56px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                background: #fff;
                color: #1a1a1a;
                border: 1.5px solid #ececec;
                border-radius: 999px;
                font-size: 14.5px;
                font-weight: 600;
                cursor: pointer;
                transition: background 200ms ease, border-color 200ms ease;
            }
            .oauth-btn:hover:not(:disabled) {
                background: #f9fafb;
                border-color: #d8d8d8;
            }
            .oauth-btn:disabled {
                opacity: 0.55;
                cursor: not-allowed;
            }
            .oauth-btn svg {
                flex-shrink: 0;
            }
        `
    ]
})
export class Login {
    private auth = inject(AuthService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    readonly email = signal('');
    readonly password = signal('');
    readonly showPassword = signal(false);
    readonly loading = signal(false);
    readonly googleLoading = signal(false);
    readonly error = signal<string | null>(null);

    readonly canSubmit = computed(() => {
        return !this.loading() && !this.googleLoading() && this.email().trim().length > 0 && this.password().length > 0;
    });

    constructor() {
        // Surface query-param reasons (e.g. adminGuard kicked us back here,
        // or the OAuth callback failed for one of several reasons).
        const reason = this.route.snapshot.queryParamMap.get('reason');
        if (reason === 'not-admin') {
            this.error.set("This account isn't authorized for the admin platform.");
        } else if (reason === 'oauth-failed') {
            this.error.set('Google sign-in didn\'t complete. Please try again.');
        } else if (reason === 'oauth-timeout') {
            this.error.set('Sign-in took too long to respond. Please try again.');
        } else if (reason === 'profile-load-failed') {
            this.error.set('Signed in, but we couldn\'t load your profile. Please try again.');
        }
    }

    async onGoogleClick(): Promise<void> {
        if (this.googleLoading() || this.loading()) return;
        this.error.set(null);
        this.googleLoading.set(true);
        const { error } = await this.auth.signInWithGoogle();
        if (error) {
            this.googleLoading.set(false);
            this.error.set(error.message || 'Google sign-in failed.');
            return;
        }
        // On success, supabase-js redirects the window to Google. The
        // googleLoading spinner stays visible until the page is unmounted
        // by that navigation, so no manual reset is needed.
    }

    async onSubmit(): Promise<void> {
        if (!this.canSubmit()) return;
        this.error.set(null);
        this.loading.set(true);

        const { error } = await this.auth.signIn(this.email().trim(), this.password());

        if (error) {
            this.loading.set(false);
            this.error.set(this.humanizeAuthError(error.message));
            return;
        }

        // Wait for AuthService to hydrate the profile from public.users
        // before checking the admin role — onAuthStateChange fires
        // synchronously with the new session but loadProfile() runs
        // afterward. Poll briefly until profile lands.
        const ok = await this.waitForProfileAndCheckAdmin();

        if (!ok) {
            await this.auth.signOut();
            this.loading.set(false);
            this.error.set("This account isn't authorized for the admin platform.");
            return;
        }

        this.loading.set(false);
        await this.router.navigateByUrl('/');
    }

    private async waitForProfileAndCheckAdmin(): Promise<boolean> {
        // Up to 3s waiting for the public.users row to land.
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline) {
            if (this.auth.profile()) {
                return this.auth.isAdmin();
            }
            await new Promise((r) => setTimeout(r, 50));
        }
        return false;
    }

    private humanizeAuthError(message: string): string {
        const m = message.toLowerCase();
        if (m.includes('invalid login credentials')) return 'Email or password is incorrect.';
        if (m.includes('email not confirmed')) return 'This email has not been confirmed yet.';
        if (m.includes('rate')) return 'Too many attempts — please wait a moment and try again.';
        return message || 'Sign-in failed. Please try again.';
    }
}
