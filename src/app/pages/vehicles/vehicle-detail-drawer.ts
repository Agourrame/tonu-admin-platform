import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService } from 'primeng/api';
import { VehicleDossier, VehicleRow, VehiclesService } from '@/services/vehicles.service';
import { VehicleStatus } from '@/models/enums';

const STATUS_OPTIONS: { label: string; value: VehicleStatus }[] = [
    { label: 'Available', value: 'available' },
    { label: 'Rented', value: 'rented' },
    { label: 'Maintenance', value: 'maintenance' },
    { label: 'Inactive', value: 'inactive' }
];

/**
 * Side drawer for a single vehicle. Surfaces the full inventory record
 * (photos, specs, pricing, agency, marketplace visibility verdict) plus
 * admin status overrides + delete.
 */
@Component({
    selector: 'app-vehicle-detail-drawer',
    standalone: true,
    imports: [CommonModule, FormsModule, TitleCasePipe, DrawerModule, ButtonModule, SelectModule, ConfirmDialogModule, TooltipModule],
    providers: [ConfirmationService],
    template: `
        <p-drawer
            [visible]="visible()"
            (onHide)="onDrawerHide()"
            position="right"
            [style]="{ width: '560px' }"
            [transitionOptions]="'.3s cubic-bezier(0, 0, 0.2, 1)'"
            styleClass="vehicle-detail-drawer"
            [showCloseIcon]="true"
        >
            @if (vehicle(); as v) {
                @if (loading()) {
                    <div class="loading-shell">
                        <div class="tomo-sk-block" style="height: 200px"></div>
                        <div class="tomo-sk-line" style="width: 70%; margin-top: 18px; height: 22px"></div>
                        <div class="tomo-sk-line" style="width: 50%; margin-top: 8px"></div>
                        <div class="tomo-sk-block" style="height: 180px; margin-top: 22px"></div>
                    </div>
                }
                @if (!loading() && dossier(); as d) {
                    <div class="drawer-content">
                        <!-- Hero photo -->
                        <div class="hero">
                            @if (heroImage(); as url) {
                                <img [src]="url" [alt]="v.brand + ' ' + v.model" class="hero-img" />
                            } @else {
                                <div class="hero-fallback">
                                    <i class="pi pi-car"></i>
                                </div>
                            }
                            <span class="hero-status tomo-status" [ngClass]="statusClass(v.status)">
                                {{ v.status }}
                            </span>
                        </div>

                        <!-- Title -->
                        <div class="title-row">
                            <div class="title-main">
                                <h2 class="title">{{ v.brand }} {{ v.model }}</h2>
                                <div class="sub">
                                    <span class="year">{{ v.year }}</span>
                                    <span class="dot">·</span>
                                    <span class="plate">{{ v.plate_number }}</span>
                                    <span class="dot">·</span>
                                    <span>{{ v.category }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Visibility banner -->
                        @if (isPublic(v)) {
                            <div class="visibility-banner public">
                                <i class="pi pi-eye"></i>
                                <span>Public — visible to renters in the marketplace.</span>
                            </div>
                        } @else {
                            <div class="visibility-banner hidden">
                                <i class="pi pi-eye-slash"></i>
                                <span>{{ hiddenReason(v) }}</span>
                            </div>
                        }

                        <!-- Agency -->
                        @if (d.agency; as ag) {
                            <div class="section">
                                <div class="tomo-field-label">Agency</div>
                                <div class="agency-card">
                                    <div class="agency-avatar">{{ initialsOf(ag.name) }}</div>
                                    <div>
                                        <div class="agency-name">{{ ag.name }}</div>
                                        <div class="agency-sub">
                                            @if (ag.city) {
                                                <i class="pi pi-map-marker"></i> {{ ag.city }} ·
                                            }
                                            <span class="slug">/{{ ag.slug }}</span>
                                        </div>
                                        <div class="agency-status-row">
                                            <span class="tomo-status" [ngClass]="agencyStatusClass(ag.status)">
                                                {{ ag.status }}
                                            </span>
                                            <span class="tomo-status" [ngClass]="verifClass(ag.verification_status)">
                                                kyc: {{ ag.verification_status }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        }

                        <!-- Specs -->
                        <div class="section">
                            <div class="tomo-field-label">Specs</div>
                            <div class="specs-grid">
                                <div class="spec">
                                    <i class="pi pi-bolt"></i>
                                    <div class="spec-label">Fuel</div>
                                    <div class="spec-value">{{ v.fuel | titlecase }}</div>
                                </div>
                                <div class="spec">
                                    <i class="pi pi-cog"></i>
                                    <div class="spec-label">Transmission</div>
                                    <div class="spec-value">{{ v.transmission | titlecase }}</div>
                                </div>
                                <div class="spec">
                                    <i class="pi pi-users"></i>
                                    <div class="spec-label">Seats</div>
                                    <div class="spec-value">{{ v.seats }}</div>
                                </div>
                                @if (v.engine_cc) {
                                    <div class="spec">
                                        <i class="pi pi-circle"></i>
                                        <div class="spec-label">Engine</div>
                                        <div class="spec-value">{{ v.engine_cc }} cc</div>
                                    </div>
                                }
                                @if (v.horsepower) {
                                    <div class="spec">
                                        <i class="pi pi-forward"></i>
                                        <div class="spec-label">Power</div>
                                        <div class="spec-value">{{ v.horsepower }} hp</div>
                                    </div>
                                }
                                @if (v.fuel_consumption) {
                                    <div class="spec">
                                        <i class="pi pi-chart-line"></i>
                                        <div class="spec-label">Consumption</div>
                                        <div class="spec-value">{{ v.fuel_consumption }} L/100</div>
                                    </div>
                                }
                            </div>
                        </div>

                        <!-- Pricing & policy -->
                        <div class="section">
                            <div class="tomo-field-label">Pricing & policy</div>
                            <dl class="facts">
                                <dt>Per day</dt>
                                <dd><strong>{{ v.price_per_day | number }}</strong> MAD</dd>
                                @if (v.price_per_week) {
                                    <dt>Per week</dt>
                                    <dd>{{ v.price_per_week | number }} MAD</dd>
                                }
                                <dt>Min rental</dt>
                                <dd>{{ v.min_rental_days }} day{{ v.min_rental_days === 1 ? '' : 's' }}</dd>
                                @if (v.deposit_amount) {
                                    <dt>Deposit</dt>
                                    <dd>{{ v.deposit_amount | number }} MAD</dd>
                                }
                                <dt>Mileage</dt>
                                <dd>
                                    @if (v.unlimited_km) {
                                        <span class="badge-free">Unlimited</span>
                                    } @else if (v.km_limit_per_day) {
                                        {{ v.km_limit_per_day }} km/day
                                        @if (v.extra_km_price) {
                                            <span class="dim-small"> · {{ v.extra_km_price }} MAD/extra km</span>
                                        }
                                    } @else {
                                        <span class="dim">—</span>
                                    }
                                </dd>
                                @if (v.current_km) {
                                    <dt>Odometer</dt>
                                    <dd>{{ v.current_km | number }} km</dd>
                                }
                            </dl>
                        </div>

                        <!-- Insurance -->
                        @if (v.insurance_company || v.insurance_type || v.insurance_expiry) {
                            <div class="section">
                                <div class="tomo-field-label">Insurance</div>
                                <dl class="facts">
                                    @if (v.insurance_company) {
                                        <dt>Company</dt>
                                        <dd>{{ v.insurance_company }}</dd>
                                    }
                                    @if (v.insurance_type) {
                                        <dt>Type</dt>
                                        <dd>{{ v.insurance_type }}</dd>
                                    }
                                    @if (v.insurance_expiry) {
                                        <dt>Expiry</dt>
                                        <dd>{{ v.insurance_expiry }}</dd>
                                    }
                                </dl>
                            </div>
                        }

                        <!-- Photo gallery -->
                        <div class="section">
                            <div class="tomo-section-header">
                                <span class="tomo-field-label">Photos</span>
                                <span class="dim-small">{{ d.images.length }} image{{ d.images.length === 1 ? '' : 's' }}</span>
                            </div>
                            @if (d.images.length) {
                                <div class="photos-grid">
                                    @for (img of orderedImages(); track img.id) {
                                        <a class="photo" [href]="img.image_url" target="_blank" rel="noopener">
                                            <img [src]="img.image_url" [alt]="v.brand + ' photo'" loading="lazy" />
                                            @if (img.is_primary) {
                                                <span class="primary-badge">Primary</span>
                                            }
                                        </a>
                                    }
                                </div>
                            } @else {
                                <div class="empty-inline">
                                    <i class="pi pi-image"></i>
                                    <span>No photos uploaded.</span>
                                </div>
                            }
                        </div>

                        <!-- Features -->
                        @if (d.features.length) {
                            <div class="section">
                                <div class="tomo-field-label">Features</div>
                                <div class="feature-list">
                                    @for (f of d.features; track f.id) {
                                        <div class="feature">
                                            <i class="pi" [class.pi-check-circle]="f.is_included" [class.pi-plus-circle]="!f.is_included"></i>
                                            <span class="feature-name">{{ f.feature_name }}</span>
                                            @if (!f.is_included && f.extra_price) {
                                                <span class="feature-price">+{{ f.extra_price }} MAD</span>
                                            } @else if (f.is_included) {
                                                <span class="feature-included">Included</span>
                                            }
                                        </div>
                                    }
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
                                    label="Save status"
                                    [loading]="actionLoading() === 'status'"
                                    [disabled]="!statusChanged() || !!actionLoading()"
                                    (onClick)="onSaveStatus()"
                                    styleClass="status-save"
                                />
                            </div>
                            <p class="hint-row">
                                <i class="pi pi-info-circle"></i>
                                <span>Setting status to <strong>inactive</strong> hides this vehicle from the marketplace immediately, even if the agency is otherwise verified.</span>
                            </p>
                        </div>

                        <!-- Activity stats -->
                        <div class="section side-stats">
                            <div class="stat-row">
                                <div class="stat-key">Active reservations</div>
                                <div class="stat-val">{{ activeReservations() }}</div>
                            </div>
                            <div class="stat-row">
                                <div class="stat-key">Blocked dates</div>
                                <div class="stat-val">{{ d.availability.length }}</div>
                            </div>
                            <div class="stat-row">
                                <div class="stat-key">Created</div>
                                <div class="stat-val">{{ formatDate(v.created_at) }}</div>
                            </div>
                        </div>

                        <!-- Danger zone -->
                        <div class="section danger-zone">
                            <div class="tomo-field-label">Danger zone</div>
                            <div class="danger-card">
                                <div class="danger-info">
                                    <div class="danger-title">Delete vehicle</div>
                                    <div class="danger-sub">Permanent. Removes the vehicle and cascades to its features, images, availability, and reservations.</div>
                                </div>
                                <p-button
                                    label="Delete"
                                    icon="pi pi-trash"
                                    severity="danger"
                                    [outlined]="true"
                                    [loading]="actionLoading() === 'delete'"
                                    [disabled]="!!actionLoading()"
                                    (onClick)="confirmDelete()"
                                    styleClass="danger-btn"
                                />
                            </div>
                        </div>
                    </div>
                }
            }
        </p-drawer>

        <p-confirmdialog />
    `,
    styles: [
        `
            ::ng-deep .vehicle-detail-drawer .p-drawer-header {
                padding: 14px 18px 0;
            }
            ::ng-deep .vehicle-detail-drawer .p-drawer-content {
                padding: 0;
            }
            .loading-shell {
                padding: 22px;
            }
            .drawer-content {
                padding: 0 0 32px;
            }
            .hero {
                position: relative;
                aspect-ratio: 16 / 9;
                background: var(--tomo-bg-soft);
                overflow: hidden;
                margin-bottom: 0;
            }
            .hero-img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .hero-fallback {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--tomo-text-faint);
            }
            .hero-fallback i {
                font-size: 48px;
            }
            .hero-status {
                position: absolute;
                top: 14px;
                right: 14px;
                box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
            }
            .title-row {
                padding: 18px 22px 4px;
            }
            .title {
                font-size: 22px;
                font-weight: 800;
                letter-spacing: -0.4px;
                color: var(--tomo-text-strong);
                margin: 0 0 4px;
            }
            .sub {
                font-size: 13px;
                color: var(--tomo-text-muted);
                display: flex;
                align-items: center;
                gap: 6px;
                text-transform: capitalize;
            }
            .plate {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 12px;
                font-weight: 700;
                color: var(--tomo-text-secondary);
            }
            .dot {
                opacity: 0.4;
            }
            .visibility-banner {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 16px;
                margin: 14px 22px 0;
                border-radius: var(--tomo-radius-md);
                font-size: 13px;
                font-weight: 600;
                line-height: 1.45;
            }
            .visibility-banner.public {
                background: rgba(26, 170, 85, 0.08);
                color: var(--tomo-success);
            }
            .visibility-banner.hidden {
                background: rgba(245, 158, 11, 0.08);
                color: var(--tomo-warning);
            }
            .visibility-banner i {
                font-size: 14px;
            }
            .section {
                padding: 18px 22px 0;
            }
            .agency-card {
                display: flex;
                gap: 12px;
                align-items: flex-start;
                padding: 12px 14px;
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
            }
            .agency-avatar {
                width: 38px;
                height: 38px;
                border-radius: 10px;
                background: rgba(36, 40, 48, 0.06);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                font-weight: 800;
                color: var(--tomo-primary);
                flex-shrink: 0;
            }
            .agency-name {
                font-size: 13.5px;
                font-weight: 700;
                color: var(--tomo-text-strong);
            }
            .agency-sub {
                font-size: 12px;
                color: var(--tomo-text-muted);
                margin-top: 2px;
            }
            .agency-sub i {
                font-size: 10px;
            }
            .agency-sub .slug {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 11px;
            }
            .agency-status-row {
                display: flex;
                gap: 6px;
                margin-top: 6px;
                flex-wrap: wrap;
            }
            .specs-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
            }
            .spec {
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
                padding: 12px 10px;
                text-align: center;
            }
            .spec i {
                color: var(--tomo-text-muted);
                font-size: 16px;
                margin-bottom: 4px;
            }
            .spec-label {
                font-size: 10.5px;
                font-weight: 700;
                color: var(--tomo-text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 2px;
            }
            .spec-value {
                font-size: 13px;
                font-weight: 700;
                color: var(--tomo-text-strong);
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
                font-weight: 500;
                color: var(--tomo-text);
                margin: 0;
            }
            .badge-free {
                display: inline-block;
                padding: 2px 10px;
                background: rgba(26, 170, 85, 0.12);
                color: var(--tomo-success);
                border-radius: var(--tomo-radius-pill);
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.4px;
            }
            .photos-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
            }
            .photo {
                position: relative;
                aspect-ratio: 4 / 3;
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
                overflow: hidden;
                display: block;
                text-decoration: none;
                transition: filter 200ms ease;
            }
            .photo:hover {
                filter: brightness(0.96);
            }
            .photo img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .primary-badge {
                position: absolute;
                bottom: 6px;
                left: 6px;
                background: rgba(0, 0, 0, 0.6);
                color: #fff;
                font-size: 10px;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: var(--tomo-radius-pill);
                text-transform: uppercase;
                letter-spacing: 0.4px;
            }
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
            .feature-list {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .feature {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 12px;
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
                font-size: 13px;
            }
            .feature i {
                font-size: 13px;
                color: var(--tomo-text-muted);
            }
            .feature .pi-check-circle {
                color: var(--tomo-success);
            }
            .feature-name {
                flex: 1;
                font-weight: 600;
                color: var(--tomo-text);
            }
            .feature-included {
                font-size: 11px;
                font-weight: 700;
                color: var(--tomo-success);
                text-transform: uppercase;
                letter-spacing: 0.4px;
            }
            .feature-price {
                font-size: 12px;
                font-weight: 700;
                color: var(--tomo-secondary);
            }
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
            .side-stats {
                margin-top: 22px;
            }
            .side-stats .stat-row {
                display: flex;
                justify-content: space-between;
                font-size: 13px;
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
            .danger-zone {
                margin-top: 22px;
            }
            .danger-card {
                display: flex;
                gap: 12px;
                align-items: center;
                padding: 14px;
                background: rgba(229, 57, 53, 0.04);
                border: 1px solid rgba(229, 57, 53, 0.15);
                border-radius: var(--tomo-radius-md);
            }
            .danger-info {
                flex: 1;
            }
            .danger-title {
                font-size: 13.5px;
                font-weight: 700;
                color: var(--tomo-danger);
                margin-bottom: 2px;
            }
            .danger-sub {
                font-size: 12px;
                color: var(--tomo-text-muted);
                line-height: 1.45;
            }
            ::ng-deep .danger-btn .p-button {
                height: 38px;
                font-size: 12.5px;
                font-weight: 700;
                border-radius: var(--tomo-radius-md);
            }
            .dim {
                color: var(--tomo-text-faint);
                font-weight: 500;
                font-style: italic;
            }
            .dim-small {
                color: var(--tomo-text-muted);
                font-size: 11.5px;
                font-weight: 600;
            }
        `
    ]
})
export class VehicleDetailDrawer {
    private vehiclesService = inject(VehiclesService);
    private confirmationService = inject(ConfirmationService);

