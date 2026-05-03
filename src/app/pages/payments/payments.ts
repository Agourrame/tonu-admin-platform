import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { PaymentsFilter, PaymentsService, PaymentRow } from '@/services/payments.service';

interface FilterOption {
    key: PaymentsFilter;
    label: string;
}

@Component({
    selector: 'app-payments',
    standalone: true,
    imports: [CommonModule, FormsModule, TitleCasePipe, TableModule, IconFieldModule, InputIconModule, InputTextModule],
    template: `
        <div class="payments-page">
            <div class="tomo-page-titlebar tomo-anim-item">
                <span class="tomo-eyebrow">Finance</span>
                <h1 class="tomo-h1">Payments</h1>
                <p class="tomo-sub">Write-once financial ledger. Each row snapshots a booking's amount, agency commission, agency net, and platform revenue at the moment of payment.</p>
            </div>

            <!-- KPI strip -->
            <div class="kpi-strip tomo-anim-item" style="animation-delay: 0.04s">
                <div class="kpi-card">
                    <div class="kpi-label">Total revenue</div>
                    <div class="kpi-value">
                        <span>{{ totals().revenue | number }}</span><span class="cur">MAD</span>
                    </div>
                    <div class="kpi-sub">{{ totals().count }} paid bookings</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Platform commission</div>
                    <div class="kpi-value">
                        <span>{{ totals().commission | number }}</span><span class="cur">MAD</span>
                    </div>
                    <div class="kpi-sub">Cumulative cut</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Net to agencies</div>
                    <div class="kpi-value">
                        <span>{{ totals().netAgencies | number }}</span><span class="cur">MAD</span>
                    </div>
                    <div class="kpi-sub">Owed across all hosts</div>
                </div>
            </div>

            <div class="filter-row tomo-anim-item" style="animation-delay: 0.06s">
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
                        placeholder="Paste a payment ID…"
                        [(ngModel)]="searchInputModel"
                        (ngModelChange)="onSearchChange($event)"
                        class="search-input"
                    />
                </p-iconfield>
            </div>

            <div class="table-card tomo-anim-item" style="animation-delay: 0.10s">
                <p-table
                    [value]="rows()"
                    [lazy]="true"
                    [paginator]="true"
                    [rows]="pageSize()"
                    [totalRecords]="total()"
                    [loading]="loading()"
                    (onLazyLoad)="onLazyLoad($event)"
                    [rowsPerPageOptions]="[20, 50, 100]"
                    dataKey="id"
                    styleClass="payments-table"
                    paginatorPosition="bottom"
                    currentPageReportTemplate="{first}–{last} of {totalRecords}"
                    [showCurrentPageReport]="true"
                >
                    <ng-template #header>
                        <tr>
                            <th class="col-ref">Payment</th>
                            <th class="col-booking">Booking</th>
                            <th class="col-amount">Amount</th>
                            <th class="col-commission">Commission</th>
                            <th class="col-net">Net to agency</th>
                            <th class="col-method">Method</th>
                            <th class="col-status">Status</th>
                            <th class="col-paid">Paid</th>
                        </tr>
                    </ng-template>

                    <ng-template #body let-p>
                        <tr>
                            <td class="col-ref">
                                <span class="ref">#{{ p.id.slice(0, 8) }}</span>
                            </td>
                            <td class="col-booking">
                                @if (p.reservation; as r) {
                                    <div class="booking-cell">
                                        <span class="booking-ref">#{{ r.id.slice(0, 8) }}</span>
                                        <div class="booking-meta">
                                            @if (r.user) {
                                                <span class="renter">{{ r.user.full_name || r.user.email }}</span>
                                            }
                                            @if (r.vehicle) {
                                                <span class="dot">·</span>
                                                <span>{{ r.vehicle.brand }} {{ r.vehicle.model }}</span>
                                            }
                                        </div>
                                    </div>
                                } @else {
                                    <span class="dim">— deleted</span>
                                }
                            </td>
                            <td class="col-amount mono-num">
                                {{ p.amount_total | number }} <span class="cur">MAD</span>
                            </td>
                            <td class="col-commission mono-num accent">
                                {{ p.agency_commission | number }} <span class="cur">MAD</span>
                            </td>
                            <td class="col-net mono-num">
                                {{ p.net_agency | number }} <span class="cur">MAD</span>
                            </td>
                            <td class="col-method">
                                <span class="method-tag">{{ p.method | titlecase }}</span>
                            </td>
                            <td class="col-status">
                                <span class="tomo-status" [ngClass]="statusClass(p.status)">{{ p.status }}</span>
                            </td>
                            <td class="col-paid dim-small">{{ formatRelative(p.paid_at) }}</td>
                        </tr>
                    </ng-template>

                    <ng-template #emptymessage>
                        <tr>
                            <td colspan="8">
                                <div class="empty">
                                    <div class="tomo-icon-badge is-orange is-lg">
                                        <i class="pi pi-wallet"></i>
                                    </div>
                                    @if (filter() !== 'all') {
                                        <h3>Nothing here</h3>
                                        <p>No payments match the "{{ activeFilterLabel() }}" filter.</p>
                                    } @else {
                                        <h3>No payments yet</h3>
                                        <p>Payments are written once at booking confirmation. Once the payment integration goes live, rows show up here.</p>
                                    }
                                </div>
                            </td>
                        </tr>
                    </ng-template>

                    <ng-template #loadingbody>
                        @for (_ of skeletonRows; track $index) {
                            <tr>
                                <td><div class="tomo-sk-line" style="width: 70px"></div></td>
                                <td><div class="tomo-sk-line" style="width: 80%"></div></td>
                                <td><div class="tomo-sk-line" style="width: 80px"></div></td>
                                <td><div class="tomo-sk-line" style="width: 80px"></div></td>
                                <td><div class="tomo-sk-line" style="width: 80px"></div></td>
                                <td><div class="tomo-sk-line" style="width: 60px"></div></td>
                                <td><div class="tomo-sk-pill" style="width: 60px"></div></td>
                                <td><div class="tomo-sk-line" style="width: 60px"></div></td>
                            </tr>
                        }
                    </ng-template>
                </p-table>
            </div>
        </div>
    `,
    styles: [
        `
            .payments-page {
                padding: 28px 28px 48px;
                max-width: 1500px;
            }
            .kpi-strip {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 14px;
                margin-bottom: 20px;
            }
            .kpi-card {
                background: var(--tomo-bg-card);
                border-radius: var(--tomo-radius-lg);
                box-shadow: var(--tomo-shadow-card);
                padding: 18px 20px;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .kpi-label {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                color: var(--tomo-text-muted);
            }
            .kpi-value {
                font-size: 24px;
                font-weight: 800;
                letter-spacing: -0.4px;
                color: var(--tomo-text-strong);
                display: flex;
                align-items: baseline;
                gap: 6px;
            }
            .kpi-value .cur {
                font-size: 12px;
                font-weight: 700;
                color: var(--tomo-text-muted);
            }
            .kpi-sub {
                font-size: 12px;
                color: var(--tomo-text-muted);
                margin-top: 2px;
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
                width: 280px;
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
            ::ng-deep .payments-table .p-datatable-table {
                font-size: 13px;
            }
            ::ng-deep .payments-table .p-datatable-thead > tr > th {
                background: transparent;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                color: var(--tomo-text-muted);
                border-bottom: 1px solid var(--tomo-divider);
                padding: 14px 12px;
            }
            ::ng-deep .payments-table .p-datatable-tbody > tr > td {
                padding: 12px;
                border-bottom: 1px solid var(--tomo-divider);
                color: var(--tomo-text);
                vertical-align: middle;
            }
            ::ng-deep .payments-table .p-paginator {
                background: transparent;
                border: 0;
                padding: 12px 16px;
                font-size: 12.5px;
                color: var(--tomo-text-muted);
            }
            .ref {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 11.5px;
                font-weight: 700;
                color: var(--tomo-primary);
            }
            .booking-cell {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .booking-ref {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 11.5px;
                font-weight: 700;
                color: var(--tomo-text);
            }
            .booking-meta {
                font-size: 11.5px;
                color: var(--tomo-text-muted);
            }
            .renter {
                color: var(--tomo-text-secondary);
                font-weight: 600;
            }
            .dot {
                margin: 0 4px;
                opacity: 0.4;
            }
            .mono-num {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 12.5px;
                font-weight: 700;
                color: var(--tomo-text-strong);
            }
            .mono-num.accent {
                color: var(--tomo-secondary);
            }
            .mono-num .cur {
                font-size: 10px;
                color: var(--tomo-text-muted);
                margin-left: 2px;
            }
            .method-tag {
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
            .dim {
                color: var(--tomo-text-faint);
                font-style: italic;
                font-size: 12px;
            }
            .dim-small {
                color: var(--tomo-text-muted);
                font-size: 11.5px;
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
                max-width: 380px;
                line-height: 1.5;
                margin: 0;
            }
            .empty .tomo-icon-badge {
                font-size: 24px;
            }
        `
    ]
})
export class Payments {
    private paymentsService = inject(PaymentsService);

