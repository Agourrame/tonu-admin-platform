import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawerModule } from 'primeng/drawer';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { User } from '@/models/user';
import { UserRole } from '@/models/enums';
import { SignedKycUrls, UsersService } from '@/services/users.service';
import { AuthService } from '@/services/auth.service';

interface DocSlot {
    key: keyof SignedKycUrls;
    label: string;
    aspect: 'wide' | 'square';
}

interface RejectReason {
    code: string;
    label: string;
}

const DOC_SLOTS: DocSlot[] = [
    { key: 'cinFront', label: 'CIN — front', aspect: 'wide' },
    { key: 'cinBack', label: 'CIN — back', aspect: 'wide' },
    { key: 'licenseFront', label: 'License — front', aspect: 'wide' },
    { key: 'licenseBack', label: 'License — back', aspect: 'wide' },
    { key: 'selfie', label: 'Live selfie', aspect: 'square' }
];

const REJECT_REASONS: RejectReason[] = [
    { code: 'cin_blurry', label: 'CIN photo too blurry to read' },
    { code: 'license_expired', label: 'Driver\'s license is expired' },
    { code: 'selfie_mismatch', label: 'Selfie does not match CIN photo' },
    { code: 'incomplete_docs', label: 'Some documents are missing' },
    { code: 'other', label: 'Other (specify below)' }
];

const ROLE_OPTIONS: { label: string; value: UserRole }[] = [
    { label: 'Client', value: 'client' },
    { label: 'Admin', value: 'admin' },
    { label: 'Superadmin', value: 'superadmin' }
];

/**
 * Slide-in detail panel for a single user row. Hosts every admin action
 * tied to one user — KYC review, role changes, blacklist toggle.
 *
 * Emits `changed` after any successful mutation so the parent list can
 * refetch the row and keep its rendering in sync. Emits `close` on
 * dismiss so the parent can clear `selectedUser`.
 */
