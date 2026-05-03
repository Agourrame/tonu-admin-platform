import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService } from 'primeng/api';
import { ReviewsFilter, ReviewsService, ReviewRow } from '@/services/reviews.service';

interface FilterOption {
    key: ReviewsFilter;
    label: string;
}

@Component({
    selector: 'app-reviews',
    standalone: true,
    imports: [CommonModule, FormsModule, TableModule, ButtonModule, ToggleSwitchModule, ConfirmDialogModule, DialogModule],
    providers: [ConfirmationService],
    template: `
        <div class="reviews-page">
            <div class="tomo-page-titlebar tomo-anim-item">
                <span class="tomo-eyebrow">Marketplace</span>
                <h1 class="tomo-h1">Reviews</h1>
                <p class="tomo-sub">Both directions — renters reviewing agencies/vehicles and agencies reviewing renters. Toggle visibility to hide abusive content; delete sparingly.</p>
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
                    styleClass="reviews-table"
                    paginatorPosition="bottom"
                    currentPageReportTemplate="{first}–{last} of {totalRecords}"
                    [showCurrentPageReport]="true"
                >
                    <ng-template #header>
                        <tr>
                            <th class="col-reviewer">Reviewer</th>
                            <th class="col-direction">Direction</th>
                            <th class="col-rating">Rating</th>
                            <th class="col-comment">Comment</th>
                            <th class="col-visible">Visible</th>
                            <th class="col-actions"></th>
                        </tr>
                    </ng-template>

                    <ng-template #body let-r>
                        <tr [class.is-hidden]="!r.is_visible" (click)="openComment(r)">
                            <td class="col-reviewer">
                                <div class="reviewer-cell">
                                    <div class="avatar" [class.is-agency]="r.reviewer_type === 'agency'">
                                        @if (r.reviewer_type === 'user') {
                                            {{ initialsOfUser(r) }}
                                        } @else {
                                            <i class="pi pi-building"></i>
                                        }
                                    </div>
                                    <div class="reviewer-meta">
                                        <div class="reviewer-name">{{ reviewerName(r) }}</div>
                                        <div class="reviewer-sub">
                                            {{ r.reviewer_type === 'user' ? 'Renter' : 'Agency' }}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td class="col-direction">
                                <div class="direction">
                                    <span class="dir-arrow"><i class="pi pi-arrow-right"></i></span>
                                    <span class="dir-target">{{ targetLabel(r) }}</span>
                                </div>
                            </td>
                            <td class="col-rating">
                                <div class="rating">
                                    @for (i of starsOf(r.rating); track $index) {
                                        <i class="pi pi-star-fill" [class.gold]="i" [class.empty]="!i"></i>
                                    }
                                    <span class="rating-num">{{ r.rating }}</span>
                                </div>
                            </td>
                            <td class="col-comment">
                                @if (r.comment) {
                                    <span class="comment-preview">{{ truncate(r.comment, 80) }}</span>
                                } @else {
                                    <span class="dim">No comment</span>
                                }
                            </td>
                            <td class="col-visible" (click)="$event.stopPropagation()">
                                <p-toggleswitch
                                    [ngModel]="r.is_visible"
                                    (ngModelChange)="onToggleVisibility(r, $event)"
                                    [disabled]="busyId() === r.id"
                                />
                            </td>
                            <td class="col-actions" (click)="$event.stopPropagation()">
                                <button
                                    class="icon-btn danger"
                                    type="button"
                                    (click)="confirmDelete(r)"
                                    aria-label="Delete review"
                                >
                                    <i class="pi pi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    </ng-template>

                    <ng-template #emptymessage>
                        <tr>
                            <td colspan="6">
                                <div class="empty">
                                    <div class="tomo-icon-badge is-orange is-lg">
                                        <i class="pi pi-star"></i>
                                    </div>
                                    @if (filter() !== 'all') {
                                        <h3>Nothing here</h3>
                                        <p>No reviews match the "{{ activeFilterLabel() }}" filter.</p>
                                    } @else {
                                        <h3>No reviews yet</h3>
                                        <p>After completed bookings, both renters and agencies can rate each other. Reviews land here.</p>
                                    }
                                </div>
                            </td>
                        </tr>
                    </ng-template>

                    <ng-template #loadingbody>
                        @for (_ of skeletonRows; track $index) {
                            <tr>
                                <td><div class="tomo-sk-line" style="width: 70%"></div></td>
                                <td><div class="tomo-sk-line" style="width: 60%"></div></td>
                                <td><div class="tomo-sk-line" style="width: 80px"></div></td>
                                <td><div class="tomo-sk-line" style="width: 90%"></div></td>
                                <td><div class="tomo-sk-pill" style="width: 36px; height: 20px"></div></td>
                                <td></td>
                            </tr>
                        }
                    </ng-template>
                </p-table>
            </div>
        </div>

        <!-- Comment / context modal -->
        <p-dialog
            [visible]="commentModalOpen()"
            (onHide)="closeCommentModal()"
            [header]="'Review #' + (currentReview()?.id?.slice(0, 8) ?? '')"
            [modal]="true"
            [style]="{ width: '520px' }"
            [closable]="true"
            [draggable]="false"
            [resizable]="false"
        >
            @if (currentReview(); as r) {
                <div class="modal-content">
                    <div class="modal-meta">
                        <span class="reviewer-name">{{ reviewerName(r) }}</span>
                        <span class="dim-small">→ {{ targetLabel(r) }}</span>
                    </div>
                    <div class="modal-rating">
                        @for (i of starsOf(r.rating); track $index) {
                            <i class="pi pi-star-fill" [class.gold]="i" [class.empty]="!i"></i>
                        }
                        <span class="rating-num">{{ r.rating }} / 5</span>
                    </div>
                    <div class="modal-comment">
                        @if (r.comment) {
                            {{ r.comment }}
                        } @else {
                            <span class="dim">No comment provided.</span>
                        }
                    </div>
                    @if (r.reservation; as res) {
                        <div class="modal-context">
                            <span class="dim-small">Booking</span>
                            <span class="mono">#{{ res.id.slice(0, 8) }}</span>
                            @if (res.vehicle) {
                                <span class="dim-small">·</span>
                                <span>{{ res.vehicle.brand }} {{ res.vehicle.model }}</span>
                            }
                        </div>
                    }
                    <div class="modal-time dim-small">{{ formatRelative(r.created_at) }}</div>
                </div>
            }
        </p-dialog>

        <p-confirmdialog />
    `,
    styles: [
        `
            .reviews-page {
                padding: 28px 28px 48px;
                max-width: 1400px;
            }
            .filter-row {
                margin-bottom: 18px;
            }
            .chips {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            .table-card {
                background: var(--tomo-bg-card);
                border-radius: var(--tomo-radius-lg);
                box-shadow: var(--tomo-shadow-card);
                overflow: hidden;
            }
            ::ng-deep .reviews-table .p-datatable-table {
                font-size: 13.5px;
            }
            ::ng-deep .reviews-table .p-datatable-thead > tr > th {
                background: transparent;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                color: var(--tomo-text-muted);
                border-bottom: 1px solid var(--tomo-divider);
                padding: 14px 16px;
            }
            ::ng-deep .reviews-table .p-datatable-tbody > tr > td {
                padding: 14px 16px;
                border-bottom: 1px solid var(--tomo-divider);
                color: var(--tomo-text);
                vertical-align: middle;
            }
            ::ng-deep .reviews-table .p-datatable-tbody > tr {
                cursor: pointer;
                transition: background 160ms ease;
            }
            ::ng-deep .reviews-table .p-datatable-tbody > tr:hover {
                background: var(--tomo-bg-soft);
            }
            ::ng-deep .reviews-table .p-datatable-tbody > tr.is-hidden {
                opacity: 0.5;
            }
            ::ng-deep .reviews-table .p-paginator {
                background: transparent;
                border: 0;
                padding: 12px 16px;
                font-size: 12.5px;
                color: var(--tomo-text-muted);
            }
            .reviewer-cell {
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
            .avatar.is-agency {
                background: rgba(226, 122, 52, 0.12);
                color: var(--tomo-secondary);
                border-radius: 8px;
            }
            .avatar.is-agency i {
                font-size: 13px;
            }
            .reviewer-name {
                font-size: 13px;
                font-weight: 700;
                color: var(--tomo-text-strong);
            }
            .reviewer-sub {
                font-size: 11.5px;
                color: var(--tomo-text-muted);
            }
            .direction {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12.5px;
                color: var(--tomo-text-secondary);
                font-weight: 500;
            }
            .direction .dir-arrow i {
                font-size: 10px;
                color: var(--tomo-text-faint);
            }
            .dir-target {
                font-weight: 700;
                color: var(--tomo-text);
                text-transform: capitalize;
            }
            .rating {
                display: inline-flex;
                align-items: center;
                gap: 2px;
            }
            .rating i {
                font-size: 11px;
            }
            .rating i.gold {
                color: var(--tomo-gold);
            }
            .rating i.empty {
                color: rgba(0, 0, 0, 0.1);
            }
            .rating-num {
                font-size: 11.5px;
                font-weight: 700;
                color: var(--tomo-text-strong);
                margin-left: 4px;
            }
            .comment-preview {
                font-size: 12.5px;
                color: var(--tomo-text);
                line-height: 1.5;
            }
            .icon-btn {
                background: none;
                border: 0;
                padding: 8px;
                border-radius: 8px;
                cursor: pointer;
                color: var(--tomo-text-muted);
                transition: background 160ms ease, color 160ms ease;
            }
            .icon-btn i {
                font-size: 14px;
            }
            .icon-btn.danger:hover {
                background: rgba(229, 57, 53, 0.08);
                color: var(--tomo-danger);
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
                max-width: 360px;
                line-height: 1.5;
                margin: 0;
            }
            .empty .tomo-icon-badge {
                font-size: 24px;
            }

            /* Modal */
            .modal-content {
                display: flex;
                flex-direction: column;
                gap: 14px;
            }
            .modal-meta {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            .modal-meta .reviewer-name {
                font-size: 14px;
                font-weight: 700;
                color: var(--tomo-text-strong);
            }
            .modal-rating {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .modal-rating i {
                font-size: 16px;
            }
            .modal-rating i.gold {
                color: var(--tomo-gold);
            }
            .modal-rating i.empty {
                color: rgba(0, 0, 0, 0.1);
            }
            .modal-rating .rating-num {
                font-size: 13px;
                font-weight: 700;
                color: var(--tomo-text-strong);
                margin-left: 6px;
            }
            .modal-comment {
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
                padding: 14px 16px;
                font-size: 14px;
                line-height: 1.6;
                color: var(--tomo-text);
                white-space: pre-wrap;
            }
            .modal-context {
                display: flex;
                align-items: center;
                gap: 6px;
                padding-top: 8px;
                border-top: 1px solid var(--tomo-divider);
                font-size: 12.5px;
                color: var(--tomo-text-secondary);
            }
            .mono {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 11.5px;
                font-weight: 700;
                color: var(--tomo-primary);
            }
            .modal-time {
                margin-top: -4px;
            }
        `
    ]
})
export class Reviews {
    private reviewsService = inject(ReviewsService);
    private confirmationService = inject(ConfirmationService);