    readonly filterOptions: FilterOption[] = [
        { key: 'all', label: 'All' },
        { key: 'paid', label: 'Paid' },
        { key: 'pending', label: 'Pending' },
        { key: 'refunded', label: 'Refunded' },
        { key: 'failed', label: 'Failed' }
    ];

    readonly skeletonRows = Array.from({ length: 6 });

    readonly rows = signal<PaymentRow[]>([]);
    readonly total = signal(0);
    readonly loading = signal(false);
    readonly page = signal(0);
    readonly pageSize = signal(50);
    readonly filter = signal<PaymentsFilter>('all');
    readonly search = signal('');

    readonly totals = signal({ revenue: 0, commission: 0, netAgencies: 0, count: 0 });

    searchInputModel = '';
    private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    readonly activeFilterLabel = computed(
        () => this.filterOptions.find((o) => o.key === this.filter())?.label ?? ''
    );

    constructor() {
        void this.loadTotals();
    }

    async onLazyLoad(event: TableLazyLoadEvent): Promise<void> {
        const first = event.first ?? 0;
        const rows = event.rows ?? this.pageSize();
        this.page.set(Math.floor(first / rows));
        this.pageSize.set(rows);
        await this.load();
    }

    setFilter(filter: PaymentsFilter): void {
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
        const { rows, total } = await this.paymentsService.list({
            page: this.page(),
            pageSize: this.pageSize(),
            filter: this.filter(),
            search: this.search()
        });
        this.rows.set(rows);
        this.total.set(total);
        this.loading.set(false);
    }

    private async loadTotals(): Promise<void> {
        const t = await this.paymentsService.totals();
        this.totals.set(t);
    }

    statusClass(status: string): string {
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
        return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
}
