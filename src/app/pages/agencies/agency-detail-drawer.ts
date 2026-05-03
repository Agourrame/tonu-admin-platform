import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawerModule } from 'primeng/drawer';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { AgenciesService, AgencyRow, AgencyWithDossier } from '@/services/agencies.service';
import { SubscriptionPlansService } from '@/services/subscription-plans.service';
import { AuthService } from '@/services/auth.service';
import { AgencyDocument } from '@/models/agency-document';
import { SubscriptionPlan } from '@/models/subscription-plan';

interface DocPreview {
    doc: AgencyDocument;
    signedUrl: string | null;
}

interface RejectReason {
    code: string;
    label: string;
}

type RejectContext = 'operational' | 'verification';

const OPERATIONAL_REJECT_REASONS: RejectReason[] = [
    { code: 'incomplete_application', label: 'Application is incomplete (missing fields)' },
    { code: 'invalid_business_info', label: 'Business info doesn\'t match registry' },
    { code: 'duplicate_agency', label: 'Duplicate of an existing agency' },
    { code: 'other', label: 'Other (specify below)' }
];

const VERIFICATION_REJECT_REASONS: RejectReason[] = [
    { code: 'docs_unreadable', label: 'KYC documents are unreadable' },
    { code: 'docs_expired', label: 'Documents are expired' },
    { code: 'docs_mismatch', label: 'Document info doesn\'t match agency name / ICE' },
    { code: 'missing_required_doc', label: 'A required document is missing' },
    { code: 'other', label: 'Other (specify below)' }
];

/**
 * Side drawer for a single agency row. Surfaces the full dossier
 * (owner, identity, operating cities, KYC documents) and exposes
 * the two independent admin action paths:
 *  - operational status (status column)
 *  - verification status (verification_status column — KYC badge)
 * Plus a plan + commission editor.
 */
