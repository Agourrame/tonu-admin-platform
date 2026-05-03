import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { VehiclesFilter, VehiclesService, VehicleRow } from '@/services/vehicles.service';
import { VehicleDetailDrawer } from './vehicle-detail-drawer';

interface FilterOption {
    key: VehiclesFilter;
    label: string;
}

@Component({
    selector: 'app-vehicles',
    standalone: true,
    imports: [CommonModule, FormsModule, TableModule, IconFieldModule, InputIconModule, InputTextModule, ButtonModule, TooltipModule, VehicleDetailDrawer],
    template: `
        <div class="vehicles-page">
            <div class="tomo-page-titlebar tomo-anim-item">
                <span class="tomo-eyebrow">Marketplace</span>
                <h1 class="tomo-h1">Vehicles</h1>
                <p class="tomo-sub">Fleet inventory across all agencies. Force-block bad listings, audit photos, override status. Public visibility depends on the parent agency being active + verified.</p>
            </div>

            <div class="filter-row tomo-anim-item" style="animation-delay: 0.04s">
                <div class="chips">
                    @for (opt of filterOptions; track opt.key) {
                        <button
                            type="button"
                            class="tomo-chip"
                            [class.is-active]="filter() === opt.key"
                            (click)="setFilter(opt.key)"
                        >
                            {{ opt.label }}
                        </button>
                    }
                </div>

                <p-iconfield class="search-field">
                    <p-inputicon class="pi pi-search" />
                    <input
                        type="text"
                        pInputText
                        placeholder="Search by brand, model, or plate…"
                        [(ngModel)]="searchInputModel"
                        (ngModelChange)="onSearchChange($event)"
                        class="search-input"
                    />
                </p-iconfield>
            </div>

            <div class="table-card tomo-anim-item" style="animation-delay: 0.08s">
                <p-table
                    [value]="rows()"
                    [lazy]="true"
                    [paginator]="true"
                    [rows]="pageSize()"
                    [totalRecords]="total()"
                    [loading]="loading()"
                    (onLazyLoad)="onLazyLoad($event)"
                    [rowsPerPageOptions]="[20, 50, 100]"
                    [rowHover]="true"
                    dataKey="id"
                    styleClass="vehicles-table"
                    paginatorPosition="bottom"
                    currentPageReportTemplate="{first}–{last} of {totalRecords}"
                    [showCurrentPageReport]="true"
                >
                    <ng-template #header>
                        <tr>
                            <th class="col-vehicle">Vehicle</th>
                            <th class="col-agency">Agency</th>
                            <th class="col-price">Price/day</th>
                            <th class="col-status">Status</th>
                            <th class="col-visibility">Visibility</th>
                        </tr>
                    </ng-template>

                    <ng-template #body let-v>
                        <tr [class.is-selected]="selectedVehicle()?.id === v.id" (click)="onRowSelect(v)">
                            <td class="col-vehicle">
                                <div class="vehicle-cell">
                                    @if (primaryImageUrl(v); as url) {
                                        <img class="thumb" [src]="url" [alt]="v.brand + ' ' + v.model" loading="lazy" />
                                    } @else {
                                        <div class="thumb thumb-fallback">
                                            <i class="pi pi-car"></i>
                                        </div>
                                    }
                                    <div class="vehicle-meta">
                                        <div class="vehicle-name">{{ v.brand }} {{ v.model }} <span class="year">· {{ v.year }}</span></div>
                                        <div class="vehicle-sub">
                                            <span class="plate">{{ v.plate_number }}</span>
                                            <span class="dot">·</span>
                                            <span class="cat">{{ v.category }}</span>
                                            <span class="dot">·</span>
                                            <span>{{ v.transmission | titlecase }}</span>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td class="col-agency">
                                @if (v.agency; as ag) {
                                    <div class="agency-cell">
                                        <div class="agency-name">{{ ag.name }}</div>
                                        @if (ag.city) {
                                            <div class="agency-city"><i class="pi pi-map-marker"></i> {{ ag.city }}</div>
                                        }
                                    </div>
                                } @else {
                                    <span class="dim">— orphaned</span>
                                }
                            </td>
                            <td class="col-price">
                                <span class="price">{{ v.price_per_day | number }}</span>
                                <span class="price-suffix">MAD</span>
                            </td>
                            <td class="col-status">
                                <span class="tomo-status" [ngClass]="statusClass(v.status)">{{ v.status }}</span>
                            </td>
                            <td class="col-visibility">
                                @if (isPublic(v)) {
                                    <span class="visibility public" pTooltip="Visible to renters in the marketplace" tooltipPosition="left">
                                        <i class="pi pi-eye"></i> Public
                                    </span>
                                } @else {
                                    <span class="visibility hidden" [pTooltip]="hiddenReason(v)" tooltipPosition="left">
                                        <i class="pi pi-eye-slash"></i> Hidden
                                    </span>
                                }
                            </td>
                        </tr>
                    </ng-template>

                    <ng-template #emptymessage>
                        <tr>
                            <td colspan="5">
                                <div class="empty">
                                    <div class="tomo-icon-badge is-orange is-lg">
                                        <i class="pi pi-car"></i>
                                    </div>
                                    @if (search()) {
                                        <h3>No matches</h3>
                                        <p>No vehicles match "{{ search() }}". Try brand, model, or plate.</p>
                                    } @else if (filter() !== 'all') {
                                        <h3>Nothing here</h3>
                                        <p>No vehicles match the "{{ activeFilterLabel() }}" filter.</p>
                                    } @else {
                                        <h3>No vehicles yet</h3>
                                        <p>Once agencies onboard their fleets, vehicles will appear here.</p>
                                    }
                                </div>
                            </td>
                        </tr>
                    </ng-template>

                    <ng-template #loadingbody>
                        @for (_ of skeletonRows; track $index) {
                            <tr>
                                <td>
                                    <div style="display: flex; gap: 12px; align-items: center;">
                                        <div class="tomo-sk-block" style="width: 60px; height: 44px"></div>
                                        <div style="flex: 1">
                                            <div class="tomo-sk-line" style="width: 70%"></div>
                                            <div class="tomo-sk-line" style="width: 50%; margin-top: 6px; height: 10px"></div>
                                        </div>
                                    </div>
                                </td>
                                <td><div class="tomo-sk-line" style="width: 70%"></div></td>
                                <td><div class="tomo-sk-line" style="width: 60px"></div></td>
                                <td><div class="tomo-sk-pill" style="width: 80px"></div></td>
                                <td><div class="tomo-sk-pill" style="width: 70px"></div></td>
                            </tr>
                        }
                    </ng-template>
                </p-table>
            </div>
        </div>

        <app-vehicle-detail-drawer
            [vehicle]="selectedVehicle()"
            (close)="closeDrawer()"
            (changed)="reloadCurrent()"
        />
    `,
    styles: [
        `
            .vehicles-page {
                padding: 28px 28px 48px;
                max-width: 1400px;
            }
            .filter-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 18px;
                flex-wrap: wrap;
            }
            .chips {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            .search-field {
                width: 320px;
                max-width: 100%;
            }
            ::ng-deep .search-field .p-iconfield {
                width: 100%;
            }
            ::ng-deep .search-field .p-inputicon {
                left: 14px;
                color: #888;
                z-index: 1;
            }
            .search-input {
                width: 100%;
                height: 42px;
                padding-left: 40px;
                padding-right: 14px;
                border-radius: 999px;
                border: 0;
                background: var(--tomo-bg-soft);
                font-size: 13.5px;
                font-weight: 500;
                color: var(--tomo-text);
                outline: none;
                transition: background 200ms ease, box-shadow 200ms ease;
            }
            .search-input::placeholder {
                color: var(--tomo-text-muted);
            }
            .search-input:focus {
                background: #fff;
                box-shadow: 0 0 0 1.5px var(--tomo-primary);
            }
            .table-card {
                background: var(--tomo-bg-card);
                border-radius: var(--tomo-radius-lg);
                box-shadow: var(--tomo-shadow-card);
                overflow: hidden;
            }
            ::ng-deep .vehicles-table .p-datatable-table {
                font-size: 13.5px;
            }
            ::ng-deep .vehicles-table .p-datatable-thead > tr > th {
                background: transparent;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                color: var(--tomo-text-muted);
                border-bottom: 1px solid var(--tomo-divider);
                padding: 14px 16px;
            }
            ::ng-deep .vehicles-table .p-datatable-tbody > tr > td {
                padding: 14px 16px;
                border-bottom: 1px solid var(--tomo-divider);
                color: var(--tomo-text);
                vertical-align: middle;
            }
            ::ng-deep .vehicles-table .p-datatable-tbody > tr {
                cursor: pointer;
                transition: background 160ms ease;
            }
            ::ng-deep .vehicles-table .p-datatable-tbody > tr:hover {
                background: var(--tomo-bg-soft);
            }
            ::ng-deep .vehicles-table .p-datatable-tbody > tr.is-selected {
                background: rgba(36, 40, 48, 0.04);
            }
            ::ng-deep .vehicles-table .p-paginator {
                background: transparent;
                border: 0;
                padding: 12px 16px;
                font-size: 12.5px;
                color: var(--tomo-text-muted);
            }
            .vehicle-cell {
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: 0;
            }
            .thumb {
                width: 56px;
                height: 42px;
                border-radius: 8px;
                object-fit: cover;
                background: var(--tomo-bg-soft);
                flex-shrink: 0;
            }
            .thumb-fallback {
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--tomo-text-faint);
                background: var(--tomo-bg-soft);
            }
            .thumb-fallback i {
                font-size: 18px;
            }
            .vehicle-meta {
                min-width: 0;
            }
            .vehicle-name {
                font-size: 13.5px;
                font-weight: 700;
                color: var(--tomo-text-strong);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .vehicle-name .year {
                font-weight: 500;
                color: var(--tomo-text-muted);
            }
            .vehicle-sub {
                font-size: 12px;
                color: var(--tomo-text-muted);
                margin-top: 2px;
                display: flex;
                align-items: center;
                gap: 4px;
                text-transform: capitalize;
            }
            .plate {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 11px;
                font-weight: 600;
            }
            .dot {
                opacity: 0.4;
            }
            .agency-cell {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .agency-name {
                font-size: 13px;
                font-weight: 600;
                color: var(--tomo-text);
            }
            .agency-city {
                font-size: 11.5px;
                color: var(--tomo-text-muted);
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .agency-city i {
                font-size: 10px;
            }
            .price {
                font-size: 14px;
                font-weight: 700;
                color: var(--tomo-text-strong);
            }
            .price-suffix {
                font-size: 11px;
                font-weight: 600;
                color: var(--tomo-text-muted);
                margin-left: 2px;
            }
            .visibility {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 10px;
                border-radius: var(--tomo-radius-pill);
                font-size: 11.5px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.4px;
            }
            .visibility.public {
                background: rgba(26, 170, 85, 0.1);
                color: var(--tomo-success);
            }
            .visibility.hidden {
                background: var(--tomo-bg-soft);
                color: var(--tomo-text-muted);
                cursor: help;
            }
            .visibility i {
                font-size: 11px;
            }
            .dim {
                color: var(--tomo-text-faint);
                font-style: italic;
                font-size: 12px;
            }
            .empty {
                padding: 56px 24px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
                text-align: center;
            }
            .empty h3 {
                font-size: 17px;
                font-weight: 700;
                color: var(--tomo-text-strong);
                margin: 4px 0 0;
            }
            .empty p {
                font-size: 13.5px;
                color: var(--tomo-text-muted);
                max-width: 360px;
                line-height: 1.5;
                margin: 0;
            }
            .empty .tomo-icon-badge {
                font-size: 24px;
            }
        `
    ]
})
export class Vehicles {
    private vehiclesService = inject(VehiclesService);

