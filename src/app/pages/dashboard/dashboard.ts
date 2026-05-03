import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
    AttentionCounts,
    DashboardKpis,
    DashboardService,
    RecentAgency,
    RecentReservation,
    RecentReview,
    RecentUser
} from '@/services/dashboard.service';

interface KpiTile {
    label: string;
    big: number;
    suffix?: string;
    breakdown?: { label: string; value: number; tone: 'good' | 'warn' | 'muted' }[];
}

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, TitleCasePipe, RouterLink],
    template: `
        <div class="dash-page">
            <div class="tomo-page-titlebar tomo-anim-item">
                <span class="tomo-eyebrow">Overview</span>
                <h1 class="tomo-h1">Dashboard</h1>
                <p class="tomo-sub">Live signal across the marketplace — verification queues, ops, finance, and what just happened.</p>
            </div>

            <!-- KPI strip -->
            <div class="kpi-strip tomo-anim-stagger">
                @for (tile of kpiTiles(); track tile.label) {
                    <div class="kpi-tile">
                        <div class="kpi-label">{{ tile.label }}</div>
                        <div class="kpi-big">
                            <span class="kpi-num">{{ tile.big | number }}</span>
                            @if (tile.suffix) {
                                <span class="kpi-suffix">{{ tile.suffix }}</span>
                            }
                        </div>
                        @if (tile.breakdown?.length) {
                            <div class="kpi-breakdown">
                                @for (b of tile.breakdown; track b.label) {
                                    <span class="kpi-bk" [ngClass]="'tone-' + b.tone">
                                        <strong>{{ b.value | number }}</strong> {{ b.label }}
                                    </span>
                                }
                            </div>
                        }
                    </div>
                }
            </div>

            <!-- Needs attention -->
            <div class="section-head tomo-anim-item" style="animation-delay: 0.20s">
                <span class="tomo-field-label">Needs attention</span>
            </div>
            @if (totalAttention() === 0 && !loadingAttention()) {
                <div class="all-clear tomo-anim-item" style="animation-delay: 0.22s">
                    <i class="pi pi-check-circle"></i>
                    <span>Inbox zero — no pending verifications right now.</span>
                </div>
            } @else {
                <div class="attention-grid tomo-anim-stagger">
                    @if (attention().usersPendingKyc > 0 || loadingAttention()) {
                        <a class="attention-card" routerLink="/users" [queryParams]="{ filter: 'pending' }">
                            <div class="tomo-icon-badge is-orange is-lg">
                                <i class="pi pi-id-card"></i>
                            </div>
                            <div class="att-body">
                                <div class="att-num">{{ attention().usersPendingKyc | number }}</div>
                                <div class="att-label">user{{ attention().usersPendingKyc === 1 ? '' : 's' }} pending KYC</div>
                                <div class="att-cta">Review identity dossiers <i class="pi pi-arrow-right"></i></div>
                            </div>
                        </a>
                    }
                    @if (attention().agenciesPendingReview > 0 || loadingAttention()) {
                        <a class="attention-card" routerLink="/agencies" [queryParams]="{ filter: 'pending_review' }">
                            <div class="tomo-icon-badge is-blue is-lg">
                                <i class="pi pi-building"></i>
                            </div>
                            <div class="att-body">
                                <div class="att-num">{{ attention().agenciesPendingReview | number }}</div>
                                <div class="att-label">agenc{{ attention().agenciesPendingReview === 1 ? 'y' : 'ies' }} pending review</div>
                                <div class="att-cta">Approve applications <i class="pi pi-arrow-right"></i></div>
                            </div>
                        </a>
                    }
                    @if (attention().agenciesPendingKyc > 0 || loadingAttention()) {
                        <a class="attention-card" routerLink="/agencies" [queryParams]="{ filter: 'pending_kyc' }">
                            <div class="tomo-icon-badge is-green is-lg">
                                <i class="pi pi-shield"></i>
                            </div>
                            <div class="att-body">
                                <div class="att-num">{{ attention().agenciesPendingKyc | number }}</div>
                                <div class="att-label">KYC dossier{{ attention().agenciesPendingKyc === 1 ? '' : 's' }} awaiting</div>
                                <div class="att-cta">Verify business docs <i class="pi pi-arrow-right"></i></div>
                            </div>
                        </a>
                    }
                </div>
            }

            <!-- Recent activity -->
            <div class="recent-grid">
                <!-- Recent reservations -->
                <section class="recent-card tomo-anim-item" style="animation-delay: 0.30s">
                    <div class="recent-head">
                        <span class="tomo-field-label">Latest reservations</span>
                        <a routerLink="/reservations" class="see-all">See all <i class="pi pi-arrow-right"></i></a>
                    </div>
                    @if (loadingRecent()) {
                        @for (_ of skeletonItems; track $index) {
                            <div class="recent-row">
                                <div class="tomo-sk-line" style="width: 70%"></div>
                                <div class="tomo-sk-line" style="width: 40%; margin-top: 6px"></div>
                            </div>
                        }
                    } @else if (recentReservations().length === 0) {
                        <div class="recent-empty">No reservations yet.</div>
                    } @else {
                        @for (r of recentReservations(); track r.id) {
                            <div class="recent-row">
                                <div class="recent-row-main">
                                    <span class="ref">#{{ r.id.slice(0, 8) }}</span>
                                    <span class="tomo-status" [ngClass]="resStatusClass(r.status)">{{ r.status }}</span>
                                </div>
                                <div class="recent-row-meta">
                                    @if (r.user) {
                                        <span class="strong">{{ r.user.full_name || r.user.email }}</span>
                                    }
                                    @if (r.vehicle) {
                                        <span class="dim">·</span>
                                        <span>{{ r.vehicle.brand }} {{ r.vehicle.model }}</span>
                                    }
                                </div>
                                <div class="recent-row-time">{{ formatRelative(r.created_at) }}</div>
                            </div>
                        }
                    }
                </section>

                <!-- Recent reviews -->
                <section class="recent-card tomo-anim-item" style="animation-delay: 0.34s">
                    <div class="recent-head">
                        <span class="tomo-field-label">Latest reviews</span>
                        <a routerLink="/reviews" class="see-all">See all <i class="pi pi-arrow-right"></i></a>
                    </div>
                    @if (loadingRecent()) {
                        @for (_ of skeletonItems; track $index) {
                            <div class="recent-row">
                                <div class="tomo-sk-line" style="width: 60%"></div>
                                <div class="tomo-sk-line" style="width: 80%; margin-top: 6px"></div>
                            </div>
                        }
                    } @else if (recentReviews().length === 0) {
                        <div class="recent-empty">No reviews yet.</div>
                    } @else {
                        @for (rev of recentReviews(); track rev.id) {
                            <div class="recent-row">
                                <div class="recent-row-main">
                                    <span class="rating">
                                        @for (i of starsOf(rev.rating); track $index) {
                                            <i class="pi pi-star-fill" [class.gold]="i" [class.empty]="!i"></i>
                                        }
                                    </span>
                                    <span class="dim-small">{{ rev.reviewer_type | titlecase }} → {{ rev.target_type | titlecase }}</span>
                                </div>
                                @if (rev.comment) {
                                    <div class="recent-row-comment">{{ truncate(rev.comment, 120) }}</div>
                                }
                                <div class="recent-row-time">{{ formatRelative(rev.created_at) }}</div>
                            </div>
                        }
                    }
                </section>

                <!-- Recent users -->
                <section class="recent-card tomo-anim-item" style="animation-delay: 0.38s">
                    <div class="recent-head">
                        <span class="tomo-field-label">New users</span>
                        <a routerLink="/users" class="see-all">See all <i class="pi pi-arrow-right"></i></a>
                    </div>
                    @if (loadingRecent()) {
                        @for (_ of skeletonItems; track $index) {
                            <div class="recent-row">
                                <div class="tomo-sk-line" style="width: 60%"></div>
                                <div class="tomo-sk-line" style="width: 80%; margin-top: 6px"></div>
                            </div>
                        }
                    } @else if (recentUsers().length === 0) {
                        <div class="recent-empty">No users yet.</div>
                    } @else {
                        @for (u of recentUsers(); track u.id) {
                            <div class="recent-row user-row">
                                <div class="avatar">{{ initialsOf(u.full_name, u.email) }}</div>
                                <div class="user-info">
                                    <div class="strong">{{ u.full_name || u.email }}</div>
                                    <div class="dim-small">{{ u.email }}</div>
                                </div>
                                <span class="tomo-status" [ngClass]="kycClass(u.verification_status)">{{ u.verification_status }}</span>
                            </div>
                        }
                    }
                </section>

                <!-- Recent agencies -->
                <section class="recent-card tomo-anim-item" style="animation-delay: 0.42s">
                    <div class="recent-head">
                        <span class="tomo-field-label">Latest agency applications</span>
                        <a routerLink="/agencies" class="see-all">See all <i class="pi pi-arrow-right"></i></a>
                    </div>
                    @if (loadingRecent()) {
                        @for (_ of skeletonItems; track $index) {
                            <div class="recent-row">
                                <div class="tomo-sk-line" style="width: 60%"></div>
                                <div class="tomo-sk-line" style="width: 50%; margin-top: 6px"></div>
                            </div>
                        }
                    } @else if (recentAgencies().length === 0) {
                        <div class="recent-empty">No agencies yet.</div>
                    } @else {
                        @for (ag of recentAgencies(); track ag.id) {
                            <div class="recent-row agency-row">
                                <div class="agency-info">
                                    <div class="strong">{{ ag.name }}</div>
                                    <div class="dim-small">
                                        @if (ag.city) {
                                            {{ ag.city }} ·
                                        }
                                        /{{ ag.slug }}
                                    </div>
                                </div>
                                <div class="agency-pills">
                                    <span class="tomo-status" [ngClass]="opStatusClass(ag.status)">{{ ag.status }}</span>
                                    <span class="tomo-status" [ngClass]="kycClass(ag.verification_status)">{{ ag.verification_status }}</span>
                                </div>
                            </div>
                        }
                    }
                </section>
            </div>
        </div>
    `,
    styles: [
        `
            .dash-page {
                padding: 28px 28px 48px;
                max-width: 1400px;
            }

            /* KPI strip */
            .kpi-strip {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 14px;
                margin-bottom: 28px;
            }
            .kpi-tile {
                background: var(--tomo-bg-card);
                border-radius: var(--tomo-radius-lg);
                box-shadow: var(--tomo-shadow-card);
                padding: 18px 20px;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .kpi-label {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.7px;
                color: var(--tomo-text-muted);
            }
            .kpi-big {
                display: flex;
                align-items: baseline;
                gap: 6px;
            }
            .kpi-num {
                font-size: 28px;
                font-weight: 800;
                letter-spacing: -0.4px;
                color: var(--tomo-text-strong);
                line-height: 1;
            }
            .kpi-suffix {
                font-size: 12.5px;
                font-weight: 700;
                color: var(--tomo-text-muted);
            }
            .kpi-breakdown {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                margin-top: 4px;
                font-size: 12px;
                font-weight: 500;
            }
            .kpi-bk {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                color: var(--tomo-text-muted);
            }
            .kpi-bk strong {
                font-weight: 800;
            }
            .kpi-bk.tone-good strong {
                color: var(--tomo-success);
            }
            .kpi-bk.tone-warn strong {
                color: var(--tomo-warning);
            }
            .kpi-bk.tone-muted strong {
                color: var(--tomo-text-secondary);
            }

            /* Attention */
            .section-head {
                margin-bottom: 12px;
            }
            .all-clear {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 16px 20px;
                background: rgba(26, 170, 85, 0.08);
                color: var(--tomo-success);
                border-radius: var(--tomo-radius-lg);
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 28px;
            }
            .all-clear i {
                font-size: 16px;
            }
            .attention-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
                gap: 14px;
                margin-bottom: 28px;
            }
            .attention-card {
                display: flex;
                gap: 14px;
                align-items: center;
                padding: 18px 20px;
                background: var(--tomo-bg-card);
                border-radius: var(--tomo-radius-lg);
                box-shadow: var(--tomo-shadow-card);
                text-decoration: none;
                color: inherit;
                transition: transform 200ms ease, box-shadow 200ms ease;
            }
            .attention-card:hover {
                transform: translateY(-1px);
                box-shadow:
                    rgba(0, 0, 0, 0.04) 0px 4px 12px 0px,
                    rgba(27, 31, 35, 0.14) 0px 0px 0px 1px;
            }
            .att-body {
                flex: 1;
                min-width: 0;
            }
            .att-num {
                font-size: 22px;
                font-weight: 800;
                letter-spacing: -0.3px;
                color: var(--tomo-text-strong);
                line-height: 1;
            }
            .att-label {
                font-size: 13px;
                font-weight: 600;
                color: var(--tomo-text-secondary);
                margin-top: 2px;
            }
            .att-cta {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                font-weight: 700;
                color: var(--tomo-secondary);
                margin-top: 6px;
            }
            .att-cta i {
                font-size: 11px;
                transition: transform 160ms ease;
            }
            .attention-card:hover .att-cta i {
                transform: translateX(2px);
            }

            /* Recent activity grid */
            .recent-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
                gap: 14px;
            }
            .recent-card {
                background: var(--tomo-bg-card);
                border-radius: var(--tomo-radius-lg);
                box-shadow: var(--tomo-shadow-card);
                padding: 18px 20px;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .recent-head {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            .see-all {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                font-weight: 700;
                color: var(--tomo-secondary);
                text-decoration: none;
            }
            .see-all i {
                font-size: 10px;
            }
            .recent-row {
                padding: 10px 0;
                border-bottom: 1px solid var(--tomo-divider);
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .recent-row:last-child {
                border-bottom: 0;
            }
            .recent-row-main {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            .ref {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 11.5px;
                font-weight: 700;
                color: var(--tomo-primary);
            }
            .recent-row-meta {
                font-size: 12.5px;
                color: var(--tomo-text-secondary);
            }
            .recent-row-meta .strong {
                color: var(--tomo-text-strong);
                font-weight: 600;
            }
            .recent-row-comment {
                font-size: 12.5px;
                color: var(--tomo-text);
                line-height: 1.5;
                font-style: italic;
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius);
                padding: 6px 10px;
                margin: 4px 0 2px;
            }
            .recent-row-time {
                font-size: 11px;
                color: var(--tomo-text-faint);
            }
            .recent-empty {
                padding: 20px 0;
                font-size: 13px;
                color: var(--tomo-text-muted);
                text-align: center;
                font-style: italic;
            }
            .rating {
                display: inline-flex;
                gap: 1px;
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
            .user-row {
                flex-direction: row;
                align-items: center;
                gap: 12px;
            }
            .user-row .avatar {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: var(--tomo-primary);
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 800;
                flex-shrink: 0;
            }
            .user-row .user-info {
                flex: 1;
                min-width: 0;
            }
            .user-row .strong {
                font-size: 13px;
                font-weight: 700;
                color: var(--tomo-text-strong);
            }
            .agency-row {
                flex-direction: row;
                align-items: center;
                gap: 12px;
            }
            .agency-row .agency-info {
                flex: 1;
                min-width: 0;
            }
            .agency-row .strong {
                font-size: 13px;
                font-weight: 700;
                color: var(--tomo-text-strong);
            }
            .agency-row .agency-pills {
                display: flex;
                flex-direction: column;
                gap: 4px;
                align-items: flex-end;
            }

            .strong {
                color: var(--tomo-text-strong);
                font-weight: 600;
            }
            .dim {
                color: var(--tomo-text-faint);
                font-style: italic;
            }
            .dim-small {
                color: var(--tomo-text-muted);
                font-size: 11.5px;
            }
        `
    ]
})
export class Dashboard {
    private dashboardService = inject(DashboardService);