@Component({
    selector: 'app-agency-detail-drawer',
    standalone: true,
    imports: [CommonModule, FormsModule, DrawerModule, DialogModule, ButtonModule, SelectModule, InputNumberModule, TextareaModule],
    template: `
        <p-drawer
            [visible]="visible()"
            (onHide)="onDrawerHide()"
            position="right"
            [style]="{ width: '560px' }"
            [transitionOptions]="'.3s cubic-bezier(0, 0, 0.2, 1)'"
            styleClass="agency-detail-drawer"
            [showCloseIcon]="true"
        >
            @if (agency(); as a) {
                @if (loadingDossier()) {
                    <div class="loading-shell">
                        <div class="tomo-sk-block" style="height: 84px"></div>
                        <div class="tomo-sk-line" style="width: 70%; margin-top: 18px"></div>
                        <div class="tomo-sk-line" style="width: 50%; margin-top: 8px"></div>
                        <div class="tomo-sk-block" style="height: 220px; margin-top: 22px"></div>
                    </div>
                } @else {
                    <div class="drawer-content">
                        <!-- Header -->
                        <div class="agency-header">
                            @if (a.logo_url) {
                                <img class="logo-lg" [src]="a.logo_url" [alt]="a.name" />
                            } @else {
                                <div class="logo-lg logo-fallback">{{ initialsOf(a.name) }}</div>
                            }
                            <div class="who">
                                <div class="name">{{ a.name }}</div>
                                <div class="sub">
                                    @if (a.city) {
                                        <i class="pi pi-map-marker"></i> {{ a.city }} ·
                                    }
                                    <span class="slug">/{{ a.slug }}</span>
                                </div>
                                <div class="status-row">
                                    <span class="tomo-status" [ngClass]="statusClass(a.status)">
                                        status: {{ a.status }}
                                    </span>
                                    <span class="tomo-status" [ngClass]="verifClass(a.verification_status)">
                                        kyc: {{ a.verification_status }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        @if (a.tagline) {
                            <p class="tagline">"{{ a.tagline }}"</p>
                        }

                        <!-- Owner -->
                        @if (dossier()?.owner; as owner) {
                            <div class="section">
                                <div class="tomo-field-label">Owner</div>
                                <div class="owner-card">
                                    <div class="avatar-sm">{{ ownerInitials() }}</div>
                                    <div class="owner-info">
                                        <div class="owner-name">{{ owner.full_name || '—' }}</div>
                                        <div class="owner-email">{{ owner.email }}</div>
                                        @if (owner.phone) {
                                            <div class="owner-phone">{{ owner.phone }}</div>
                                        }
                                    </div>
                                </div>
                            </div>
                        }

                        <!-- Operational status -->
                        <div class="section">
                            <div class="tomo-section-header">
                                <span class="tomo-field-label">Operational status</span>
                                <span class="tomo-status" [ngClass]="statusClass(a.status)">{{ a.status }}</span>
                            </div>
                            <p class="section-help">Controls /agency-tabs access. Independent from KYC badge.</p>
                            @if (a.status === 'rejected' && a.rejection_reason) {
                                <div class="reject-banner">
                                    <div class="reject-banner-title">Last rejection</div>
                                    <div class="reject-banner-text">{{ a.rejection_reason }}</div>
                                </div>
                            }
                            <div class="action-row">
                                @if (a.status === 'pending' || a.status === 'rejected') {
                                    <p-button
                                        label="Approve"
                                        icon="pi pi-check"
                                        severity="success"
                                        [loading]="actionLoading() === 'op-approve'"
                                        [disabled]="!!actionLoading()"
                                        (onClick)="onApproveOperational()"
                                        styleClass="action-btn"
                                    />
                                    <p-button
                                        label="Reject"
                                        icon="pi pi-times"
                                        severity="danger"
                                        [outlined]="true"
                                        [disabled]="!!actionLoading()"
                                        (onClick)="openRejectModal('operational')"
                                        styleClass="action-btn"
                                    />
                                } @else if (a.status === 'active') {
                                    <p-button
                                        label="Suspend"
                                        icon="pi pi-pause"
                                        severity="warn"
                                        [outlined]="true"
                                        [loading]="actionLoading() === 'op-suspend'"
                                        [disabled]="!!actionLoading()"
                                        (onClick)="onSuspend()"
                                        styleClass="action-btn"
                                    />
                                } @else if (a.status === 'suspended') {
                                    <p-button
                                        label="Re-activate"
                                        icon="pi pi-play"
                                        severity="success"
                                        [loading]="actionLoading() === 'op-activate'"
                                        [disabled]="!!actionLoading()"
                                        (onClick)="onUnsuspend()"
                                        styleClass="action-btn"
                                    />
                                }
                            </div>
                        </div>

                        <!-- Identity facts -->
                        <div class="section">
                            <div class="tomo-field-label">Identity</div>
                            <dl class="facts">
                                <dt>ICE</dt>
                                <dd [class.dim]="!a.ice_number" class="mono">{{ a.ice_number || '—' }}</dd>
                                <dt>RC</dt>
                                <dd [class.dim]="!a.rc_number" class="mono">{{ a.rc_number || '—' }}</dd>
                                <dt>Address</dt>
                                <dd [class.dim]="!a.address">{{ a.address || '—' }}</dd>
                                <dt>HQ city</dt>
                                <dd [class.dim]="!a.city">{{ a.city || '—' }}</dd>
                                <dt>Contact</dt>
                                <dd>
                                    <div class="contact-list">
                                        @if (a.phone) {
                                            <div><i class="pi pi-phone"></i> {{ a.phone }}</div>
                                        }
                                        @if (a.whatsapp) {
                                            <div><i class="pi pi-whatsapp"></i> {{ a.whatsapp }}</div>
                                        }
                                        @if (a.email) {
                                            <div><i class="pi pi-envelope"></i> {{ a.email }}</div>
                                        }
                                        @if (a.website) {
                                            <a [href]="a.website" target="_blank" rel="noopener">
                                                <i class="pi pi-external-link"></i> {{ a.website }}
                                            </a>
                                        }
                                        @if (!a.phone && !a.whatsapp && !a.email && !a.website) {
                                            <span class="dim">—</span>
                                        }
                                    </div>
                                </dd>
                            </dl>
                        </div>

                        <!-- Operating cities -->
                        @if (a.operating_cities.length) {
                            <div class="section">
                                <div class="tomo-field-label">Operating cities</div>
                                <div class="city-chips">
                                    @for (city of a.operating_cities; track city) {
                                        <span class="city-chip">{{ city }}</span>
                                    }
                                </div>
                            </div>
                        }

                        <!-- KYC verification + dossier -->
                        <div class="section">
                            <div class="tomo-section-header">
                                <span class="tomo-field-label">KYC verification</span>
                                <span class="tomo-status" [ngClass]="verifClass(a.verification_status)">
                                    {{ a.verification_status }}
                                </span>
                            </div>
                            <p class="section-help">Marketplace badge. Vehicles only appear publicly when status='active' AND verification_status='verified'.</p>

                            @if (docs().length) {
                                <div class="docs-list">
                                    @for (preview of docs(); track preview.doc.id) {
                                        <div class="doc-row">
                                            <div class="doc-row-left">
                                                <div class="tomo-icon-badge is-slate is-sm">
                                                    <i class="pi pi-file"></i>
                                                </div>
                                                <div>
                                                    <div class="doc-type">{{ formatDocType(preview.doc.doc_type) }}</div>
                                                    <div class="doc-status">
                                                        <span class="tomo-status" [ngClass]="docStatusClass(preview.doc.status)">
                                                            {{ preview.doc.status }}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            @if (preview.signedUrl) {
                                                <a class="doc-open" [href]="preview.signedUrl" target="_blank" rel="noopener">
                                                    Open <i class="pi pi-external-link"></i>
                                                </a>
                                            } @else {
                                                <span class="dim-small">No URL</span>
                                            }
                                        </div>
                                    }
                                </div>
                            } @else {
                                <div class="empty-docs">
                                    <i class="pi pi-folder-open"></i>
                                    <span>No KYC documents uploaded yet.</span>
                                </div>
                            }

                            <div class="action-row" style="margin-top: 14px">
                                @if (a.verification_status === 'pending' || a.verification_status === 'rejected' || a.verification_status === 'none') {
                                    <p-button
                                        label="Approve KYC"
                                        icon="pi pi-shield"
                                        severity="success"
                                        [loading]="actionLoading() === 'verif-approve'"
                                        [disabled]="!!actionLoading() || !docs().length"
                                        (onClick)="onApproveVerification()"
                                        styleClass="action-btn"
                                    />
                                    <p-button
                                        label="Reject"
                                        icon="pi pi-times"
                                        severity="danger"
                                        [outlined]="true"
                                        [disabled]="!!actionLoading()"
                                        (onClick)="openRejectModal('verification')"
                                        styleClass="action-btn"
                                    />
                                } @else if (a.verification_status === 'verified') {
                                    <p-button
                                        label="Reset to pending"
                                        icon="pi pi-history"
                                        severity="secondary"
                                        [outlined]="true"
                                        [loading]="actionLoading() === 'verif-reset'"
                                        [disabled]="!!actionLoading()"
                                        (onClick)="onResetVerification()"
                                        styleClass="action-btn"
                                    />
                                }
                            </div>
                        </div>

                        <!-- Plan + commission -->
                        <div class="section">
                            <div class="tomo-field-label">Plan & commission</div>
                            <div class="plan-card">
                                <div class="plan-row">
                                    <label class="plan-label">Plan</label>
                                    <p-select
                                        [options]="planOptions()"
                                        [(ngModel)]="pendingPlan"
                                        optionLabel="label"
                                        optionValue="value"
                                        placeholder="No plan"
                                        [showClear]="true"
                                        styleClass="plan-select"
                                    />
                                </div>
                                <div class="plan-row">
                                    <label class="plan-label">Custom commission %</label>
                                    <p-inputNumber
                                        [(ngModel)]="pendingCommission"
                                        [showButtons]="false"
                                        suffix=" %"
                                        [min]="0"
                                        [max]="100"
                                        [maxFractionDigits]="2"
                                        styleClass="plan-input"
                                        placeholder="Use plan default"
                                    />
                                </div>
                                <div class="plan-actions">
                                    <p-button
                                        label="Save plan"
                                        [loading]="actionLoading() === 'plan'"
                                        [disabled]="!planChanged() || !!actionLoading()"
                                        (onClick)="onSavePlan()"
                                        styleClass="action-btn"
                                    />
                                </div>
                                @if (effectiveCommission() !== null) {
                                    <div class="plan-effective">
                                        Effective commission: <strong>{{ effectiveCommission() }}%</strong>
                                    </div>
                                }
                            </div>
                        </div>

                        <!-- Quick stats -->
                        <div class="section side-stats">
                            <div class="stat-row">
                                <div class="stat-key">Vehicles</div>
                                <div class="stat-val">{{ vehicleCount() }}</div>
                            </div>
                            <div class="stat-row">
                                <div class="stat-key">Submitted</div>
                                <div class="stat-val">{{ formatRelative(a.submitted_at) }}</div>
                            </div>
                            <div class="stat-row">
                                <div class="stat-key">Reviewed</div>
                                <div class="stat-val">{{ formatRelative(a.reviewed_at) }}</div>
                            </div>
                        </div>
                    </div>
                }
            }
        </p-drawer>

        <!-- Reject modal (shared between operational + verification) -->
        <p-dialog
            [visible]="rejectModalOpen()"
            (onHide)="closeRejectModal()"
            [header]="rejectContext() === 'operational' ? 'Reject application' : 'Reject KYC dossier'"
            [modal]="true"
            [style]="{ width: '480px' }"
            [closable]="true"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="reject-form">
                <p class="modal-sub">
                    @if (rejectContext() === 'operational') {
                        The agency owner sees this reason and can edit + resubmit.
                    } @else {
                        Tell the agency what's wrong with their KYC dossier so they can fix it.
                    }
                </p>

                <div class="reason-options">
                    @for (r of currentRejectReasons(); track r.code) {
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
                    [loading]="actionLoading() === 'op-reject' || actionLoading() === 'verif-reject'"
                    [disabled]="!canSubmitReject()"
                    (onClick)="onSubmitReject()"
                />
            </ng-template>
        </p-dialog>
    `,
    styles: [
        `
            ::ng-deep .agency-detail-drawer .p-drawer-header {
                padding: 14px 18px 0;
            }
            ::ng-deep .agency-detail-drawer .p-drawer-content {
                padding: 0;
            }
            .loading-shell {
                padding: 22px;
            }
            .drawer-content {
                padding: 4px 22px 32px;
            }
            .agency-header {
                display: flex;
                gap: 14px;
                padding-bottom: 18px;
                border-bottom: 1px solid var(--tomo-divider);
                margin-bottom: 14px;
            }
            .logo-lg {
                width: 60px;
                height: 60px;
                border-radius: 14px;
                object-fit: cover;
                background: var(--tomo-bg-soft);
                flex-shrink: 0;
            }
            .logo-lg.logo-fallback {
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(36, 40, 48, 0.06);
                color: var(--tomo-primary);
                font-size: 20px;
                font-weight: 800;
            }
            .who {
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .name {
                font-size: 18px;
                font-weight: 800;
                letter-spacing: -0.2px;
                color: var(--tomo-text-strong);
            }
            .sub {
                font-size: 12.5px;
                color: var(--tomo-text-muted);
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .sub i {
                font-size: 11px;
            }
            .slug {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 11.5px;
            }
            .status-row {
                display: flex;
                gap: 6px;
                margin-top: 4px;
                flex-wrap: wrap;
            }
            .tagline {
                font-size: 13.5px;
                color: var(--tomo-text-secondary);
                font-style: italic;
                line-height: 1.5;
                margin: 0 0 18px;
                padding: 0 4px;
            }
            .section {
                margin-bottom: 22px;
            }
            .section-help {
                font-size: 12px;
                color: var(--tomo-text-muted);
                margin: -8px 0 12px;
                line-height: 1.45;
            }
            .owner-card {
                display: flex;
                gap: 12px;
                align-items: center;
                padding: 12px 14px;
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
            }
            .avatar-sm {
                width: 38px;
                height: 38px;
                border-radius: 50%;
                background: var(--tomo-primary);
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                font-weight: 800;
                flex-shrink: 0;
            }
            .owner-info {
                min-width: 0;
            }
            .owner-name {
                font-size: 13.5px;
                font-weight: 700;
                color: var(--tomo-text-strong);
            }
            .owner-email,
            .owner-phone {
                font-size: 12px;
                color: var(--tomo-text-muted);
                margin-top: 1px;
            }
            .facts {
                display: grid;
                grid-template-columns: 100px 1fr;
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
            .facts dd.mono {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 12.5px;
                letter-spacing: 0.3px;
            }
            .facts dd.dim {
                color: var(--tomo-text-faint);
                font-style: italic;
            }
            .contact-list {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .contact-list i {
                font-size: 11px;
                margin-right: 6px;
                color: var(--tomo-text-muted);
            }
            .contact-list a {
                color: var(--tomo-secondary);
                text-decoration: none;
            }
            .contact-list a:hover {
                text-decoration: underline;
            }
            .city-chips {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }
            .city-chip {
                background: var(--tomo-bg-soft);
                color: var(--tomo-text-secondary);
                font-size: 12px;
                font-weight: 600;
                padding: 4px 10px;
                border-radius: var(--tomo-radius-pill);
            }
            .docs-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .doc-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 14px;
                background: var(--tomo-bg-card);
                border-radius: var(--tomo-radius-md);
                box-shadow: var(--tomo-shadow-card);
            }
            .doc-row-left {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .doc-type {
                font-size: 13px;
                font-weight: 700;
                color: var(--tomo-text-strong);
                text-transform: capitalize;
            }
            .doc-status {
                margin-top: 2px;
            }
            .doc-open {
                font-size: 12px;
                font-weight: 600;
                color: var(--tomo-secondary);
                text-decoration: none;
                white-space: nowrap;
            }
            .doc-open i {
                font-size: 10px;
                margin-left: 2px;
            }
            .empty-docs {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 14px;
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
                font-size: 13px;
                color: var(--tomo-text-muted);
                font-weight: 500;
            }
            .empty-docs i {
                font-size: 16px;
            }
            .action-row {
                display: flex;
                gap: 10px;
                margin-top: 12px;
            }
            ::ng-deep .action-btn {
                flex: 1;
            }
            ::ng-deep .action-btn .p-button {
                width: 100%;
                height: 42px;
                border-radius: var(--tomo-radius-md);
                font-weight: 700;
                font-size: 13.5px;
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
            .plan-card {
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
                padding: 14px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .plan-row {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .plan-label {
                font-size: 11.5px;
                font-weight: 700;
                color: var(--tomo-text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            ::ng-deep .plan-select,
            ::ng-deep .plan-input,
            ::ng-deep .plan-input .p-inputnumber-input {
                width: 100%;
            }
            .plan-actions {
                display: flex;
                justify-content: flex-end;
            }
            .plan-effective {
                font-size: 12.5px;
                color: var(--tomo-text-secondary);
                font-weight: 600;
                padding-top: 6px;
                border-top: 1px solid var(--tomo-divider);
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
            .dim {
                color: var(--tomo-text-faint);
                font-weight: 500;
            }
            .dim-small {
                color: var(--tomo-text-muted);
                font-size: 11.5px;
                font-weight: 600;
            }

            /* Modal */
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
        `
    ]
})
export class AgencyDetailDrawer {
    private agenciesService = inject(AgenciesService);
    private plansService = inject(SubscriptionPlansService);
    private auth = inject(AuthService);