    readonly filterOptions: FilterOption[] = [
        { key: 'all', label: 'All' },
        { key: 'available', label: 'Available' },
        { key: 'rented', label: 'Rented' },
        { key: 'maintenance', label: 'Maintenance' },
        { key: 'inactive', label: 'Inactive' }
    ];

    readonly skeletonRows = Array.from({ length: 6 });

    readonly rows = signal<VehicleRow[]>([]);
    readonly total = signal(0);
    readonly loading = signal(false);
    readonly page = signal(0);
    readonly pageSize = signal(50);
    readonly filter = signal<VehiclesFilter>('all');
    readonly search = signal('');

    readonly selectedVehicle = signal<VehicleRow | null>(null);

    searchInputModel = '';
    private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    readonly activeFilterLabel = computed(
        () => this.filterOptions.find((o) => o.key === this.filter())?.label ?? ''
    );

    async onLazyLoad(event: TableLazyLoadEvent): Promise<void> {
        const first = event.first ?? 0;
        const rows = event.rows ?? this.pageSize();
        this.page.set(Math.floor(first / rows));
        this.pageSize.set(rows);
        await this.load();
    }

    setFilter(filter: VehiclesFilter): void {
        if (this.filter() === filter) return;
        this.filter.set(filter);
        this.page.set(0);
        void this.load();
    }

