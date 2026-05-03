import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface DashboardKpis {
    users: { total: number; verified: number; pending: number };
    agencies: { total: number; verified: number; pending: number };
    vehicles: { total: number };
    bookings: { thisMonth: number; active: number };
    revenue: { thisMonth: number; allTime: number };
}

export interface AttentionCounts {
    usersPendingKyc: number;
    agenciesPendingReview: number;
    agenciesPendingKyc: number;
}

export interface RecentReservation {
    id: string;
    status: string;
    start_date: string;
    end_date: string;
    created_at: string | null;
    user: { full_name: string; email: string } | null;
    vehicle: { brand: string; model: string } | null;
}

export interface RecentReview {
    id: string;
    rating: number;
    reviewer_type: string;
    target_type: string;
    comment: string | null;
    created_at: string | null;
    user_reviewer: { full_name: string; email: string } | null;
    agency_reviewer: { name: string } | null;
}

export interface RecentUser {
    id: string;
    full_name: string;
    email: string;
    role: string;
    verification_status: string;
    created_at: string | null;
}

export interface RecentAgency {
    id: string;
    name: string;
    slug: string;
    city: string | null;
    status: string;
    verification_status: string;
    submitted_at: string | null;
}

/**
 * Aggregate read-only queries that power the admin home page. Everything
 * runs in parallel via Promise.all so the dashboard renders as soon as
 * the slowest of the bunch returns.
 *
 * Counts use HEAD requests (no rows transferred). Recent-X lists pull a
 * small `limit` window. Revenue sums client-side over a small slice —
 * fine until volume grows past ~1k rows, at which point this should
 * move to a dedicated SQL view or RPC.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
    private supabase = inject(SupabaseService);

    private monthStartIso(): string {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return start.toISOString();
    }

    async kpis(): Promise<DashboardKpis> {
        const monthStart = this.monthStartIso();

        const [
            usersTotal,
            usersVerified,
            usersPending,
            agenciesTotal,
            agenciesVerified,
            agenciesPending,
            vehiclesTotal,
            bookingsThisMonth,
            bookingsActive,
            paymentsAll,
            paymentsThisMonth
        ] = await Promise.all([
            this.headCount('users'),
            this.headCount('users', (q) => q.eq('verification_status', 'verified')),
            this.headCount('users', (q) => q.eq('verification_status', 'pending')),
            this.headCount('agencies'),
            this.headCount('agencies', (q) => q.eq('verification_status', 'verified')),
            this.headCount('agencies', (q) => q.eq('status', 'pending')),
            this.headCount('vehicles'),
            this.headCount('reservations', (q) => q.gte('created_at', monthStart)),
            this.headCount('reservations', (q) => q.eq('status', 'active')),
            this.sumPaymentTotals(),
            this.sumPaymentTotals(monthStart)
        ]);

        return {
            users: { total: usersTotal, verified: usersVerified, pending: usersPending },
            agencies: { total: agenciesTotal, verified: agenciesVerified, pending: agenciesPending },
            vehicles: { total: vehiclesTotal },
            bookings: { thisMonth: bookingsThisMonth, active: bookingsActive },
            revenue: { thisMonth: paymentsThisMonth, allTime: paymentsAll }
        };
    }

    async attention(): Promise<AttentionCounts> {
        const [usersPendingKyc, agenciesPendingReview, agenciesPendingKyc] = await Promise.all([
            this.headCount('users', (q) => q.eq('verification_status', 'pending')),
            this.headCount('agencies', (q) => q.eq('status', 'pending')),
            this.headCount('agencies', (q) => q.eq('verification_status', 'pending'))
        ]);
        return { usersPendingKyc, agenciesPendingReview, agenciesPendingKyc };
    }

    async recentReservations(limit = 6): Promise<RecentReservation[]> {
        const { data, error } = await this.supabase.client
            .from('reservations')
            .select(
                `id, status, start_date, end_date, created_at,
                 user:users!reservations_user_id_fkey(full_name, email),
                 vehicle:vehicles!reservations_vehicle_id_fkey(brand, model)`
            )
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) {
            console.error('[dashboard] recentReservations failed:', error);
            return [];
        }
        return (data as unknown as RecentReservation[]) ?? [];
    }

    async recentReviews(limit = 6): Promise<RecentReview[]> {
        const { data, error } = await this.supabase.client
            .from('reviews')
            .select(
                `id, rating, reviewer_type, target_type, comment, created_at,
                 user_reviewer:users!reviews_user_reviewer_id_fkey(full_name, email),
                 agency_reviewer:agencies!reviews_agency_reviewer_id_fkey(name)`
            )
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) {
            console.error('[dashboard] recentReviews failed:', error);
            return [];
        }
        return (data as unknown as RecentReview[]) ?? [];
    }

    async recentUsers(limit = 6): Promise<RecentUser[]> {
        // Some user tables don't have created_at — try ordered, fall back to
        // unordered if PostgREST 400s on the unknown sort column.
        const ordered = await this.supabase.client
            .from('users')
            .select('id, full_name, email, role, verification_status, created_at')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (!ordered.error) return (ordered.data as RecentUser[]) ?? [];

        const fallback = await this.supabase.client
            .from('users')
            .select('id, full_name, email, role, verification_status')
            .limit(limit);
        if (fallback.error) {
            console.error('[dashboard] recentUsers failed:', fallback.error);
            return [];
        }
        return (fallback.data as RecentUser[]).map((u) => ({ ...u, created_at: null }));
    }

    async recentAgencies(limit = 6): Promise<RecentAgency[]> {
        const { data, error } = await this.supabase.client
            .from('agencies')
            .select('id, name, slug, city, status, verification_status, submitted_at')
            .order('submitted_at', { ascending: false, nullsFirst: false })
            .limit(limit);
        if (error) {
            console.error('[dashboard] recentAgencies failed:', error);
            return [];
        }
        return (data as RecentAgency[]) ?? [];
    }

    // ----- internals -----

    private async headCount(
        table: 'users' | 'agencies' | 'vehicles' | 'reservations' | 'reviews' | 'payments',
        applyFilter?: (
            q: ReturnType<ReturnType<SupabaseService['client']['from']>['select']>
        ) => ReturnType<ReturnType<SupabaseService['client']['from']>['select']>
    ): Promise<number> {
        let q = this.supabase.client.from(table).select('id', { count: 'exact', head: true });
        if (applyFilter) {
            // The applied filter must return a query with the same chainable
            // shape; PostgREST builders are typed loosely so we cast through.
            q = applyFilter(q as never) as never;
        }
        const { count, error } = await q;
        if (error) {
            console.warn(`[dashboard] headCount(${table}) failed:`, error.message);
            return 0;
        }
        return count ?? 0;
    }

    /** Sum of paid-payment amount_total across the slice (this month or
     *  all time, depending on whether `sinceIso` is provided). */
    private async sumPaymentTotals(sinceIso?: string): Promise<number> {
        let q = this.supabase.client.from('payments').select('amount_total').eq('status', 'paid');
        if (sinceIso) q = q.gte('paid_at', sinceIso);
        const { data, error } = await q.limit(1000);
        if (error) {
            console.warn('[dashboard] sumPaymentTotals failed:', error.message);
            return 0;
        }
        return ((data as { amount_total: number }[]) ?? []).reduce((s, r) => s + (r.amount_total ?? 0), 0);
    }
}