    readonly agency = input<AgencyRow | null>(null);
    readonly close = output<void>();
    readonly changed = output<void>();

    readonly visible = computed(() => !!this.agency());

    // ----- async-loaded side data -----
    readonly dossier = signal<AgencyWithDossier | null>(null);
    readonly docs = signal<DocPreview[]>([]);
    readonly vehicleCount = signal(0);
    readonly loadingDossier = signal(false);

    // ----- plans -----
    private readonly _plans = signal<SubscriptionPlan[]>([]);
    readonly planOptions = computed(() =>
        this._plans().map((p) => ({
            label: `${p.name} — ${p.commission_pct}% commission`,
            value: p.code
        }))
    );

    // ----- mutation state -----
    readonly actionLoading = signal<
        | 'op-approve'
        | 'op-reject'
        | 'op-suspend'
        | 'op-activate'
        | 'verif-approve'
        | 'verif-reject'
        | 'verif-reset'
        | 'plan'
        | null
    >(null);

    // ----- reject modal (shared) -----
    readonly rejectModalOpen = signal(false);
    readonly rejectContext = signal<RejectContext>('operational');
    readonly currentRejectReasons = computed(() =>
        this.rejectContext() === 'operational' ? OPERATIONAL_REJECT_REASONS : VERIFICATION_REJECT_REASONS
    );
    rejectReasonCode = '';
    rejectExtraText = '';

