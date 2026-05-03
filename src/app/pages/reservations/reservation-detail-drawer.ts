import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ReservationDossier, ReservationRow, ReservationsService } from '@/services/reservations.service';
import { ReservationStatus } from '@/models/enums';

const STATUS_OPTIONS: { label: string; value: ReservationStatus }[] = [
    { label: 'Pending', value: 'pending' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Active', value: 'active' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' }
];

/**
 * Side drawer for a single reservation. Joins together renter + vehicle +
 * agency + payment so the admin can resolve disputes from one screen.
 *
 * Status changes are intentionally unrestricted — admin overrides exist
 * precisely to escape the normal renter/agency state machine. The hint
 * row warns about cascade effects (cancelling an active rental).
 */
@Component({
    selector: 'app-reservation-detail-drawer',
    standalone: true,
    imports: [CommonModule, FormsModule, TitleCasePipe, DrawerModule, ButtonModule, SelectModule],
    template: `
        <p-drawer
            [visible]="visible()"
            (onHide)="onDrawerHide()"
            position="right"
            [style]="{ width: '560px' }"
            [transitionOptions]="'.3s cubic-bezier(0, 0, 0.2, 1)'"
            styleClass="reservation-detail-drawer"
            [showCloseIcon]="true"
        >
            @if (reservation(); as r) {
                @if (loading()) {
                    <div class="loading-shell">
                        <div class="tomo-sk-block" style="height: 80px"></div>
                        <div class="tomo-sk-line" style="width: 60%; margin-top: 14px"></div>
                        <div class="tomo-sk-block" style="height: 200px; margin-top: 18px"></div>
                    </div>
                }
                @if (!loading() && dossier(); as d) {
                    <div class="drawer-content">
                        <!-- Header card: status + ref + dates + total -->
                        <div class="head-card">
                            <div class="head-top">
                                <span class="ref">#{{ r.id.slice(0, 8) }}</span>
                                <span class="tomo-status" [ngClass]="statusClass(r.status)">{{ r.status }}</span>
                            </div>
                            <div class="head-dates">
                                <div class="date-block">
                                    <div class="date-label">Pickup</div>
                                    <div class="date-value">{{ formatDateLong(r.start_date) }}</div>
                                </div>
                                <div class="date-arrow"><i class="pi pi-arrow-right"></i></div>
                                <div class="date-block">
                                    <div class="date-label">Return</div>
                                    <div class="date-value">{{ formatDateLong(r.end_date) }}</div>
                                </div>
                            </div>
                            <div class="head-bottom">
                                <span class="head-days">{{ days() }} day{{ days() === 1 ? '' : 's' }}</span>
                                <span class="head-total">
                                    <span class="num">{{ total() | number }}</span>
                                    <span class="cur">MAD</span>
                                </span>
                            </div>
                        </div>

                        <!-- Renter -->
                        <div class="section">
                            <div class="tomo-field-label">Renter</div>
                            @if (d.user; as u) {
                                <div class="party-card">
                                    <div class="party-avatar">{{ initialsOf(u.full_name, u.email) }}</div>
                                    <div class="party-info">
                                        <div class="party-name">{{ u.full_name || '—' }}</div>
                                        <div class="party-meta">{{ u.email }}</div>
                                        @if (u.phone) {
                                            <div class="party-meta">{{ u.phone }}</div>
                                        }
                                    </div>
                                    <span class="tomo-status" [ngClass]="kycClass(u.verification_status)">
                                        {{ u.verification_status }}
                                    </span>
                                </div>
                            } @else {
                                <div class="empty-inline">
                                    <i class="pi pi-user-minus"></i>
                                    <span>Renter account was deleted.</span>
                                </div>
                            }
                        </div>

                        <!-- Vehicle -->
                        <div class="section">
                            <div class="tomo-field-label">Vehicle</div>
                            @if (d.vehicle; as v) {
                                <div class="vehicle-card">
                                    @if (vehicleThumb(); as url) {
                                        <img [src]="url" [alt]="v.brand" class="vehicle-thumb" />
                                    } @else {
                                        <div class="vehicle-thumb thumb-fallback"><i class="pi pi-car"></i></div>
                                    }
                                    <div class="vehicle-info">
                                        <div class="vehicle-name">{{ v.brand }} {{ v.model }} <span class="year">· {{ v.year }}</span></div>
                                        <div class="vehicle-plate">{{ v.plate_number }}</div>
                                        @if (v.agency; as ag) {
                                            <div class="vehicle-agency">
                                                <i class="pi pi-building"></i> {{ ag.name }}
                                                @if (ag.city) {
                                                    <span class="dim-small">· {{ ag.city }}</span>
                                                }
                                            </div>
                                        }
                                    </div>
                                </div>
                            } @else {
                                <div class="empty-inline">
                                    <i class="pi pi-times-circle"></i>
                                    <span>Vehicle was deleted from inventory.</span>
                                </div>
                            }
                        </div>

                        <!-- Pickup / dropoff / delivery -->
                        <div class="section">
                            <div class="tomo-field-label">Logistics</div>
                            <dl class="facts">
                                <dt>Pickup</dt>
                                <dd [class.dim]="!r.pickup_location">{{ r.pickup_location || '—' }}</dd>
                                <dt>Drop-off</dt>
                                <dd>
                                    @if (r.dropoff_location) {
                                        {{ r.dropoff_location }}
                                        @if (r.dropoff_location !== r.pickup_location) {
                                            <span class="badge-info">One-way</span>
                                        }
                                    } @else {
                                        <span class="dim">Same as pickup</span>
                                    }
                                </dd>
                                <dt>Delivery</dt>
                                <dd>
                                    @if (r.wants_delivery) {
                                        <i class="pi pi-truck"></i> {{ r.delivery_address || 'Address pending' }}
                                        @if (r.delivery_fee > 0) {
                                            <span class="dim-small"> · {{ r.delivery_fee }} MAD</span>
                                        }
                                    } @else {
                                        <span class="dim">No delivery — pickup at agency</span>
                                    }
                                </dd>
                            </dl>
                        </div>

                        <!-- Pricing breakdown -->
                        <div class="section">
                            <div class="tomo-field-label">Pricing</div>
                            <div class="price-card">
                                <div class="price-row">
                                    <span class="price-key">{{ r.daily_rate | number }} MAD × {{ days() }} day{{ days() === 1 ? '' : 's' }}</span>
                                    <span class="price-val">{{ subtotal() | number }} MAD</span>
                                </div>
                                @if (r.delivery_fee > 0) {
                                    <div class="price-row">
                                        <span class="price-key">Delivery fee</span>
                                        <span class="price-val">{{ r.delivery_fee | number }} MAD</span>
                                    </div>
                                }
                                <div class="price-row total">
                                    <span class="price-key">Total</span>
                                    <span class="price-val"><strong>{{ total() | number }} MAD</strong></span>
                                </div>
                                @if (r.payment_method) {
                                    <div class="payment-method">
                                        <i class="pi pi-credit-card"></i>
                                        <span>{{ r.payment_method | titlecase }}</span>
                                    </div>
                                }
                            </div>
                        </div>

                        <!-- Payment -->
                        @if (d.payment; as p) {
                            <div class="section">
                                <div class="tomo-section-header">
                                    <span class="tomo-field-label">Payment ledger</span>
                                    <span class="tomo-status" [ngClass]="paymentClass(p.status)">{{ p.status }}</span>
                                </div>
                                <dl class="facts">
                                    <dt>Amount paid</dt>
                                    <dd><strong>{{ p.amount_total | number }}</strong> MAD</dd>
                                    <dt>Agency commission</dt>
                                    <dd>{{ p.agency_commission | number }} MAD</dd>
                                    <dt>Net to agency</dt>
                                    <dd>{{ p.net_agency | number }} MAD</dd>
                                    <dt>Platform revenue</dt>
                                    <dd>{{ p.platform_revenue | number }} MAD</dd>
                                    <dt>Method</dt>
                                    <dd>{{ p.method | titlecase }}</dd>
                                    @if (p.paid_at) {
                                        <dt>Paid at</dt>
                                        <dd>{{ formatRelative(p.paid_at) }}</dd>
                                    }
                                </dl>
                            </div>
                        } @else {
                            <div class="section">
                                <div class="tomo-field-label">Payment</div>
                                <div class="empty-inline">
                                    <i class="pi pi-money-bill"></i>
                                    <span>No payment record yet.</span>
                                </div>
                            </div>
                        }

                        <!-- Status override -->
                        <div class="section">
                            <div class="tomo-field-label">Admin override</div>
                            <div class="status-card">
                                <label class="status-label">Status</label>
                                <p-select
                                    [options]="statusOptions"
                                    [(ngModel)]="pendingStatus"
                                    optionLabel="label"
                                    optionValue="value"
                                    styleClass="status-select"
                                />
                                <p-button
                                    label="Save"
                                    [loading]="actionLoading() === 'status'"
                                    [disabled]="!statusChanged() || !!actionLoading()"
                                    (onClick)="onSaveStatus()"
                                    styleClass="status-save"
                                />
                            </div>
                            <p class="hint-row">
                                <i class="pi pi-info-circle"></i>
                                <span>Cancelling an <strong>active</strong> rental does not refund the renter automatically — handle the refund in the payment provider separately.</span>
                            </p>
                        </div>

                        <!-- Timeline -->
                        <div class="section side-stats">
                            <div class="stat-row">
                                <div class="stat-key">Booked</div>
                                <div class="stat-val">{{ formatRelative(r.created_at) }}</div>
                            </div>
                            <div class="stat-row">
                                <div class="stat-key">Reference</div>
                                <div class="stat-val mono">{{ r.id }}</div>
                            </div>
                        </div>
                    </div>
                }
            }
        </p-drawer>
    `,
    styles: [
        `
            ::ng-deep .reservation-detail-drawer .p-drawer-header {
                padding: 14px 18px 0;
            }
            ::ng-deep .reservation-detail-drawer .p-drawer-content {
                padding: 0;
            }
            .loading-shell {
                padding: 22px;
            }
            .drawer-content {
                padding: 4px 22px 32px;
            }

            /* Header card */
            .head-card {
                background: linear-gradient(160deg, var(--tomo-primary) 0%, var(--tomo-primary-soft) 100%);
                color: #fff;
                border-radius: var(--tomo-radius-lg);
                padding: 18px 20px;
                margin-bottom: 22px;
            }
            .head-top {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .head-top .ref {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 12px;
                font-weight: 700;
                opacity: 0.7;
            }
            .head-dates {
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                align-items: center;
                gap: 14px;
                margin: 14px 0;
            }
            .date-block {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .date-label {
                font-size: 10.5px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                opacity: 0.55;
            }
            .date-value {
                font-size: 14px;
                font-weight: 700;
                line-height: 1.2;
            }
            .date-arrow {
                opacity: 0.45;
            }
            .head-bottom {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                padding-top: 12px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            .head-days {
                font-size: 13px;
                font-weight: 600;
                opacity: 0.7;
            }
            .head-total .num {
                font-size: 22px;
                font-weight: 800;
                letter-spacing: -0.4px;
            }
            .head-total .cur {
                font-size: 12px;
                font-weight: 700;
                opacity: 0.6;
                margin-left: 4px;
            }

            /* Sections */
            .section {
                margin-bottom: 22px;
            }
            .party-card {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 14px;
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
            }
            .party-avatar {
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
            .party-info {
                flex: 1;
                min-width: 0;
            }
            .party-name {
                font-size: 13.5px;
                font-weight: 700;
                color: var(--tomo-text-strong);
            }
            .party-meta {
                font-size: 12px;
                color: var(--tomo-text-muted);
            }
            .vehicle-card {
                display: flex;
                gap: 12px;
                align-items: center;
                padding: 12px 14px;
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
            }
            .vehicle-thumb {
                width: 64px;
                height: 48px;
                border-radius: 8px;
                object-fit: cover;
                background: rgba(36, 40, 48, 0.06);
                flex-shrink: 0;
            }
            .thumb-fallback {
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--tomo-text-faint);
            }
            .thumb-fallback i {
                font-size: 18px;
            }
            .vehicle-info {
                min-width: 0;
            }
            .vehicle-name {
                font-size: 13.5px;
                font-weight: 700;
                color: var(--tomo-text-strong);
            }
            .vehicle-name .year {
                font-weight: 500;
                color: var(--tomo-text-muted);
            }
            .vehicle-plate {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 11.5px;
                font-weight: 700;
                color: var(--tomo-text-secondary);
                margin-top: 2px;
            }
            .vehicle-agency {
                font-size: 12px;
                color: var(--tomo-text-muted);
                margin-top: 4px;
            }
            .vehicle-agency i {
                font-size: 10px;
                margin-right: 4px;
            }
            .facts {
                display: grid;
                grid-template-columns: 110px 1fr;
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
                color: var(--tomo-text);
                margin: 0;
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }
            .facts dd i {
                font-size: 11px;
                color: var(--tomo-text-muted);
            }
            .facts dd.dim,
            .dim {
                color: var(--tomo-text-faint);
                font-style: italic;
            }
            .dim-small {
                color: var(--tomo-text-muted);
                font-size: 11.5px;
            }
            .badge-info {
                display: inline-block;
                padding: 2px 8px;
                background: rgba(59, 130, 246, 0.12);
                color: var(--tomo-info);
                border-radius: var(--tomo-radius-pill);
                font-size: 10.5px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.4px;
            }

            /* Pricing card */
            .price-card {
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
                padding: 14px;
            }
            .price-row {
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                padding: 4px 0;
            }
            .price-key {
                color: var(--tomo-text);
            }
            .price-val {
                font-weight: 700;
                color: var(--tomo-text-strong);
            }
            .price-row.total {
                border-top: 1px solid var(--tomo-divider);
                margin-top: 8px;
                padding-top: 10px;
                font-size: 15px;
            }
            .price-row.total .price-val strong {
                font-size: 18px;
                letter-spacing: -0.3px;
            }
            .payment-method {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid var(--tomo-divider);
                font-size: 12.5px;
                font-weight: 600;
                color: var(--tomo-text-secondary);
                text-transform: capitalize;
            }
            .payment-method i {
                font-size: 12px;
                color: var(--tomo-text-muted);
            }

            /* Status override card */
            .status-card {
                display: grid;
                grid-template-columns: 80px 1fr auto;
                gap: 10px;
                align-items: center;
                padding: 12px 14px;
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
            }
            .status-label {
                font-size: 11.5px;
                font-weight: 700;
                color: var(--tomo-text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            ::ng-deep .status-select {
                width: 100%;
            }
            ::ng-deep .status-save .p-button {
                height: 36px;
                font-size: 12.5px;
                font-weight: 700;
                border-radius: var(--tomo-radius-md);
            }
            .hint-row {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                margin-top: 10px;
                font-size: 12px;
                color: var(--tomo-text-muted);
                line-height: 1.5;
            }
            .hint-row i {
                font-size: 13px;
                margin-top: 1px;
            }

            /* Side stats */
            .side-stats {
                margin-top: 22px;
            }
            .side-stats .stat-row {
                display: flex;
                justify-content: space-between;
                font-size: 12.5px;
                padding: 10px 14px;
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
                margin-bottom: 6px;
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
                font-size: 11px;
                font-weight: 600;
                color: var(--tomo-text-secondary);
            }

            /* Empty inline */
            .empty-inline {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px 14px;
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
                font-size: 13px;
                color: var(--tomo-text-muted);
                font-weight: 500;
            }
            .empty-inline i {
                font-size: 16px;
            }
        `
    ]
})
export class ReservationDetailDrawer {
    private reservationsService = inject(ReservationsService);

