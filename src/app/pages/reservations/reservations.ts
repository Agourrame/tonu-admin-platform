import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { ReservationsFilter, ReservationsService, ReservationRow } from '@/services/reservations.service';
import { ReservationDetailDrawer } from './reservation-detail-drawer';

interface FilterOption {
    key: ReservationsFilter;
    label: string;
}

@Component({
    selector: 'app-reservations',
    standalone: true,
    imports: [CommonModule, FormsModule, TableModule, IconFieldModule, InputIconModule, InputTextModule, ReservationDetailDrawer],
    template: `
        <div class="reservations-page">
            <div class="tomo-page-titlebar tomo-anim-item">
                <span class="tomo-eyebrow">Marketplace</span>
                <h1 class="tomo-h1">Reservations</h1>
                <p class="tomo-sub">Every booking across the platform. Track lifecycle, resolve disputes, override status when needed.</p>
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
                        placeholder="Paste a booking ID…"
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
                    styleClass="reservations-table"
                    paginatorPosition="bottom"
                    currentPageReportTemplate="{first}–{last} of {totalRecords}"
                    [showCurrentPageReport]="true"
                >
                    <ng-template #header>
                        <tr>
                            <th class="col-id">Ref</th>
                            <th class="col-renter">Renter</th>
                            <th class="col-vehicle">Vehicle</th>
                            <th class="col-dates">Dates</th>
                            <th class="col-total">Total</th>
                            <th class="col-status">Status</th>
                        </tr>
                    </ng-template>

                    <ng-template #body let-r>
                        <tr [class.is-selected]="selectedReservation()?.id === r.id" (click)="onRowSelect(r)">
                            <td class="col-id">
                                <span class="ref">{{ shortId(r.id) }}</span>
                            </td>
                            <td class="col-renter">
                                @if (r.user; as u) {
                                    <div class="renter-cell">
                                        <div class="avatar">{{ initialsOf(u.full_name, u.email) }}</div>
                                        <div class="renter-meta">
                                            <div class="renter-name">{{ u.full_name || '—' }}</div>
                                            <div class="renter-email">{{ u.email }}</div>
                                        </div>
                                    </div>
                                } @else {
                                    <span class="dim">— deleted user</span>
                                }
                            </td>
                            <td class="col-vehicle">
                                @if (r.vehicle; as v) {
                                    <div class="vehicle-cell">
                                        @if (primaryImageUrl(r); as url) {
                                            <img class="thumb" [src]="url" [alt]="v.brand" loading="lazy" />
                                        } @else {
                                            <div class="thumb thumb-fallback"><i class="pi pi-car"></i></div>
                                        }
                                        <div class="vehicle-meta">
                                            <div class="vehicle-name">{{ v.brand }} {{ v.model }}</div>
                                            <div class="vehicle-sub">
                                                @if (v.agency) {
                                                    {{ v.agency.name }}
                                                } @else {
                                                    <span class="dim">no agency</span>
                                                }
                                            </div>
                                        </div>
                                    </div>
                                } @else {
                                    <span class="dim">— deleted vehicle</span>
                                }
                            </td>
                            <td class="col-dates">
                                <div class="dates">
                                    <span>{{ formatDateShort(r.start_date) }}</span>
                                    <i class="pi pi-arrow-right"></i>
                                    <span>{{ formatDateShort(r.end_date) }}</span>
                                </div>
                                <div class="dates-sub">{{ daysBetween(r) }} day{{ daysBetween(r) === 1 ? '' : 's' }}</div>
                            </td>
                            <td class="col-total">
                                <span class="total">{{ totalOf(r) | number }}</span>
                                <span class="total-suffix">MAD</span>
                            </td>
                            <td class="col-status">
                                <span class="tomo-status" [ngClass]="statusClass(r.status)">{{ r.status }}</span>
                            </td>
                        </tr>
                    </ng-template>

                    <ng-template #emptymessage>
                        <tr>
                            <td colspan="6">
                                <div class="empty">
                                    <div class="tomo-icon-badge is-orange is-lg">
                                        <i class="pi pi-calendar"></i>
                                    </div>
                                    @if (search()) {
                                        <h3>No matches</h3>
                                        <p>No reservations match "{{ search() }}".</p>
                                    } @else if (filter() !== 'all') {
                                        <h3>Nothing here</h3>
                                        <p>No reservations match the "{{ activeFilterLabel() }}" filter.</p>
                                    } @else {
                                        <h3>No reservations yet</h3>
                                        <p>Once renters book vehicles in the mobile app, the bookings show up here.</p>
                                    }
                                </div>
                            </td>
                        </tr>
                    </ng-template>

                    <ng-template #loadingbody>
                        @for (_ of skeletonRows; track $index) {
                            <tr>
                                <td><div class="tomo-sk-line" style="width: 60px"></div></td>
                                <td><div class="tomo-sk-line" style="width: 70%"></div></td>
                                <td><div class="tomo-sk-line" style="width: 80%"></div></td>
                                <td><div class="tomo-sk-line" style="width: 70%"></div></td>
                                <td><div class="tomo-sk-line" style="width: 60px"></div></td>
                                <td><div class="tomo-sk-pill" style="width: 80px"></div></td>
                            </tr>
                        }
                    </ng-template>
                </p-table>
            </div>
        </div>

        <app-reservation-detail-drawer
            [reservation]="selectedReservation()"
            (close)="closeDrawer()"
            (changed)="reloadCurrent()"
        />
    `,
    styles: [
        `
            .reservations-page {
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
            ::ng-deep .reservations-table .p-datatable-table {
                font-size: 13.5px;
            }
            ::ng-deep .reservations-table .p-datatable-thead > tr > th {
                background: transparent;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                color: var(--tomo-text-muted);
                border-bottom: 1px solid var(--tomo-divider);
                padding: 14px 16px;
            }
            ::ng-deep .reservations-table .p-datatable-tbody > tr > td {
                padding: 14px 16px;
                border-bottom: 1px solid var(--tomo-divider);
                color: var(--tomo-text);
                vertical-align: middle;
            }
            ::ng-deep .reservations-table .p-datatable-tbody > tr {
                cursor: pointer;
                transition: background 160ms ease;
            }
            ::ng-deep .reservations-table .p-datatable-tbody > tr:hover {
                background: var(--tomo-bg-soft);
            }
            ::ng-deep .reservations-table .p-datatable-tbody > tr.is-selected {
                background: rgba(36, 40, 48, 0.04);
            }
            ::ng-deep .reservations-table .p-paginator {
                background: transparent;
                border: 0;
                padding: 12px 16px;
                font-size: 12.5px;
                color: var(--tomo-text-muted);
            }
            .ref {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 12px;
                font-weight: 700;
                color: var(--tomo-primary);
            }
            .renter-cell {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: var(--tomo-primary);
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11.5px;
                font-weight: 800;
                flex-shrink: 0;
            }
            .renter-name {
                font-size: 13px;
                font-weight: 700;
                color: var(--tomo-text-strong);
            }
            .renter-email {
                font-size: 11.5px;
                color: var(--tomo-text-muted);
            }
            .vehicle-cell {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .thumb {
                width: 44px;
                height: 32px;
                border-radius: 6px;
                object-fit: cover;
                background: var(--tomo-bg-soft);
                flex-shrink: 0;
            }
            .thumb-fallback {
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--tomo-text-faint);
            }
            .thumb-fallback i {
                font-size: 14px;
            }
            .vehicle-name {
                font-size: 13px;
                font-weight: 700;
                color: var(--tomo-text-strong);
            }
            .vehicle-sub {
                font-size: 11.5px;
                color: var(--tomo-text-muted);
            }
            .dates {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 13px;
                font-weight: 600;
                color: var(--tomo-text);
            }
            .dates i {
                font-size: 10px;
                color: var(--tomo-text-faint);
            }
            .dates-sub {
                font-size: 11.5px;
                color: var(--tomo-text-muted);
                margin-top: 2px;
            }
            .total {
                font-size: 14px;
                font-weight: 800;
                color: var(--tomo-text-strong);
            }
            .total-suffix {
                font-size: 11px;
                font-weight: 600;
                color: var(--tomo-text-muted);
                margin-left: 2px;
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
export class Reservations {
    private reservationsService = inject(ReservationsService);

    readonly filterOptions: FilterOption[] = [
        { key: 'all', label: 'All' },
        { key: 'pending', label: 'Pending' },
        { key: 'confirmed', label: 'Confirmed' },
        { key: 'active', label: 'Active' },
        { key: 'completed', label: 'Completed' },
        { key: 'cancelled', label: 'Cancelled' }
    ];

    readonly skeletonRows = Array.from({ length: 6 });

    readonly rows = signal<ReservationRow[]>([]);
    readonly total = signal(0);
    readonly loading = signal(false);
    readonly page = signal(0);
    readonly pageSize = signal(50);
    readonly filter = signal<ReservationsFilter>('all');
    readonly search = signal('');

    readonly selectedReservation = signal<ReservationRow | null>(null);

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

    setFilter(filter: ReservationsFilter): void {
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
        const { rows, total } = await this.reservationsService.list({
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
        const cur = this.selectedReservation();
        if (!cur) return;
        const dossier = await this.reservationsService.getDossier(cur.id);
        if (dossier) {
            const fresh: ReservationRow = { ...dossier };
            this.selectedReservation.set(fresh);
            this.rows.update((list) => list.map((r) => (r.id === fresh.id ? fresh : r)));
        }
    }

    onRowSelect(reservation: ReservationRow): void {
        this.selectedReservation.set(reservation);
    }

    closeDrawer(): void {
        this.selectedReservation.set(null);
    }

    primaryImageUrl(r: ReservationRow): string | null {
        const v = r.vehicle;
        if (!v) return null;
        return ReservationsService.primaryImage(v.vehicle_images)?.image_url ?? null;
    }

    daysBetween(r: ReservationRow): number {
        return ReservationsService.daysBetween(r.start_date, r.end_date);
    }

    totalOf(r: ReservationRow): number {
        return ReservationsService.totalAmount(r);
    }

    initialsOf(name: string | null | undefined, email: string | null | undefined): string {
        const trimmed = name?.trim();
        if (!trimmed) return (email?.[0] ?? '?').toUpperCase();
        const parts = trimmed.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
        return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }

    shortId(id: string): string {
        return id ? `#${id.slice(0, 8)}` : '—';
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

    formatDateShort(iso: string | null | undefined): string {
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
}