    readonly filterOptions: FilterOption[] = [
        { key: 'all', label: 'All' },
        { key: 'visible', label: 'Visible' },
        { key: 'hidden', label: 'Hidden' },
        { key: 'low', label: 'Low rated (≤2★)' },
        { key: 'user_to_x', label: 'From renters' },
        { key: 'agency_to_x', label: 'From agencies' }
    ];

    readonly skeletonRows = Array.from({ length: 6 });

    readonly rows = signal<ReviewRow[]>([]);
    readonly total = signal(0);
    readonly loading = signal(false);
    readonly page = signal(0);
    readonly pageSize = signal(50);
    readonly filter = signal<ReviewsFilter>('all');

    readonly busyId = signal<string | null>(null);

    readonly commentModalOpen = signal(false);
    readonly currentReview = signal<ReviewRow | null>(null);

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

    setFilter(filter: ReviewsFilter): void {
        if (this.filter() === filter) return;
        this.filter.set(filter);
        this.page.set(0);
        void this.load();
    }

    private async load(): Promise<void> {
        this.loading.set(true);
        const { rows, total } = await this.reviewsService.list({
            page: this.page(),
            pageSize: this.pageSize(),
            filter: this.filter()
        });
        this.rows.set(rows);
        this.total.set(total);
        this.loading.set(false);
    }

