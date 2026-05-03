import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Agency, AgencyUpdate } from '../models/agency';
import { AgencyDocument } from '../models/agency-document';
import { User } from '../models/user';
import { AgencyStatus } from '../models/enums';

export type AgenciesFilter =
    | 'all'
    | 'pending_review'
    | 'active'
    | 'suspended'
    | 'rejected'
    | 'pending_kyc'
    | 'verified_kyc';

export interface ListAgenciesParams {
    page?: number;
    pageSize?: number;
    filter?: AgenciesFilter;
    search?: string;
}

export type OwnerLite = Pick<User, 'id' | 'full_name' | 'email' | 'phone'>;

export type AgencyRow = Agency & {
    owner: OwnerLite | null;
};

export type AgencyWithDossier = AgencyRow & {
    documents: AgencyDocument[];
};

export interface ListAgenciesResult {
    rows: AgencyRow[];
    total: number;
}

const OWNER_SELECT = 'owner:users!agencies_owner_id_fkey(id, full_name, email, phone)';

/**
 * All read/write paths against `public.agencies` for the admin platform.
 *
 * Two independent state machines per agency:
 *  - `status`              — operational (pending/active/suspended/rejected)
 *  - `verification_status` — KYC badge (none/pending/verified/rejected)
 * Each has its own approve/reject path. They are NEVER conflated; an admin
 * can suspend a verified agency, or activate one with no badge yet.
 */
@Injectable({ providedIn: 'root' })
export class AgenciesService {
    private supabase = inject(SupabaseService);

    private static readonly AGENCY_DOCS_BUCKET = 'agency-docs';
    private static readonly SIGNED_URL_TTL_SECONDS = 60 * 10;

    async list(params: ListAgenciesParams = {}): Promise<ListAgenciesResult> {
        const page = params.page ?? 0;
        const pageSize = params.pageSize ?? 50;
        const from = page * pageSize;
        const to = from + pageSize - 1;

        let query = this.supabase.client
            .from('agencies')
            .select(`*, ${OWNER_SELECT}`, { count: 'exact' })
            .range(from, to);

        switch (params.filter) {
            case 'pending_review':
                query = query.eq('status', 'pending');
                break;
            case 'active':
                query = query.eq('status', 'active');
                break;
            case 'suspended':
                query = query.eq('status', 'suspended');
                break;
            case 'rejected':
                query = query.eq('status', 'rejected');
                break;
            case 'pending_kyc':
                query = query.eq('verification_status', 'pending');
                break;
            case 'verified_kyc':
                query = query.eq('verification_status', 'verified');
                break;
        }

        const search = params.search?.trim();
        if (search) {
            const safe = search.replace(/[%,]/g, ' ');
            query = query.or(`name.ilike.%${safe}%,city.ilike.%${safe}%,slug.ilike.%${safe}%`);
        }

        const { data, error, count } = await query;
        if (error) {
            console.error('[agencies] list failed:', error);
            return { rows: [], total: 0 };
        }
        return { rows: (data as AgencyRow[]) ?? [], total: count ?? 0 };
    }

    /** Full dossier for the side drawer — agency + owner + all KYC documents. */
    async getDossier(id: string): Promise<AgencyWithDossier | null> {
        const { data, error } = await this.supabase.client
            .from('agencies')
            .select(`*, ${OWNER_SELECT}, documents:agency_documents(*)`)
            .eq('id', id)
            .single();
        if (error) {
            console.error('[agencies] getDossier failed:', error);
            return null;
        }
        return data as AgencyWithDossier;
    }

    /**
     * Sign a per-document file URL so the admin can preview it inline.
     * Pass-through for fully-qualified https URLs; bucket-paths get a
     * 10-minute signed URL.
     */
    async signedDocUrl(fileUrl: string | null | undefined): Promise<string | null> {
        if (!fileUrl) return null;
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
            return fileUrl;
        }
        let path = fileUrl.replace(/^\/+/, '');
        if (path.startsWith(`${AgenciesService.AGENCY_DOCS_BUCKET}/`)) {
            path = path.slice(AgenciesService.AGENCY_DOCS_BUCKET.length + 1);
        }
        const { data, error } = await this.supabase.client.storage
            .from(AgenciesService.AGENCY_DOCS_BUCKET)
            .createSignedUrl(path, AgenciesService.SIGNED_URL_TTL_SECONDS);
        if (error) {
            console.warn(`[agencies] signedDocUrl failed for "${path}":`, error.message);
            return null;
        }
        return data.signedUrl;
    }

    /** How many vehicles does this agency own? Cheap HEAD count. */
    async vehicleCount(agencyId: string): Promise<number> {
        const { count, error } = await this.supabase.client
            .from('vehicles')
            .select('id', { count: 'exact', head: true })
            .eq('agency_id', agencyId);
        if (error) {
            console.error('[agencies] vehicleCount failed:', error);
            return 0;
        }
        return count ?? 0;
    }

    // ----- Operational status (status column) -----

    async approveOperational(agencyId: string, reviewerId: string): Promise<boolean> {
        return this.update(agencyId, {
            status: 'active',
            reviewed_at: new Date().toISOString(),
            verification_reviewed_by: reviewerId,
            rejection_reason: null
        });
    }

    async suspendOperational(agencyId: string): Promise<boolean> {
        return this.update(agencyId, { status: 'suspended' });
    }

    async unsuspendOperational(agencyId: string): Promise<boolean> {
        return this.update(agencyId, { status: 'active' });
    }

    async rejectOperational(agencyId: string, reason: string, reviewerId: string): Promise<boolean> {
        const trimmed = reason.trim();
        if (!trimmed) {
            console.error('[agencies] rejectOperational: empty reason');
            return false;
        }
        return this.update(agencyId, {
            status: 'rejected',
            rejection_reason: trimmed,
            reviewed_at: new Date().toISOString(),
            verification_reviewed_by: reviewerId
        });
    }

    /** Move a rejected/suspended agency back to pending so the owner can
     *  resubmit and trigger a fresh review. */
    async movePending(agencyId: string): Promise<boolean> {
        const patch: AgencyUpdate = { status: 'pending' as AgencyStatus, rejection_reason: null };
        return this.update(agencyId, patch);
    }

    // ----- Verification status (independent KYC badge) -----

    async approveVerification(agencyId: string, reviewerId: string): Promise<boolean> {
        return this.update(agencyId, {
            verification_status: 'verified',
            verification_reviewed_at: new Date().toISOString(),
            verification_reviewed_by: reviewerId
        });
    }

    async rejectVerification(agencyId: string, reviewerId: string): Promise<boolean> {
        return this.update(agencyId, {
            verification_status: 'rejected',
            verification_reviewed_at: new Date().toISOString(),
            verification_reviewed_by: reviewerId
        });
    }

    /** Reset verification back to pending (e.g. owner re-uploaded docs). */
    async resetVerification(agencyId: string): Promise<boolean> {
        return this.update(agencyId, {
            verification_status: 'pending',
            verification_reviewed_at: null,
            verification_reviewed_by: null
        });
    }

    // ----- Plan + commission -----

    async setPlan(agencyId: string, planCode: string | null, customCommission: number | null): Promise<boolean> {
        return this.update(agencyId, {
            plan_code: planCode,
            custom_commission: customCommission
        });
    }

    private async update(id: string, patch: AgencyUpdate): Promise<boolean> {
        const { error } = await this.supabase.client
            .from('agencies')
            .update(patch)
            .eq('id', id);
        if (error) {
            console.error('[agencies] update failed:', error, 'patch=', patch);
            return false;
        }
        return true;
    }
}