    // ----- plan editor state -----
    pendingPlan: string | null = null;
    pendingCommission: number | null = null;

    readonly planChanged = computed(() => {
        const a = this.agency();
        if (!a) return false;
        const planSame = (this.pendingPlan ?? null) === (a.plan_code ?? null);
        const commSame = (this.pendingCommission ?? null) === (a.custom_commission ?? null);
        return !(planSame && commSame);
    });

    readonly effectiveCommission = computed(() => {
        const a = this.agency();
        if (!a) return null;
        if (a.custom_commission !== null && a.custom_commission !== undefined) {
            return a.custom_commission;
        }
        const plan = this._plans().find((p) => p.code === a.plan_code);
        return plan?.commission_pct ?? null;
    });

    constructor() {
        // Plans list — load once.
        void this.loadPlans();

        // Reactive: refresh dossier + counts when input agency changes.
        effect(() => {
            const a = this.agency();
            if (!a) {
                this.dossier.set(null);
                this.docs.set([]);
                this.vehicleCount.set(0);
                this.pendingPlan = null;
                this.pendingCommission = null;
                return;
            }
            this.pendingPlan = a.plan_code ?? null;
            this.pendingCommission = a.custom_commission ?? null;
            void this.loadDossier(a.id);
        });
    }

    private async loadPlans(): Promise<void> {
        const plans = await this.plansService.listAll();
        this._plans.set(plans);
    }