    readonly reservation = input<ReservationRow | null>(null);
    readonly close = output<void>();
    readonly changed = output<void>();

    readonly visible = computed(() => !!this.reservation());

    readonly statusOptions = STATUS_OPTIONS;

    readonly dossier = signal<ReservationDossier | null>(null);
    readonly loading = signal(false);

    readonly actionLoading = signal<'status' | null>(null);

    pendingStatus: ReservationStatus = 'pending';

    readonly statusChanged = computed(() => {
        const r = this.reservation();
        return !!r && this.pendingStatus !== r.status;
    });

    readonly days = computed(() => {
        const r = this.reservation();
        if (!r) return 0;
        return ReservationsService.daysBetween(r.start_date, r.end_date);
    });

    readonly subtotal = computed(() => {
        const r = this.reservation();
        if (!r) return 0;
        return r.daily_rate * this.days();
    });

    readonly total = computed(() => {
        const r = this.reservation();
        if (!r) return 0;
        return ReservationsService.totalAmount(r);
    });

    constructor() {
        effect(() => {
            const r = this.reservation();
            if (!r) {
                this.dossier.set(null);
                return;
            }
            this.pendingStatus = r.status;
            void this.loadDossier(r.id);
        });
    }

    private async loadDossier(id: string): Promise<void> {
        this.loading.set(true);
        const dossier = await this.reservationsService.getDossier(id);
        if (this.reservation()?.id !== id) return;
        this.dossier.set(dossier);
        this.loading.set(false);
    }