    async onToggleVisibility(review: ReviewRow, next: boolean): Promise<void> {
        if (this.busyId()) return;
        this.busyId.set(review.id);
        const ok = await this.reviewsService.setVisibility(review.id, next);
        this.busyId.set(null);
        if (ok) {
            this.rows.update((list) => list.map((r) => (r.id === review.id ? { ...r, is_visible: next } : r)));
        }
    }

    confirmDelete(review: ReviewRow): void {
        this.confirmationService.confirm({
            header: 'Delete review',
            message: `Permanently delete this ${review.rating}★ review by <strong>${this.reviewerName(review)}</strong>? Toggling visibility off is usually preferred — delete only for spam or content that violates platform rules.`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Delete',
            acceptButtonProps: { severity: 'danger' },
            rejectLabel: 'Cancel',
            rejectButtonProps: { severity: 'secondary', text: true },
            accept: async () => {
                const ok = await this.reviewsService.remove(review.id);
                if (ok) {
                    this.rows.update((list) => list.filter((r) => r.id !== review.id));
                    this.total.update((n) => Math.max(0, n - 1));
                }
            }
        });
    }

    openComment(review: ReviewRow): void {
        this.currentReview.set(review);
        this.commentModalOpen.set(true);
    }

    closeCommentModal(): void {
        this.commentModalOpen.set(false);
    }