    private async loadDossier(agencyId: string): Promise<void> {
        this.loadingDossier.set(true);
        const [dossier, vCount] = await Promise.all([
            this.agenciesService.getDossier(agencyId),
            this.agenciesService.vehicleCount(agencyId)
        ]);

        // Stale-result guard.
        if (this.agency()?.id !== agencyId) return;

        this.dossier.set(dossier);
        this.vehicleCount.set(vCount);

        // Sign each document URL for inline preview.
        const documents = dossier?.documents ?? [];
        const previews = await Promise.all(
            documents.map(async (doc) => ({
                doc,
                signedUrl: await this.agenciesService.signedDocUrl(doc.file_url)
            }))
        );
        if (this.agency()?.id !== agencyId) return;
        this.docs.set(previews);
        this.loadingDossier.set(false);
    }

    onDrawerHide(): void {
        this.close.emit();
    }

    private adminId(): string | null {
        return this.auth.authUser()?.id ?? null;
    }

    // ----- operational status actions -----

    async onApproveOperational(): Promise<void> {
        const a = this.agency();
        const adminId = this.adminId();
        if (!a || !adminId || this.actionLoading()) return;
        this.actionLoading.set('op-approve');
        const ok = await this.agenciesService.approveOperational(a.id, adminId);
        this.actionLoading.set(null);
        if (ok) this.changed.emit();
    }