    onDrawerHide(): void {
        this.close.emit();
    }

    vehicleThumb(): string | null {
        const v = this.dossier()?.vehicle;
        if (!v) return null;
        return ReservationsService.primaryImage(v.vehicle_images)?.image_url ?? null;
    }

    async onSaveStatus(): Promise<void> {
        const r = this.reservation();
        if (!r || !this.statusChanged() || this.actionLoading()) return;
        this.actionLoading.set('status');
        const ok = await this.reservationsService.setStatus(r.id, this.pendingStatus);
        this.actionLoading.set(null);
        if (ok) this.changed.emit();
    }

    initialsOf(name: string | null | undefined, email: string | null | undefined): string {
        const trimmed = name?.trim();
        if (!trimmed) return (email?.[0] ?? '?').toUpperCase();
        const parts = trimmed.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
        return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }

    statusClass(status: string): string {
        switch (status) {
            case 'pending':
                return 'is-warning';
            case 'confirmed':
                return 'is-info';
            case 'active':
                return 'is-success';
            case 'completed':
                return 'is-muted';
            case 'cancelled':
                return 'is-danger';
            default:
                return 'is-muted';
        }
    }

    kycClass(status: string): string {
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

    paymentClass(status: string): string {
        switch (status) {
            case 'paid':
                return 'is-success';
            case 'pending':
                return 'is-warning';
            case 'refunded':
                return 'is-info';
            case 'failed':
                return 'is-danger';
            default:
                return 'is-muted';
        }
    }

    formatDateLong(iso: string | null | undefined): string {
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
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
        return this.formatDateLong(iso);
    }
}
