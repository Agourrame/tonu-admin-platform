import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Reservation, ReservationUpdate } from '../models/reservation';
import { Payment } from '../models/payment';
import { VehicleImage } from '../models/vehicle-image';
import { ReservationStatus } from '../models/enums';

export type ReservationsFilter = 'all' | 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';

export interface ListReservationsParams {
    page?: number;
    pageSize?: number;
    filter?: ReservationsFilter;
    search?: string;
}

export interface RenterLite {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    verification_status: string;
}

export interface VehicleLite {
    id: string;
    brand: string;
    model: string;
    year: number;
    plate_number: string;
    vehicle_images: Pick<VehicleImage, 'image_url' | 'is_primary' | 'sort_order'>[];
    agency: {
        id: string;
        name: string;
        slug: string;
        city: string | null;
    } | null;
}

export type ReservationRow = Reservation & {
    user: RenterLite | null;
    vehicle: VehicleLite | null;
};

export type ReservationDossier = ReservationRow & {
    payment: Payment | null;
};

export interface ListReservationsResult {
    rows: ReservationRow[];
    total: number;
}

const RESERVATION_SELECT = `
    *,
    user:users!reservations_user_id_fkey(id, full_name, email, phone, avatar_url, verification_status),
    vehicle:vehicles!reservations_vehicle_id_fkey(
        id, brand, model, year, plate_number,
        vehicle_images(image_url, is_primary, sort_order),
        agency:agencies!vehicles_agency_id_fkey(id, name, slug, city)
    )
`;

/**
 * All read/write paths against `public.reservations` for the admin tool.
 *
 * Two derived facts that aren't stored on the row:
 *  - `agency_id` — comes through `vehicle.agency_id`. Always join the
 *    vehicle when listing so the table can show which agency owns the
 *    booking.
 *  - `total_amount` — `daily_rate * days + delivery_fee`. We compute on
 *    the client; the planned `reservation_totals` view isn't wired yet.
 */
@Injectable({ providedIn: 'root' })
export class ReservationsService {
    private supabase = inject(SupabaseService);

    async list(params: ListReservationsParams = {}): Promise<ListReservationsResult> {
        const page = params.page ?? 0;
        const pageSize = params.pageSize ?? 50;
        const from = page * pageSize;
        const to = from + pageSize - 1;

        let query = this.supabase.client
            .from('reservations')
            .select(RESERVATION_SELECT, { count: 'exact' })
            .range(from, to);

        switch (params.filter) {
            case 'pending':
            case 'confirmed':
            case 'active':
            case 'completed':
            case 'cancelled':
                query = query.eq('status', params.filter);
                break;
        }

        const search = params.search?.trim();
        if (search) {
            // Reservations have no searchable column of their own besides id.
            // Match on the full id (UUIDs) — admin pastes a booking ref to
            // jump straight to it. Free-text search across joined user/vehicle
            // would need a view; out of scope for v1.
            query = query.ilike('id', `%${search}%`);
        }

        const { data, error, count } = await query;
        if (error) {
            console.error('[reservations] list failed:', error);
            return { rows: [], total: 0 };
        }
        return { rows: (data as unknown as ReservationRow[]) ?? [], total: count ?? 0 };
    }

    async getDossier(id: string): Promise<ReservationDossier | null> {
        const { data, error } = await this.supabase.client
            .from('reservations')
            .select(`${RESERVATION_SELECT}, payment:payments(*)`)
            .eq('id', id)
            .single();
        if (error) {
            console.error('[reservations] getDossier failed:', error);
            return null;
        }
        // PostgREST returns 1-1 joins as an array sometimes; normalize.
        const raw = data as Record<string, unknown>;
        const paymentRaw = raw['payment'];
        const payment = Array.isArray(paymentRaw) ? (paymentRaw[0] as Payment) ?? null : (paymentRaw as Payment) ?? null;
        return { ...(data as unknown as ReservationRow), payment };
    }

    async setStatus(reservationId: string, status: ReservationStatus): Promise<boolean> {
        return this.update(reservationId, { status });
    }

    private async update(id: string, patch: ReservationUpdate): Promise<boolean> {
        const { error } = await this.supabase.client.from('reservations').update(patch).eq('id', id);
        if (error) {
            console.error('[reservations] update failed:', error, 'patch=', patch);
            return false;
        }
        return true;
    }

    /** Computed booking duration in days (inclusive of both ends).
     *  Bookings span calendar days, so March 1 → March 4 = 4 days. */
    static daysBetween(startIso: string | null | undefined, endIso: string | null | undefined): number {
        if (!startIso || !endIso) return 0;
        const start = new Date(startIso).getTime();
        const end = new Date(endIso).getTime();
        if (isNaN(start) || isNaN(end) || end < start) return 0;
        const diffMs = end - start;
        return Math.max(1, Math.round(diffMs / 86_400_000) + 1);
    }

    /** Total customer-facing amount: rate × days + delivery fee. */
    static totalAmount(r: Pick<Reservation, 'daily_rate' | 'delivery_fee' | 'start_date' | 'end_date'>): number {
        const days = ReservationsService.daysBetween(r.start_date, r.end_date);
        return r.daily_rate * days + (r.delivery_fee ?? 0);
    }

    static primaryImage<T extends Pick<VehicleImage, 'image_url' | 'is_primary' | 'sort_order'>>(
        images: T[] | undefined | null
    ): T | null {
        if (!images?.length) return null;
        return (
            images.find((i) => i.is_primary) ??
            [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0] ??
            null
        );
    }
}