    readonly vehicle = input<VehicleRow | null>(null);
    readonly close = output<void>();
    readonly changed = output<void>();

    readonly visible = computed(() => !!this.vehicle());

    readonly statusOptions = STATUS_OPTIONS;

    // ----- async-loaded -----
    readonly dossier = signal<VehicleDossier | null>(null);
    readonly loading = signal(false);
    readonly activeReservations = signal(0);

    // ----- mutation state -----
    readonly actionLoading = signal<'status' | 'delete' | null>(null);

    // ----- pending status edit -----
    pendingStatus: VehicleStatus = 'available';

    readonly statusChanged = computed(() => {
        const v = this.vehicle();
        return !!v && this.pendingStatus !== v.status;
    });

    constructor() {
        effect(() => {
            const v = this.vehicle();
            if (!v) {
                this.dossier.set(null);
                this.activeReservations.set(0);
                return;
            }
            this.pendingStatus = v.status;
            void this.loadDossier(v.id);
        });
    }

    private async loadDossier(vehicleId: string): Promise<void> {
        this.loading.set(true);
        const [dossier, count] = await Promise.all([
            this.vehiclesService.getDossier(vehicleId),
            this.vehiclesService.activeReservationCount(vehicleId)
        ]);
        if (this.vehicle()?.id !== vehicleId) return;
        this.dossier.set(dossier);
        this.activeReservations.set(count);
        this.loading.set(false);
    }

