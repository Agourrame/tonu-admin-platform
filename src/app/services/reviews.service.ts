import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Review, ReviewUpdate } from '../models/review';

export type ReviewsFilter = 'all' | 'visible' | 'hidden' | 'low' | 'user_to_x' | 'agency_to_x';

export interface ListReviewsParams {
    page?: number;
    pageSize?: number;
    filter?: ReviewsFilter;
}

export interface UserLite {
    id: string;
    full_name: string;
    email: string;
}

export interface AgencyLite {
    id: string;
    name: string;
    slug: string;
}

export interface ReviewReservationLite {
    id: string;
    vehicle_id: string;
    user_id: string;
    vehicle: {
        id: string;
        brand: string;
        model: string;
        plate_number: string;
        agency: AgencyLite | null;
    } | null;
    user: UserLite | null;
}

export type ReviewRow = Review & {
    user_reviewer: UserLite | null;
    agency_reviewer: AgencyLite | null;
    reservation: ReviewReservationLite | null;
};

export interface ListReviewsResult {
    rows: ReviewRow[];
    total: number;
}

const REVIEW_SELECT = `
    *,
    user_reviewer:users!reviews_user_reviewer_id_fkey(id, full_name, email),
    agency_reviewer:agencies!reviews_agency_reviewer_id_fkey(id, name, slug),
    reservation:reservations!reviews_reservation_id_fkey(
        id, vehicle_id, user_id,
        vehicle:vehicles!reservations_vehicle_id_fkey(
            id, brand, model, plate_number,
            agency:agencies!vehicles_agency_id_fkey(id, name, slug)
        ),
        user:users!reservations_user_id_fkey(id, full_name, email)
    )
`;

@Injectable({ providedIn: 'root' })
export class ReviewsService {
    private supabase = inject(SupabaseService);

    async list(params: ListReviewsParams = {}): Promise<ListReviewsResult> {
        const page = params.page ?? 0;
        const pageSize = params.pageSize ?? 50;
        const from = page * pageSize;
        const to = from + pageSize - 1;

        let query = this.supabase.client
            .from('reviews')
            .select(REVIEW_SELECT, { count: 'exact' })
            .range(from, to);

        switch (params.filter) {
            case 'visible':
                query = query.eq('is_visible', true);
                break;
            case 'hidden':
                query = query.eq('is_visible', false);
                break;
            case 'low':
                query = query.lte('rating', 2);
                break;
            case 'user_to_x':
                query = query.eq('reviewer_type', 'user');
                break;
            case 'agency_to_x':
                query = query.eq('reviewer_type', 'agency');
                break;
        }

        const { data, error, count } = await query;
        if (error) {
            console.error('[reviews] list failed:', error);
            return { rows: [], total: 0 };
        }
        return { rows: (data as unknown as ReviewRow[]) ?? [], total: count ?? 0 };
    }

    async setVisibility(reviewId: string, visible: boolean): Promise<boolean> {
        return this.update(reviewId, { is_visible: visible });
    }

    async remove(reviewId: string): Promise<boolean> {
        const { error } = await this.supabase.client.from('reviews').delete().eq('id', reviewId);
        if (error) {
            console.error('[reviews] remove failed:', error);
            return false;
        }
        return true;
    }

    private async update(id: string, patch: ReviewUpdate): Promise<boolean> {
        const { error } = await this.supabase.client.from('reviews').update(patch).eq('id', id);
        if (error) {
            console.error('[reviews] update failed:', error, 'patch=', patch);
            return false;
        }
        return true;
    }
}
