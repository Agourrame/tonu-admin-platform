import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { LayoutService } from '@/layout/service/layout.service';
import { AuthService } from '@/services/auth.service';

/**
 * Slide-over drawer triggered by the topbar avatar button. Shows the
 * current admin's identity and offers the sign-out action.
 *
 * Replaces the Apollo demo template's hardcoded notifications/messages
 * sections — none of which would have made sense in the admin tool
 * (real notifications go through the in-app `notifications` table, not
 * a drawer).
 */
@Component({
    selector: '[app-profilesidebar]',
    standalone: true,
    imports: [CommonModule, ButtonModule, DrawerModule],
    template: `
        <p-drawer
            [visible]="visible()"
            (onHide)="onDrawerHide()"
            position="right"
            [transitionOptions]="'.3s cubic-bezier(0, 0, 0.2, 1)'"
            styleClass="layout-profile-sidebar w-full sm:w-[22rem]"
        >
            <div class="profile-card">
                <div class="profile-avatar">
                    {{ initials() }}
                </div>
                <div class="profile-name">
                    {{ profileName() }}
                </div>
                <div class="profile-email">
                    {{ profileEmail() }}
                </div>
                @if (roleLabel(); as label) {
                    <span class="tomo-status is-brand">{{ label }}</span>
                }
            </div>

            <button class="signout-btn" (click)="signOut()" [disabled]="signingOut">
                <i class="pi pi-sign-out"></i>
                <span>{{ signingOut ? 'Signing out…' : 'Sign out' }}</span>
            </button>
        </p-drawer>
    `,
    styles: [
        `
            .profile-card {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                padding: 28px 16px 24px;
                text-align: center;
                border-bottom: 1px solid var(--tomo-divider);
                margin-bottom: 16px;
            }
            .profile-avatar {
                width: 64px;
                height: 64px;
                border-radius: 50%;
                background: var(--tomo-primary);
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                font-weight: 800;
                letter-spacing: 0.5px;
                margin-bottom: 4px;
            }
            .profile-name {
                font-size: 17px;
                font-weight: 700;
                color: var(--tomo-text-strong);
            }
            .profile-email {
                font-size: 13px;
                font-weight: 500;
                color: var(--tomo-text-muted);
            }
            .signout-btn {
                width: 100%;
                height: 48px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                background: var(--tomo-bg-soft);
                border: 0;
                border-radius: var(--tomo-radius-md);
                font-size: 14px;
                font-weight: 600;
                color: var(--tomo-text);
                cursor: pointer;
                transition: background 200ms ease;
            }
            .signout-btn:hover:not(:disabled) {
                background: rgba(229, 57, 53, 0.08);
                color: var(--tomo-danger);
            }
            .signout-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            .signout-btn i {
                font-size: 16px;
            }
        `
    ]
})
export class AppProfileSidebar {
    private auth = inject(AuthService);
    private layoutService = inject(LayoutService);
    private router = inject(Router);

    signingOut = false;

    readonly visible = computed(() => this.layoutService.layoutState().profileSidebarVisible);

    readonly profileName = computed(() => this.auth.profile()?.full_name ?? 'TOMO Admin');
    readonly profileEmail = computed(() => this.auth.authUser()?.email ?? '');
    readonly roleLabel = computed(() => {
        const role = this.auth.profile()?.role;
        if (role === 'superadmin') return 'Superadmin';
        if (role === 'admin') return 'Admin';
        return null;
    });

    readonly initials = computed(() => {
        const name = this.auth.profile()?.full_name?.trim();
        if (!name) return 'A';
        const parts = name.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
        return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    });

    onDrawerHide() {
        this.layoutService.layoutState.update((state) => ({
            ...state,
            profileSidebarVisible: false
        }));
    }

    async signOut() {
        if (this.signingOut) return;
        this.signingOut = true;
        await this.auth.signOut();
        this.signingOut = false;
        this.onDrawerHide();
        await this.router.navigateByUrl('/auth/login');
    }
}