    onDrawerHide(): void {
        this.close.emit();
    }

    heroImage(): string | null {
        const d = this.dossier();
        if (!d) return null;
        return VehiclesService.primaryImage(d.images)?.image_url ?? null;
    }

    orderedImages() {
        const d = this.dossier();
        if (!d) return [];
        return [...d.images].sort((a, b) => {
            // Primary first, then sort_order asc.
            if (a.is_primary && !b.is_primary) return -1;
            if (b.is_primary && !a.is_primary) return 1;
            return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        });
    }

    isPublic(v: VehicleRow): boolean {
        return VehiclesService.isPublic(v);
    }

    hiddenReason(v: VehicleRow): string {
        if (!v.agency) return 'Hidden — vehicle has no parent agency.';
        const a = v.agency;
        const reasons: string[] = [];
        if (a.status !== 'active') reasons.push(`agency status is ${a.status}`);
        if (a.verification_status !== 'verified') reasons.push(`agency KYC is ${a.verification_status}`);
        if (v.status !== 'available' && v.status !== 'rented') reasons.push(`vehicle status is ${v.status}`);
        if (!reasons.length) return 'Hidden from the marketplace.';
        return 'Hidden — ' + reasons.join(', ') + '.';
    }

    // ----- status change -----

    async onSaveStatus(): Promise<void> {
        const v = this.vehicle();
        if (!v || !this.statusChanged() || this.actionLoading()) return;
        this.actionLoading.set('status');
        const ok = await this.vehiclesService.setStatus(v.id, this.pendingStatus);
        this.actionLoading.set(null);
        if (ok) this.changed.emit();
    }