@Component({
    selector: 'app-user-detail-drawer',
    standalone: true,
    imports: [CommonModule, FormsModule, DrawerModule, DialogModule, ButtonModule, SelectModule, TextareaModule, ToggleSwitchModule],
    template: `
        <p-drawer
            [visible]="visible()"
            (onHide)="onDrawerHide()"
            position="right"
            [style]="{ width: '520px' }"
            [transitionOptions]="'.3s cubic-bezier(0, 0, 0.2, 1)'"
            styleClass="user-detail-drawer"
            [showCloseIcon]="true"
        >
            @if (user(); as u) {
                <div class="drawer-content">
                    <!-- Header -->
                    <div class="user-header">
                        <div class="avatar-lg">{{ initials(u) }}</div>
                        <div class="who">
                            <div class="name-row">
                                <span class="name">{{ u.full_name || '—' }}</span>
                                @if (u.is_blacklisted) {
                                    <span class="tomo-status is-danger">Blacklisted</span>
                                }
                            </div>
                            <div class="email">{{ u.email }}</div>
                            @if (u.phone) {
                                <div class="phone">{{ u.phone }}</div>
                            }
                            <div class="status-row">
                                <span class="tomo-status" [ngClass]="statusClass(u.verification_status)">
                                    {{ u.verification_status }}
                                </span>
                                <span class="role-tag">{{ u.role }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Identity facts -->
                    <div class="section">
                        <div class="tomo-field-label">Identity</div>
                        <dl class="facts">
                            <dt>City</dt>
                            <dd>{{ u.city || '—' }}</dd>
                            <dt>Date of birth</dt>
                            <dd>{{ u.date_of_birth || '—' }}</dd>
                            <dt>CIN number</dt>
                            <dd>{{ u.cin_number || '—' }}</dd>
                            <dt>License number</dt>
                            <dd>{{ u.license_number || '—' }}</dd>
                            <dt>License expiry</dt>
                            <dd [class.dim]="!u.license_expiry_date">{{ u.license_expiry_date || '—' }}</dd>
                            <dt>License categories</dt>
                            <dd>
                                @if (u.license_categories.length) {
                                    @for (cat of u.license_categories; track cat) {
                                        <span class="cat-pill">{{ cat }}</span>
                                    }
                                } @else {
                                    <span class="dim">—</span>
                                }
                            </dd>
                        </dl>
                    </div>

                    <!-- KYC dossier -->
                    <div class="section">
                        <div class="tomo-field-label">KYC documents</div>
                        @if (u.verification_status === 'rejected' && u.verification_rejection_reason) {
                            <div class="reject-banner">
                                <div class="reject-banner-title">Last rejection</div>
                                <div class="reject-banner-text">{{ u.verification_rejection_reason }}</div>
                            </div>
                        }
                        <div class="docs-grid">
                            @for (slot of slots; track slot.key) {
                                <div class="doc-tile" [class.is-square]="slot.aspect === 'square'">
                                    <div class="doc-label">{{ slot.label }}</div>
                                    @if (signedUrls()[slot.key]; as url) {
                                        <a class="doc-frame" [href]="url" target="_blank" rel="noopener">
                                            <img [src]="url" [alt]="slot.label" loading="lazy" />
                                        </a>
                                    } @else {
                                        <div class="doc-frame is-empty">
                                            <i class="pi pi-image"></i>
                                            <span>Not uploaded</span>
                                        </div>
                                    }
                                </div>
                            }
                        </div>
                        <div class="kyc-meta">
                            <span>Submitted: {{ formatRelative(u.verification_submitted_at) }}</span>
                            @if (u.verification_reviewed_at) {
                                <span>· Reviewed: {{ formatRelative(u.verification_reviewed_at) }}</span>
                            }
                        </div>
                    </div>

                    <!-- KYC actions -->
                    @if (u.verification_status === 'pending' || u.verification_status === 'rejected') {
                        <div class="action-row">
                            <p-button
                                label="Approve KYC"
                                icon="pi pi-check"
                                severity="success"
                                [loading]="actionLoading() === 'approve'"
                                [disabled]="!!actionLoading()"
                                (onClick)="onApprove()"
                                styleClass="kyc-btn approve"
                            />
                            <p-button
                                label="Reject"
                                icon="pi pi-times"
                                severity="danger"
                                [outlined]="true"
                                [disabled]="!!actionLoading()"
                                (onClick)="openRejectModal()"
                                styleClass="kyc-btn reject"
                            />
                        </div>
                    } @else if (u.verification_status === 'verified') {
                        <div class="verified-banner">
                            <i class="pi pi-shield"></i>
                            <span>Verified — this user can complete bookings.</span>
                        </div>
                    }

                    <!-- Side stats / settings -->
                    <div class="section side-stats">
                        <div class="stat-row">
                            <div class="stat-key">Reservations</div>
                            <div class="stat-val">{{ reservationCount() }}</div>
                        </div>
                        <div class="stat-row">
                            <div class="stat-key">Trust score</div>
                            <div class="stat-val">
                                @if (u.trust_score !== null) {
                                    <i class="pi pi-star-fill star"></i> {{ u.trust_score }}
                                } @else {
                                    <span class="dim">—</span>
                                }
                            </div>
                        </div>
                        <div class="stat-row">
                            <div class="stat-key">Invite code</div>
                            <div class="stat-val mono">{{ u.invite_code }}</div>
                        </div>
                        <div class="stat-row">
                            <div class="stat-key">Joined</div>
                            <div class="stat-val">{{ formatDate(u.created_at) }}</div>
                        </div>
                    </div>

                    <!-- Admin controls -->
                    <div class="section">
                        <div class="tomo-field-label">Admin controls</div>

                        <button
                            class="control-row"
                            [disabled]="!!actionLoading() || !canEditRole()"
                            (click)="openRoleModal()"
                            type="button"
                        >
                            <div class="control-info">
                                <div class="control-title">Role</div>
                                <div class="control-sub">{{ u.role }}</div>
                            </div>
                            @if (canEditRole()) {
                                <i class="pi pi-pencil"></i>
                            } @else {
                                <span class="dim-small">superadmin only</span>
                            }
                        </button>

                        <label class="control-row toggle-row">
                            <div class="control-info">
                                <div class="control-title">Blacklist</div>
                                <div class="control-sub">
                                    @if (u.is_blacklisted) {
                                        Blocked from booking
                                    } @else {
                                        Account in good standing
                                    }
                                </div>
                            </div>
                            <p-toggleswitch
                                [ngModel]="u.is_blacklisted"
                                (ngModelChange)="onBlacklistToggle($event)"
                                [disabled]="!!actionLoading()"
                            />
                        </label>
                    </div>
                </div>
            }
        </p-drawer>

        <!-- Reject KYC modal -->
        <p-dialog
            [visible]="rejectModalOpen()"
            (onHide)="closeRejectModal()"
            header="Reject KYC"
            [modal]="true"
            [style]="{ width: '480px' }"
            [closable]="true"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="reject-form">
                <p class="modal-sub">
                    The user will see this reason and can re-submit. Be specific so they know what to fix.
                </p>

                <div class="reason-options">
                    @for (r of rejectReasons; track r.code) {
                        <label class="reason-option">
                            <input
                                type="radio"
                                name="rejectReason"
                                [value]="r.code"
                                [(ngModel)]="rejectReasonCode"
                            />
                            <span>{{ r.label }}</span>
                        </label>
                    }
                </div>

                <textarea
                    pTextarea
                    rows="3"
                    [(ngModel)]="rejectExtraText"
                    placeholder="Add a note (optional unless 'Other' selected)…"
                    class="reject-textarea"
                ></textarea>
            </div>

            <ng-template pTemplate="footer">
                <p-button
                    label="Cancel"
                    severity="secondary"
                    [text]="true"
                    (onClick)="closeRejectModal()"
                />
                <p-button
                    label="Reject"
                    severity="danger"
                    [loading]="actionLoading() === 'reject'"
                    [disabled]="!canSubmitReject()"
                    (onClick)="onReject()"
                />
            </ng-template>
        </p-dialog>

        <!-- Change role modal -->
        <p-dialog
            [visible]="roleModalOpen()"
            (onHide)="closeRoleModal()"
            header="Change role"
            [modal]="true"
            [style]="{ width: '420px' }"
            [closable]="true"
            [draggable]="false"
            [resizable]="false"
        >
            @if (user(); as u) {
                <div class="role-form">
                    <div class="role-current">
                        Current: <strong>{{ u.role }}</strong>
                    </div>
                    <p-select
                        [options]="roleOptions"
                        [(ngModel)]="pendingRole"
                        optionLabel="label"
                        optionValue="value"
                        styleClass="role-select"
                    />
                    @if (pendingRole !== 'client' && pendingRole !== u.role) {
                        <div class="role-warning">
                            <i class="pi pi-exclamation-triangle"></i>
                            <span>This grants admin platform access. Make sure you trust this user.</span>
                        </div>
                    }
                </div>
            }

            <ng-template pTemplate="footer">
                <p-button
                    label="Cancel"
                    severity="secondary"
                    [text]="true"
                    (onClick)="closeRoleModal()"
                />
                <p-button
                    label="Confirm"
                    [loading]="actionLoading() === 'role'"
                    [disabled]="!canSubmitRole()"
                    (onClick)="onChangeRole()"
                />
            </ng-template>
        </p-dialog>
    `,
    styles: [
        `
            ::ng-deep .user-detail-drawer .p-drawer-header {
                padding: 14px 18px 0;
            }
            ::ng-deep .user-detail-drawer .p-drawer-content {
                padding: 0;
            }
            .drawer-content {
                padding: 4px 22px 32px;
            }
            .user-header {
                display: flex;
                gap: 14px;
                padding-bottom: 18px;
                border-bottom: 1px solid var(--tomo-divider);
                margin-bottom: 18px;
            }
            .avatar-lg {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: var(--tomo-primary);
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                font-weight: 800;
                letter-spacing: 0.4px;
                flex-shrink: 0;
            }
            .who {
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .name-row {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            .name {
                font-size: 17px;
                font-weight: 800;
                color: var(--tomo-text-strong);
                letter-spacing: -0.2px;
            }
            .email,
            .phone {
                font-size: 13px;
                color: var(--tomo-text-muted);
            }
            .status-row {
                margin-top: 8px;
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }
            .role-tag {
                display: inline-flex;
                align-items: center;
                padding: 0 10px;
                height: 22px;
                border-radius: var(--tomo-radius-pill);
                background: var(--tomo-bg-soft);
                color: var(--tomo-text-secondary);
                font-size: 11px;
                font-weight: 700;
                text-transform: capitalize;
            }
            .section {
                margin-bottom: 22px;
            }
            .facts {
                display: grid;
                grid-template-columns: 130px 1fr;
                gap: 8px 14px;
                margin: 0;
            }
            .facts dt {
                font-size: 12px;
                font-weight: 600;
                color: var(--tomo-text-muted);
                margin: 0;
            }
            .facts dd {
                font-size: 13px;
                font-weight: 500;
                color: var(--tomo-text);
                margin: 0;
                word-break: break-word;
            }
            .cat-pill {
                display: inline-block;
                margin-right: 4px;
                padding: 2px 8px;
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-pill);
                font-size: 11px;
                font-weight: 700;
                color: var(--tomo-text-secondary);
            }
            .docs-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                margin-bottom: 8px;
            }
            .doc-tile {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .doc-label {
                font-size: 11.5px;
                font-weight: 600;
                color: var(--tomo-text-muted);
                text-transform: uppercase;
                letter-spacing: 0.4px;
            }
            .doc-frame {
                position: relative;
                aspect-ratio: 16 / 10;
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                text-decoration: none;
                color: var(--tomo-text-muted);
                transition: filter 200ms ease;
            }
            .doc-frame:hover {
                filter: brightness(0.97);
            }
            .doc-frame img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .doc-frame.is-empty {
                flex-direction: column;
                gap: 6px;
                font-size: 11px;
                font-weight: 600;
                color: var(--tomo-text-faint);
                cursor: default;
            }
            .doc-frame.is-empty:hover {
                filter: none;
            }
            .doc-frame.is-empty i {
                font-size: 22px;
            }
            .doc-tile.is-square .doc-frame {
                aspect-ratio: 1 / 1;
            }
            .kyc-meta {
                display: flex;
                gap: 8px;
                margin-top: 10px;
                font-size: 12px;
                color: var(--tomo-text-muted);
                font-weight: 500;
            }
            .reject-banner {
                background: rgba(229, 57, 53, 0.06);
                border: 1px solid rgba(229, 57, 53, 0.18);
                border-radius: var(--tomo-radius-md);
                padding: 10px 12px;
                margin-bottom: 12px;
            }
            .reject-banner-title {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: var(--tomo-danger);
                margin-bottom: 4px;
            }
            .reject-banner-text {
                font-size: 13px;
                color: var(--tomo-text);
                line-height: 1.45;
            }
            .verified-banner {
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(26, 170, 85, 0.08);
                border-radius: var(--tomo-radius-md);
                padding: 12px 14px;
                font-size: 13px;
                font-weight: 600;
                color: var(--tomo-success);
                margin-bottom: 22px;
            }
            .verified-banner i {
                font-size: 16px;
            }
            .action-row {
                display: flex;
                gap: 10px;
                margin-bottom: 22px;
            }
            ::ng-deep .kyc-btn {
                flex: 1;
            }
            ::ng-deep .kyc-btn .p-button {
                width: 100%;
                height: 46px;
                border-radius: var(--tomo-radius-md);
                font-weight: 700;
                font-size: 14px;
            }
            .side-stats {
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
                padding: 12px 14px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .stat-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 13px;
            }
            .stat-key {
                color: var(--tomo-text-muted);
                font-weight: 500;
            }
            .stat-val {
                color: var(--tomo-text-strong);
                font-weight: 700;
            }
            .stat-val.mono {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 12px;
                letter-spacing: 0.5px;
            }
            .stat-val .star {
                color: var(--tomo-gold);
                font-size: 11px;
                margin-right: 2px;
            }
            .control-row {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 14px;
                margin-top: 8px;
                background: var(--tomo-bg-card);
                border-radius: var(--tomo-radius-md);
                box-shadow: var(--tomo-shadow-card);
                cursor: pointer;
                border: 0;
                text-align: left;
                transition: background 160ms ease;
            }
            .control-row:hover:not(:disabled):not(.toggle-row) {
                background: rgba(36, 40, 48, 0.02);
            }
            .control-row:disabled {
                cursor: not-allowed;
                opacity: 0.7;
            }
            .control-row.toggle-row {
                cursor: default;
            }
            .control-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .control-title {
                font-size: 13.5px;
                font-weight: 700;
                color: var(--tomo-text-strong);
                text-transform: capitalize;
            }
            .control-sub {
                font-size: 12px;
                color: var(--tomo-text-muted);
                font-weight: 500;
            }
            .control-row i {
                color: var(--tomo-text-muted);
                font-size: 14px;
            }
            .dim {
                color: var(--tomo-text-faint);
                font-weight: 500;
            }
            .dim-small {
                color: var(--tomo-text-muted);
                font-size: 11.5px;
                font-weight: 600;
            }

            /* Modals */
            .modal-sub {
                font-size: 13px;
                color: var(--tomo-text-muted);
                line-height: 1.5;
                margin: 0 0 14px;
            }
            .reject-form {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .reason-options {
                display: flex;
                flex-direction: column;
                gap: 6px;
                margin-bottom: 8px;
            }
            .reason-option {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 10px 12px;
                border-radius: var(--tomo-radius-md);
                cursor: pointer;
                transition: background 160ms ease;
                font-size: 13px;
                line-height: 1.4;
            }
            .reason-option:hover {
                background: var(--tomo-bg-soft);
            }
            .reason-option input[type='radio'] {
                margin-top: 2px;
                accent-color: var(--tomo-primary);
            }
            .reject-textarea {
                width: 100%;
                font-size: 13px;
                border-radius: var(--tomo-radius-md);
                resize: vertical;
            }
            .role-form {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .role-current {
                font-size: 13px;
                color: var(--tomo-text-muted);
            }
            .role-current strong {
                color: var(--tomo-text-strong);
                text-transform: capitalize;
            }
            ::ng-deep .role-select {
                width: 100%;
            }
            .role-warning {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 10px 12px;
                background: rgba(245, 158, 11, 0.1);
                border-radius: var(--tomo-radius-md);
                font-size: 12.5px;
                color: var(--tomo-warning);
                font-weight: 600;
                line-height: 1.4;
            }
        `
    ]
})
export class UserDetailDrawer {
    private usersService = inject(UsersService);
    private auth = inject(AuthService);

