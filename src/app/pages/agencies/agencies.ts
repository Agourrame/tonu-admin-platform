import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { AgenciesService, AgenciesFilter, AgencyRow } from '@/services/agencies.service';
import { AgencyDetailDrawer } from './agency-detail-drawer';

interface FilterOption {
    key: AgenciesFilter;
    label: string;
}

@Component({
    selector: 'app-agencies',
    standalone: true,
    imports: [CommonModule, FormsModule, TableModule, IconFieldModule, InputIconModule, InputTextModule, ButtonModule, AgencyDetailDrawer],
    template: `
        <div class="agencies-page">
            <div class="tomo-page-titlebar tomo-anim-item">
                <span class="tomo-eyebrow">People</span>
                <h1 class="tomo-h1">Agencies</h1>
                <p class="tomo-sub">Rental companies hosting fleets. Approve applications and verify KYC dossiers — vehicles only appear in the marketplace once both passes are green.</p>
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
                        placeholder="Search by name, city, or slug…"
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
                    styleClass="agencies-table"
                    paginatorPosition="bottom"
                    currentPageReportTemplate="{first}–{last} of {totalRecords}"
                    [showCurrentPageReport]="true"
                >
                    <ng-template #header>
                        <tr>
                            <th class="col-agency">Agency</th>
                            <th class="col-owner">Owner</th>
                            <th class="col-status">Status</th>
                            <th class="col-verif">KYC</th>
                            <th class="col-plan">Plan</th>
                        </tr>
                    </ng-template>

                    <ng-template #body let-a>
                        <tr [class.is-selected]="selectedAgency()?.id === a.id" (click)="onRowSelect(a)">
                            <td class="col-agency">
                                <div class="agency-cell">
                                    @if (a.logo_url) {
                                        <img class="logo" [src]="a.logo_url" [alt]="a.name" />
                                    } @else {
                                        <div class="logo logo-fallback">{{ initialsOf(a.name) }}</div>
                                    }
                                    <div class="agency-meta">
                                        <div class="agency-name">{{ a.name }}</div>
                                        <div class="agency-sub">
                                            @if (a.city) {
                                                <i class="pi pi-map-marker"></i> {{ a.city }} ·
                                            }
                                            <span class="slug">{{ a.slug }}</span>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td class="col-owner">
                                @if (a.owner) {
                                    <div class="owner-cell">
                                        <div class="owner-name">{{ a.owner.full_name || '—' }}</div>
                                        <div class="owner-email">{{ a.owner.email }}</div>
                                    </div>
                                } @else {
                                    <span class="dim">—</span>
                                }
                            </td>
                            <td class="col-status">
                                <span class="tomo-status" [ngClass]="statusClass(a.status)">
                                    {{ a.status }}
                                </span>
                            </td>
                            <td class="col-verif">
                                <span class="tomo-status" [ngClass]="verifClass(a.verification_status)">
                                    {{ a.verification_status }}
                                </span>
                            </td>
                            <td class="col-plan">
                                @if (a.plan_code) {
                                    <span class="plan-tag">{{ a.plan_code }}</span>
                                    @if (a.custom_commission !== null && a.custom_commission !== undefined) {
                                        <span class="custom-commission" title="Overridden commission">{{ a.custom_commission }}%</span>
                                    }
                                } @else {
                                    <span class="dim">no plan</span>
                                }
                            </td>
                        </tr>
                    </ng-template>

                    <ng-template #emptymessage>
                        <tr>
                            <td colspan="5">
                                <div class="empty">
                                    <div class="tomo-icon-badge is-orange is-lg">
                                        <i class="pi pi-building"></i>
                                    </div>
                                    @if (search()) {
                                        <h3>No matches</h3>
                                        <p>No agencies match "{{ search() }}". Try a different search term.</p>
                                    } @else if (filter() !== 'all') {
                                        <h3>Nothing here</h3>
                                        <p>No agencies match the "{{ activeFilterLabel() }}" filter.</p>
                                    } @else {
                                        <h3>No agencies yet</h3>
                                        <p>Once renters become hosts, their agency applications land here for review.</p>
                                    }
                                </div>
                            </td>
                        </tr>
                    </ng-template>

                    <ng-template #loadingbody>
                        @for (_ of skeletonRows; track $index) {
                            <tr>
                                <td><div class="tomo-sk-line" style="width: 80%"></div></td>
                                <td><div class="tomo-sk-line" style="width: 70%"></div></td>
                                <td><div class="tomo-sk-pill" style="width: 70px"></div></td>
                                <td><div class="tomo-sk-pill" style="width: 70px"></div></td>
                                <td><div class="tomo-sk-line" style="width: 50px"></div></td>
                            </tr>
                        }
                    </ng-template>
                </p-table>
            </div>
        </div>

        <app-agency-detail-drawer
            [agency]="selectedAgency()"
            (close)="closeDrawer()"
            (changed)="reloadCurrent()"
        />
    `,
    styles: [
        `
            .agencies-page {
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
            ::ng-deep .agencies-table .p-datatable-table {
                font-size: 13.5px;
            }
            ::ng-deep .agencies-table .p-datatable-thead > tr > th {
                background: transparent;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                color: var(--tomo-text-muted);
                border-bottom: 1px solid var(--tomo-divider);
                padding: 14px 16px;
            }
            ::ng-deep .agencies-table .p-datatable-tbody > tr > td {
                padding: 14px 16px;
                border-bottom: 1px solid var(--tomo-divider);
                color: var(--tomo-text);
                vertical-align: middle;
            }
            ::ng-deep .agencies-table .p-datatable-tbody > tr {
                cursor: pointer;
                transition: background 160ms ease;
            }
            ::ng-deep .agencies-table .p-datatable-tbody > tr:hover {
                background: var(--tomo-bg-soft);
            }
            ::ng-deep .agencies-table .p-datatable-tbody > tr.is-selected {
                background: rgba(36, 40, 48, 0.04);
            }
            ::ng-deep .agencies-table .p-paginator {
                background: transparent;
                border: 0;
                padding: 12px 16px;
                font-size: 12.5px;
                color: var(--tomo-text-muted);
            }
            .agency-cell {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .logo {
                width: 40px;
                height: 40px;
                border-radius: 10px;
                object-fit: cover;
                background: var(--tomo-bg-soft);
                flex-shrink: 0;
            }
            .logo-fallback {
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(36, 40, 48, 0.06);
                color: var(--tomo-primary);
                font-size: 13px;
                font-weight: 800;
                letter-spacing: 0.4px;
            }
            .agency-meta {
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .agency-name {
                font-size: 13.5px;
                font-weight: 700;
                color: var(--tomo-text-strong);
            }
            .agency-sub {
                font-size: 12px;
                color: var(--tomo-text-muted);
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .agency-sub i {
                font-size: 11px;
            }
            .slug {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 11px;
            }
            .owner-cell {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .owner-name {
                font-size: 13px;
                font-weight: 600;
                color: var(--tomo-text);
            }
            .owner-email {
                font-size: 11.5px;
                color: var(--tomo-text-muted);
            }
            .plan-tag {
                display: inline-flex;
                align-items: center;
                padding: 0 10px;
                height: 22px;
                border-radius: var(--tomo-radius-pill);
                background: rgba(226, 122, 52, 0.12);
                color: var(--tomo-secondary);
                font-size: 11px;
                font-weight: 700;
                text-transform: capitalize;
            }
            .custom-commission {
                margin-left: 6px;
                font-size: 11px;
                font-weight: 700;
                color: var(--tomo-text-secondary);
            }
            .dim {
                color: var(--tomo-text-faint);
                font-weight: 500;
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
export class Agencies {
    private agenciesService = inject(AgenciesService);

    readonly filterOptions: FilterOption[] = [
        { key: 'all', label: 'All' },
        { key: 'pending_review', label: 'Pending review' },
        { key: 'active', label: 'Active' },
        { key: 'suspended', label: 'Suspended' },
        { key: 'rejected', label: 'Rejected' },
        { key: 'pending_kyc', label: 'Pending KYC' },
        { key: 'verified_kyc', label: 'Verified' }
    ];

    readonly skeletonRows = Array.from({ length: 6 });

    readonly rows = signal<AgencyRow[]>([]);
    readonly total = signal(0);
    readonly loading = signal(false);
    readonly page = signal(0);
    readonly pageSize = signal(50);
    readonly filter = signal<AgenciesFilter>('all');
    readonly search = signal('');

    readonly selectedAgency = signal<AgencyRow | null>(null);

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

    setFilter(filter: AgenciesFilter): void {
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
        const { rows, total } = await this.agenciesService.list({
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
        const cur = this.selectedAgency();
        if (!cur) return;
        // Re-fetch the FULL row (with owner) so the table column stays right.
        const { rows } = await this.agenciesService.list({
            page: 0,
            pageSize: 1,
            search: cur.slug
        });
        const fresh = rows.find((r) => r.id === cur.id);
        if (fresh) {
            this.selectedAgency.set(fresh);
            this.rows.update((list) => list.map((a) => (a.id === fresh.id ? fresh : a)));
        }
    }

    onRowSelect(agency: AgencyRow | null): void {
        this.selectedAgency.set(agency);
    }

    closeDrawer(): void {
        this.selectedAgency.set(null);
    }

    initialsOf(name: string): string {
        const parts = (name ?? '').split(/\s+/).filter(Boolean);
        if (!parts.length) return '?';
        if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
        return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
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
}