    async onSuspend(): Promise<void> {
        const a = this.agency();
        if (!a || this.actionLoading()) return;
        this.actionLoading.set('op-suspend');
        const ok = await this.agenciesService.suspendOperational(a.id);
        this.actionLoading.set(null);
        if (ok) this.changed.emit();
    }

    async onUnsuspend(): Promise<void> {
        const a = this.agency();
        if (!a || this.actionLoading()) return;
        this.actionLoading.set('op-activate');
        const ok = await this.agenciesService.unsuspendOperational(a.id);
        this.actionLoading.set(null);
        if (ok) this.changed.emit();
    }

    // ----- verification status actions -----

    async onApproveVerification(): Promise<void> {
        const a = this.agency();
        const adminId = this.adminId();
        if (!a || !adminId || this.actionLoading()) return;
        this.actionLoading.set('verif-approve');
        const ok = await this.agenciesService.approveVerification(a.id, adminId);
        this.actionLoading.set(null);
        if (ok) this.changed.emit();
    }

    async onResetVerification(): Promise<void> {
        const a = this.agency();
        if (!a || this.actionLoading()) return;
        this.actionLoading.set('verif-reset');
        const ok = await this.agenciesService.resetVerification(a.id);
        this.actionLoading.set(null);
        if (ok) this.changed.emit();
    }