    readonly user = input<User | null>(null);
    readonly close = output<void>();
    readonly changed = output<void>();

    readonly slots = DOC_SLOTS;
    readonly rejectReasons = REJECT_REASONS;
    readonly roleOptions = ROLE_OPTIONS;

    readonly visible = computed(() => !!this.user());
    readonly canEditRole = computed(() => this.auth.profile()?.role === 'superadmin');

    // ----- side data loaded reactively from `user()` -----
    readonly signedUrls = signal<SignedKycUrls>({});
    readonly reservationCount = signal(0);

    // ----- mutation state -----
    readonly actionLoading = signal<'approve' | 'reject' | 'role' | 'blacklist' | null>(null);

    // ----- reject modal -----
    readonly rejectModalOpen = signal(false);
    rejectReasonCode = '';
    rejectExtraText = '';

    // ----- role modal -----
    readonly roleModalOpen = signal(false);
    pendingRole: UserRole = 'client';

    constructor() {
        // Whenever the input user changes, refresh the side data (signed
        // URLs + reservation count). Debounced via a per-user-id guard
        // so a fast click-through doesn't apply stale data.
        effect(() => {
            const u = this.user();
            if (!u) {
                this.signedUrls.set({});
                this.reservationCount.set(0);
                return;
            }
            void this.loadSideData(u);
        });
    }