    onSearchChange(value: string): void {
        if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
            this.search.set(value.trim());
            this.page.set(0);
            void this.load();
        }, 300);
    }

    private async load(): Promise<void> {
        this.loading.set(true);
        const { rows, total } = await this.vehiclesService.list({
            page: this.page(),
            pageSize: this.pageSize(),
            filter: this.filter(),
            search: this.search()
        });
        this.rows.set(rows);
        this.total.set(total);
        this.loading.set(false);
    }

    async reloadCurrent(): Promise<void> {
        const cur = this.selectedVehicle();
        if (!cur) return;
        const { rows } = await this.vehiclesService.list({
            page: 0,
            pageSize: 1,
            search: cur.plate_number
        });
        const fresh = rows.find((r) => r.id === cur.id);
        if (fresh) {
            this.selectedVehicle.set(fresh);
            this.rows.update((list) => list.map((r) => (r.id === fresh.id ? fresh : r)));
        }
    }

    onRowSelect(vehicle: VehicleRow): void {
        this.selectedVehicle.set(vehicle);
    }

    closeDrawer(): void {
        this.selectedVehicle.set(null);
    }

    primaryImageUrl(v: VehicleRow): string | null {
        const primary = VehiclesService.primaryImage(v.vehicle_images);
        return primary?.image_url ?? null;
    }

    isPublic(v: VehicleRow): boolean {
        return VehiclesService.isPublic(v);
    }

    hiddenReason(v: VehicleRow): string {
        if (!v.agency) return 'Vehicle has no parent agency';
        const a = v.agency;
        const reasons: string[] = [];
        if (a.status !== 'active') reasons.push(`agency status is ${a.status}`);
        if (a.verification_status !== 'verified') reasons.push(`agency KYC is ${a.verification_status}`);
        if (v.status !== 'available' && v.status !== 'rented') reasons.push(`vehicle status is ${v.status}`);
        if (!reasons.length) return 'Hidden';
        return 'Hidden: ' + reasons.join(', ');
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
}