    // ----- reject modal -----

    openRejectModal(context: RejectContext): void {
        this.rejectContext.set(context);
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

    async onSubmitReject(): Promise<void> {
        const a = this.agency();
        const adminId = this.adminId();
        if (!a || !adminId || !this.canSubmitReject() || this.actionLoading()) return;

        const reasons = this.currentRejectReasons();
        const baseLabel = reasons.find((r) => r.code === this.rejectReasonCode)?.label ?? '';
        const note = this.rejectExtraText.trim();
        const reason =
            this.rejectReasonCode === 'other'
                ? note
                : note
                  ? `${baseLabel} — ${note}`
                  : baseLabel;

        const context = this.rejectContext();
        this.actionLoading.set(context === 'operational' ? 'op-reject' : 'verif-reject');
        const ok =
            context === 'operational'
                ? await this.agenciesService.rejectOperational(a.id, reason, adminId)
                : await this.agenciesService.rejectVerification(a.id, adminId);
        this.actionLoading.set(null);
        if (ok) {
            this.rejectModalOpen.set(false);
            this.changed.emit();
        }
    }

    // ----- plan editor -----

    async onSavePlan(): Promise<void> {
        const a = this.agency();
        if (!a || !this.planChanged() || this.actionLoading()) return;
        this.actionLoading.set('plan');
        const ok = await this.agenciesService.setPlan(
            a.id,
            this.pendingPlan ?? null,
            this.pendingCommission ?? null
        );
        this.actionLoading.set(null);
        if (ok) this.changed.emit();
    }

    // ----- helpers -----

    initialsOf(name: string): string {
        const parts = (name ?? '').split(/\s+/).filter(Boolean);
        if (!parts.length) return '?';
        if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
        return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }

    ownerInitials(): string {
        const owner = this.dossier()?.owner;
        if (!owner) return '?';
        const name = owner.full_name?.trim();
        if (!name) return (owner.email?.[0] ?? '?').toUpperCase();
        const parts = name.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
        return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }

    formatDocType(type: string): string {
        return type.replace(/_/g, ' ');
    }

    statusClass(status: string): string {
        switch (status) {
            case 'active':
                return 'is-success';
            case 'pending':
                return 'is-warning';
            case 'rejected':
            case 'suspended':
                return 'is-danger';
            default:
                return 'is-muted';
        }
    }

    verifClass(status: string): string {
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

    docStatusClass(status: string): string {
        switch (status) {
            case 'approved':
                return 'is-success';
            case 'pending':
                return 'is-warning';
            case 'rejected':
                return 'is-danger';
            default:
                return 'is-muted';
        }
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
        const dt = new Date(iso);
        return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
}