    readonly skeletonItems = Array.from({ length: 4 });

    private static readonly EMPTY_KPIS: DashboardKpis = {
        users: { total: 0, verified: 0, pending: 0 },
        agencies: { total: 0, verified: 0, pending: 0 },
        vehicles: { total: 0 },
        bookings: { thisMonth: 0, active: 0 },
        revenue: { thisMonth: 0, allTime: 0 }
    };

    readonly kpis = signal<DashboardKpis>(Dashboard.EMPTY_KPIS);
    readonly attention = signal<AttentionCounts>({
        usersPendingKyc: 0,
        agenciesPendingReview: 0,
        agenciesPendingKyc: 0
    });
    readonly recentReservations = signal<RecentReservation[]>([]);
    readonly recentReviews = signal<RecentReview[]>([]);
    readonly recentUsers = signal<RecentUser[]>([]);
    readonly recentAgencies = signal<RecentAgency[]>([]);

    readonly loadingKpis = signal(true);
    readonly loadingAttention = signal(true);
    readonly loadingRecent = signal(true);

    readonly totalAttention = computed(() => {
        const a = this.attention();
        return a.usersPendingKyc + a.agenciesPendingReview + a.agenciesPendingKyc;
    });

    readonly kpiTiles = computed<KpiTile[]>(() => {
        const k = this.kpis();
        return [
            {
                label: 'Users',
                big: k.users.total,
                breakdown: [
                    { label: 'verified', value: k.users.verified, tone: 'good' },
                    { label: 'pending', value: k.users.pending, tone: 'warn' }
                ]
            },
            {
                label: 'Agencies',
                big: k.agencies.total,
                breakdown: [
                    { label: 'verified', value: k.agencies.verified, tone: 'good' },
                    { label: 'in queue', value: k.agencies.pending, tone: 'warn' }
                ]
            },
            {
                label: 'Bookings this month',
                big: k.bookings.thisMonth,
                breakdown: [{ label: 'active now', value: k.bookings.active, tone: 'muted' }]
            },
            {
                label: 'Revenue this month',
                big: Math.round(k.revenue.thisMonth),
                suffix: 'MAD',
                breakdown: [{ label: 'MAD all-time', value: Math.round(k.revenue.allTime), tone: 'muted' }]
            }
        ];
    });

