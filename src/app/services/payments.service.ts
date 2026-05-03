import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Payment } from '../models/payment';

export type PaymentsFilter = 'all' | 'paid' | 'pending' | 'refunded' | 'failed';

export interface ListPaymentsParams {
    page?: number;
    pageSize?: number;
    filter?: PaymentsFilter;
    search?: string;
}

export type PaymentRow = Payment & {
    reservation: {
        id: string;
        start_date: string;
        end_date: string;
        status: string;
        user: { id: string; full_name: string; email: string } | null;
        vehicle: {
            id: string;
            brand: string;
            model: string;
            agency: { id: string; name: string } | null;
        } | null;
    } | null;
};

export interface ListPaymentsResult {
    rows: PaymentRow[];
    total: number;
}

const PAYMENT_SELECT = `
    *,
    reservation:reservations!payments_reservation_id_fkey(
        id, start_date, end_date, status,
        user:users!reservations_user_id_fkey(id, full_name, email),
        vehicle:vehicles!reservations_vehicle_id_fkey(
            id, brand, model,
            agency:agencies!vehicles_agency_id_fkey(id, name)
        )
    )
`;

/**
 * Read-only ledger over `public.payments`. The table is write-once by
 * design (booking → snapshot at confirmation), so this service exposes
 * no mutation methods on purpose. Refunds/disputes happen in the
 * external payment provider, not here.
 */
@Injectable({ providedIn: 'root' })
export class PaymentsService {
    private supabase = inject(SupabaseService);

    async list(params: ListPaymentsParams = {}): Promise<ListPaymentsResult> {
        const page = params.page ?? 0;
        const pageSize = params.pageSize ?? 50;
        const from = page * pageSize;
        const to = from + pageSize - 1;

        let query = this.supabase.client
            .from('payments')
            .select(PAYMENT_SELECT, { count: 'exact' })
            .range(from, to);

        switch (params.filter) {
            case 'paid':
            case 'pending':
            case 'refunded':
            case 'failed':
                query = query.eq('status', params.filter);
                break;
        }

        const search = params.search?.trim();
        if (search) {
            query = query.ilike('id', `%${search}%`);
        }

        const { data, error, count } = await query;
        if (error) {
            console.error('[payments] list failed:', error);
            return { rows: [], total: 0 };
        }
        return { rows: (data as unknown as PaymentRow[]) ?? [], total: count ?? 0 };
    }

    /** Aggregate KPI strip for the top of the page. Single roundtrip
     *  via PostgREST `count` would need a view; for v1 we just sum
     *  client-side over the current page. Replace with a dedicated
     *  aggregate RPC when the volume grows. */
    async totals(): Promise<{ revenue: number; commission: number; netAgencies: number; count: number }> {
        // Pull a wide page (up to 1000 rows) and sum. Good enough until
        // payments grow past that.
        const { data, error } = await this.supabase.client
            .from('payments')
            .select('amount_total, agency_commission, net_agency, status')
            .eq('status', 'paid')
            .limit(1000);
        if (error) {
            console.error('[payments] totals failed:', error);
            return { revenue: 0, commission: 0, netAgencies: 0, count: 0 };
        }
        const rows = (data as Pick<Payment, 'amount_total' | 'agency_commission' | 'net_agency'>[]) ?? [];
        return {
            revenue: rows.reduce((s, r) => s + (r.amount_total ?? 0), 0),
            commission: rows.reduce((s, r) => s + (r.agency_commission ?? 0), 0),
            netAgencies: rows.reduce((s, r) => s + (r.net_agency ?? 0), 0),
            count: rows.length
        };
    }
}