    private async loadSideData(u: User): Promise<void> {
        const [urls, count] = await Promise.all([
            this.usersService.signedKycUrls(u),
            this.usersService.reservationCount(u.id)
        ]);
        // Only apply if this is still the user being viewed.
        if (this.user()?.id !== u.id) return;
        this.signedUrls.set(urls);
        this.reservationCount.set(count);
    }

    onDrawerHide(): void {
        this.close.emit();
    }

    // ----- KYC approve -----

    async onApprove(): Promise<void> {
        const u = this.user();
        if (!u || this.actionLoading()) return;
        this.actionLoading.set('approve');
        const ok = await this.usersService.approveKyc(u.id);
        this.actionLoading.set(null);
        if (ok) this.changed.emit();
    }

    // ----- KYC reject -----

    openRejectModal(): void {
        this.rejectReasonCode = '';
        this.rejectExtraText = '';
        this.rejectModalOpen.set(true);
    }

    closeRejectModal(): void {
        this.rejectModalOpen.set(false);
    }

    canSubmitReject(): boolean {
        if (!this.rejectReasonCode) return false;
        if (this.rejectReasonCode === 'other' && !this.rejectExtraText.trim()) return false;
        return true;
    }

    async onReject(): Promise<void> {
        const u = this.user();
        if (!u || !this.canSubmitReject() || this.actionLoading()) return;

        const reasonRow = REJECT_REASONS.find((r) => r.code === this.rejectReasonCode);
        const baseLabel = reasonRow?.label ?? '';
        const note = this.rejectExtraText.trim();
        const reason =
            this.rejectReasonCode === 'other'
                ? note
                : note
                  ? `${baseLabel} — ${note}`
                  : baseLabel;

        this.actionLoading.set('reject');
        const ok = await this.usersService.rejectKyc(u.id, reason);
        this.actionLoading.set(null);
        if (ok) {
            this.rejectModalOpen.set(false);
            this.changed.emit();
        }
    }