    constructor() {
        void this.load();
    }

    private async load(): Promise<void> {
        // Three parallel cohorts so the page paints incrementally as each
        // group's slowest query returns.
        const kpisPromise = this.dashboardService.kpis().then((k) => {
            this.kpis.set(k);
            this.loadingKpis.set(false);
        });

        const attentionPromise = this.dashboardService.attention().then((a) => {
            this.attention.set(a);
            this.loadingAttention.set(false);
        });

        const recentPromise = Promise.all([
            this.dashboardService.recentReservations(6),
            this.dashboardService.recentReviews(6),
            this.dashboardService.recentUsers(6),
            this.dashboardService.recentAgencies(6)
        ]).then(([r, rev, u, ag]) => {
            this.recentReservations.set(r);
            this.recentReviews.set(rev);
            this.recentUsers.set(u);
            this.recentAgencies.set(ag);
            this.loadingRecent.set(false);
        });

        await Promise.all([kpisPromise, attentionPromise, recentPromise]);
    }

    // ----- helpers -----

    initialsOf(name: string | null | undefined, email: string | null | undefined): string {
        const trimmed = name?.trim();
        if (!trimmed) return (email?.[0] ?? '?').toUpperCase();
        const parts = trimmed.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
        return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }

    starsOf(rating: number): boolean[] {
        const r = Math.max(0, Math.min(5, Math.round(rating)));
        return [0, 1, 2, 3, 4].map((i) => i < r);
    }

    truncate(s: string, n: number): string {
        if (s.length <= n) return s;
        return s.slice(0, n).trimEnd() + '…';
    }

    resStatusClass(status: string): string {
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

    opStatusClass(status: string): string {
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