    // ----- delete -----

    confirmDelete(): void {
        const v = this.vehicle();
        if (!v) return;

        const liveCount = this.activeReservations();
        const message =
            liveCount > 0
                ? `This vehicle has <strong>${liveCount} active reservation${liveCount === 1 ? '' : 's'}</strong>. Deleting will cascade and remove those bookings too. Are you sure?`
                : `Delete <strong>${v.brand} ${v.model}</strong> (${v.plate_number})? This is permanent.`;

        this.confirmationService.confirm({
            header: 'Delete vehicle',
            message,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Delete',
            acceptButtonProps: { severity: 'danger' },
            rejectLabel: 'Cancel',
            rejectButtonProps: { severity: 'secondary', text: true },
            accept: async () => {
                this.actionLoading.set('delete');
                const ok = await this.vehiclesService.remove(v.id);
                this.actionLoading.set(null);
                if (ok) {
                    // Tell parent to refresh — it'll close the drawer because
                    // the row no longer exists in its list.
                    this.changed.emit();
                    this.close.emit();
                }
            }
        });
    }

    // ----- helpers -----

    initialsOf(name: string): string {
        const parts = (name ?? '').split(/\s+/).filter(Boolean);
        if (!parts.length) return '?';
        if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
        return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }

    statusClass(status: string): string {
        switch (status) {
            case 'available':
                return 'is-success';
            case 'rented':
                return 'is-info';
            case 'maintenance':
                return 'is-warning';
            case 'inactive':
                return 'is-muted';
            default:
                return 'is-muted';
        }
    }

    agencyStatusClass(status: string): string {
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

    formatDate(iso: string | null | undefined): string {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
}