    // ----- helpers -----

    reviewerName(r: ReviewRow): string {
        if (r.reviewer_type === 'user') return r.user_reviewer?.full_name ?? r.user_reviewer?.email ?? '—';
        return r.agency_reviewer?.name ?? '—';
    }

    initialsOfUser(r: ReviewRow): string {
        const u = r.user_reviewer;
        if (!u) return '?';
        const name = u.full_name?.trim();
        if (!name) return (u.email?.[0] ?? '?').toUpperCase();
        const parts = name.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
        return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }

    targetLabel(r: ReviewRow): string {
        // target_type tells us what's being reviewed; the actual record is
        // implicit in the linked reservation (vehicle / agency / renter).
        const res = r.reservation;
        switch (r.target_type) {
            case 'vehicle':
                return res?.vehicle ? `${res.vehicle.brand} ${res.vehicle.model}` : 'vehicle';
            case 'agency':
                return res?.vehicle?.agency?.name ?? 'agency';
            case 'user':
                return res?.user?.full_name ?? 'renter';
            default:
                return r.target_type;
        }
    }

    starsOf(rating: number): boolean[] {
        const r = Math.max(0, Math.min(5, Math.round(rating)));
        return [0, 1, 2, 3, 4].map((i) => i < r);
    }

    truncate(s: string, n: number): string {
        if (s.length <= n) return s;
        return s.slice(0, n).trimEnd() + '…';
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