    // ----- role -----

    openRoleModal(): void {
        const u = this.user();
        if (!u || !this.canEditRole()) return;
        this.pendingRole = u.role;
        this.roleModalOpen.set(true);
    }

    closeRoleModal(): void {
        this.roleModalOpen.set(false);
    }

    canSubmitRole(): boolean {
        const u = this.user();
        return !!u && this.pendingRole !== u.role;
    }

    async onChangeRole(): Promise<void> {
        const u = this.user();
        if (!u || !this.canSubmitRole() || this.actionLoading()) return;
        this.actionLoading.set('role');
        const ok = await this.usersService.setRole(u.id, this.pendingRole);
        this.actionLoading.set(null);
        if (ok) {
            this.roleModalOpen.set(false);
            this.changed.emit();
        }
    }

    // ----- blacklist -----

    async onBlacklistToggle(next: boolean): Promise<void> {
        const u = this.user();
        if (!u || this.actionLoading()) return;
        if (next === u.is_blacklisted) return;
        this.actionLoading.set('blacklist');
        const ok = await this.usersService.setBlacklist(u.id, next);
        this.actionLoading.set(null);
        if (ok) this.changed.emit();
    }

    // ----- helpers -----

    initials(u: User): string {
        const name = u.full_name?.trim();
        if (!name) return (u.email?.[0] ?? '?').toUpperCase();
        const parts = name.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
        return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }

    statusClass(status: string): string {
        switch (status) {
            case 'verified':
                return 'is-success';
            case 'pending':
                return 'is-warning';
            case 'rejected':
                return 'is-danger';
            default:
                return 'is-muted';
        }
    }

    formatDate(iso: string | null | undefined): string {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    formatRelative(iso: string | null | undefined): string {
        if (!iso) return '—';
        const ms = Date.now() - new Date(iso).getTime();
        const min = Math.round(ms / 60000);
        if (min < 1) return 'just now';
        if (min < 60) return `${min}m ago`;
        const hr = Math.round(min / 60);
        if (hr < 24) return `${hr}h ago`;
        const d = Math.round(hr / 24);
        if (d < 30) return `${d}d ago`;
        return this.formatDate(iso);
    }
}
