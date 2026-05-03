import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Vehicle, VehicleUpdate } from '../models/vehicle';
import { VehicleImage } from '../models/vehicle-image';
import { VehicleFeature } from '../models/vehicle-feature';
import { Availability } from '../models/availability';
import { Agency } from '../models/agency';
import { VehicleStatus } from '../models/enums';

export type VehiclesFilter = 'all' | 'available' | 'rented' | 'maintenance' | 'inactive';

export interface ListVehiclesParams {
    page?: number;
    pageSize?: number;
    filter?: VehiclesFilter;
    search?: string;
}

export type AgencyLite = Pick<Agency, 'id' | 'name' | 'slug' | 'city' | 'status' | 'verification_status'>;

export type VehicleRow = Vehicle & {
    agency: AgencyLite | null;
    /** All vehicle_images for this vehicle — list page picks the primary
     *  for the thumbnail. Carrying them in the row avoids a second
     *  roundtrip when the user opens the drawer. */
    vehicle_images: VehicleImage[];
};

export type VehicleDossier = Vehicle & {
    agency: AgencyLite | null;
    images: VehicleImage[];
    features: VehicleFeature[];
    availability: Availability[];
};

export interface ListVehiclesResult {
    rows: VehicleRow[];
    total: number;
}

const AGENCY_SELECT =
    'agency:agencies!vehicles_agency_id_fkey(id, name, slug, city, status, verification_status)';

/**
 * All read/write paths against `public.vehicles` for the admin tool.
 *
 * Visibility rule: a vehicle appears in the public marketplace ONLY when
 * its agency is `status='active' AND verification_status='verified'`.
 * Admin RLS bypasses that gate, so this service can list every vehicle —
 * the trust state is surfaced in the UI but never filters the query.
 */
@Injectable({ providedIn: 'root' })
export class VehiclesService {
    private supabase = inject(SupabaseService);

    async list(params: ListVehiclesParams = {}): Promise<ListVehiclesResult> {
        const page = params.page ?? 0;
        const pageSize = params.pageSize ?? 50;
        const from = page * pageSize;
        const to = from + pageSize - 1;

        let query = this.supabase.client
            .from('vehicles')
            .select(`*, ${AGENCY_SELECT}, vehicle_images(image_url, is_primary, sort_order)`, { count: 'exact' })
            .range(from, to);

        switch (params.filter) {
            case 'available':
                query = query.eq('status', 'available');
                break;
            case 'rented':
                query = query.eq('status', 'rented');
                break;
            case 'maintenance':
                query = query.eq('status', 'maintenance');
                break;
            case 'inactive':
                query = query.eq('status', 'inactive');
                break;
        }

        const search = params.search?.trim();
        if (search) {
            const safe = search.replace(/[%,]/g, ' ');
            query = query.or(`brand.ilike.%${safe}%,model.ilike.%${safe}%,plate_number.ilike.%${safe}%`);
        }

        const { data, error, count } = await query;
        if (error) {
            console.error('[vehicles] list failed:', error);
            return { rows: [], total: 0 };
        }
        return { rows: (data as unknown as VehicleRow[]) ?? [], total: count ?? 0 };
    }

    async getDossier(id: string): Promise<VehicleDossier | null> {
        const { data, error } = await this.supabase.client
            .from('vehicles')
            .select(
                `*, ${AGENCY_SELECT}, images:vehicle_images(*), features:vehicle_features(*), availability:availability(*)`
            )
            .eq('id', id)
            .single();
        if (error) {
            console.error('[vehicles] getDossier failed:', error);
            return null;
        }
        return data as unknown as VehicleDossier;
    }

    async setStatus(vehicleId: string, status: VehicleStatus): Promise<boolean> {
        return this.update(vehicleId, { status });
    }

    async remove(vehicleId: string): Promise<boolean> {
        const { error } = await this.supabase.client.from('vehicles').delete().eq('id', vehicleId);
        if (error) {
            console.error('[vehicles] remove failed:', error);
            return false;
        }
        return true;
    }

    /** Active reservation count — for the drawer's "history" stat and to
     *  warn the admin before deleting a vehicle that's currently rented. */
    async activeReservationCount(vehicleId: string): Promise<number> {
        const { count, error } = await this.supabase.client
            .from('reservations')
            .select('id', { count: 'exact', head: true })
            .eq('vehicle_id', vehicleId)
            .in('status', ['pending', 'confirmed', 'active']);
        if (error) {
            console.error('[vehicles] activeReservationCount failed:', error);
            return 0;
        }
        return count ?? 0;
    }

    private async update(id: string, patch: VehicleUpdate): Promise<boolean> {
        const { error } = await this.supabase.client.from('vehicles').update(patch).eq('id', id);
        if (error) {
            console.error('[vehicles] update failed:', error, 'patch=', patch);
            return false;
        }
        return true;
    }

    /** Pick the primary image, fallback to first by sort_order. */
    static primaryImage(images: VehicleImage[] | null | undefined): VehicleImage | null {
        if (!images?.length) return null;
        return (
            images.find((i) => i.is_primary) ??
            [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0] ??
            null
        );
    }

    /** Public-marketplace visibility verdict — agency must be both
     *  operationally active AND KYC-verified for the vehicle to render
     *  to renters. The vehicle itself can be in any status; this helper
     *  only reflects the gate from the agency side. */
    static isPublic(vehicle: Pick<VehicleRow, 'agency' | 'status'>): boolean {
        if (!vehicle.agency) return false;
        return (
            vehicle.agency.status === 'active' &&
            vehicle.agency.verification_status === 'verified' &&
            (vehicle.status === 'available' || vehicle.status === 'rented')
        );
    }
}
