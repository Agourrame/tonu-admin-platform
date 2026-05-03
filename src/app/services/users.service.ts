import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { User, UserUpdate } from '../models/user';
import { UserRole } from '../models/enums';

export type UsersFilter = 'all' | 'pending' | 'verified' | 'rejected' | 'admins' | 'blacklisted';

export interface ListUsersParams {
    page?: number;          // 0-indexed
    pageSize?: number;      // default 50
    filter?: UsersFilter;
    search?: string;        // case-insensitive match on email or full_name
}

export interface ListUsersResult {
    rows: User[];
    total: number;
}

export interface SignedKycUrls {
    cinFront?: string;
    cinBack?: string;
    licenseFront?: string;
    licenseBack?: string;
    selfie?: string;
}

/**
 * All read/write paths against `public.users` for the admin platform.
 * Relies on the admin RLS migration (20260504000001) — without it the
 * list query returns only the caller's own row.
 *
 * Failure semantics: every method LOGS errors with a `[users]` prefix
 * and returns a sensible neutral value (empty list, null, false). Pages
 * surface their own error UI off the return value rather than try/catch.
 */
@Injectable({ providedIn: 'root' })
export class UsersService {
    private supabase = inject(SupabaseService);

    private static readonly USER_DOCS_BUCKET = 'user-docs';
    private static readonly SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 min

    async list(params: ListUsersParams = {}): Promise<ListUsersResult> {
        const page = params.page ?? 0;
        const pageSize = params.pageSize ?? 50;
        const from = page * pageSize;
        const to = from + pageSize - 1;

        // Note: NOT ordering by created_at because the column may not be
        // present on this project's `public.users` snapshot (older schemas
        // shipped without it). PostgREST 400s on unknown sort columns.
        // Default order is by primary key insert order, which is fine.
        let query = this.supabase.client
            .from('users')
            .select('*', { count: 'exact' })
            .range(from, to);

        switch (params.filter) {
            case 'pending':
                query = query.eq('verification_status', 'pending');
                break;
            case 'verified':
                query = query.eq('verification_status', 'verified');
                break;
            case 'rejected':
                query = query.eq('verification_status', 'rejected');
                break;
            case 'admins':
                query = query.in('role', ['admin', 'superadmin']);
                break;
            case 'blacklisted':
                query = query.eq('is_blacklisted', true);
                break;
            // 'all' / undefined → no extra filter
        }

        const search = params.search?.trim();
        if (search) {
            // Escape % and , which have meaning in PostgREST or filter syntax.
            const safe = search.replace(/[%,]/g, ' ');
            query = query.or(`email.ilike.%${safe}%,full_name.ilike.%${safe}%`);
        }

        const { data, error, count } = await query;
        if (error) {
            console.error('[users] list failed:', error);
            return { rows: [], total: 0 };
        }
        return { rows: (data as User[]) ?? [], total: count ?? 0 };
    }

    async getById(id: string): Promise<User | null> {
        const { data, error } = await this.supabase.client
            .from('users')
            .select('*')
            .eq('id', id)
            .single();
        if (error) {
            console.error('[users] getById failed:', error);
            return null;
        }
        return data as User;
    }

    /** Approve KYC — flips verification_status to 'verified', stamps reviewed_at. */
    async approveKyc(userId: string): Promise<boolean> {
        return this.update(userId, {
            verification_status: 'verified',
            verification_reviewed_at: new Date().toISOString(),
            verification_rejection_reason: null
        });
    }

    /** Reject KYC — flips status to 'rejected', stores reason for the user to see. */
    async rejectKyc(userId: string, reason: string): Promise<boolean> {
        const trimmed = reason.trim();
        if (!trimmed) {
            console.error('[users] rejectKyc: empty reason');
            return false;
        }
        return this.update(userId, {
            verification_status: 'rejected',
            verification_reviewed_at: new Date().toISOString(),
            verification_rejection_reason: trimmed
        });
    }

    async setRole(userId: string, role: UserRole): Promise<boolean> {
        return this.update(userId, { role });
    }

    async setBlacklist(userId: string, blacklisted: boolean): Promise<boolean> {
        return this.update(userId, { is_blacklisted: blacklisted });
    }

    private async update(userId: string, patch: UserUpdate): Promise<boolean> {
        const { error } = await this.supabase.client
            .from('users')
            .update(patch)
            .eq('id', userId);
        if (error) {
            console.error('[users] update failed:', error, 'patch=', patch);
            return false;
        }
        return true;
    }

    /**
     * Mints time-limited signed URLs for a user's KYC document images so
     * an admin can preview them inline. The columns store either:
     *  - a fully-qualified https URL (legacy / external host) — pass through
     *  - a storage path inside the user-docs bucket — sign on the fly
     *
     * Anything that errors out is silently dropped from the result so
     * a single missing/expired doc doesn't blank out the whole panel.
     */
    async signedKycUrls(user: User): Promise<SignedKycUrls> {
        const slots: { key: keyof SignedKycUrls; raw: string | null }[] = [
            { key: 'cinFront', raw: user.cin_front_url },
            { key: 'cinBack', raw: user.cin_back_url },
            { key: 'licenseFront', raw: user.license_front_url },
            { key: 'licenseBack', raw: user.license_back_url },
            { key: 'selfie', raw: user.selfie_url }
        ];

        const result: SignedKycUrls = {};
        await Promise.all(
            slots.map(async ({ key, raw }) => {
                if (!raw) return;

                // Already a fully-qualified URL — use as-is.
                if (raw.startsWith('http://') || raw.startsWith('https://')) {
                    result[key] = raw;
                    return;
                }

                // Treat as storage path inside the user-docs bucket. Strip
                // any leading slash and an optional bucket prefix so callers
                // can store either form.
                let path = raw.replace(/^\/+/, '');
                if (path.startsWith(`${UsersService.USER_DOCS_BUCKET}/`)) {
                    path = path.slice(UsersService.USER_DOCS_BUCKET.length + 1);
                }

                const { data, error } = await this.supabase.client.storage
                    .from(UsersService.USER_DOCS_BUCKET)
                    .createSignedUrl(path, UsersService.SIGNED_URL_TTL_SECONDS);
                if (error) {
                    console.warn(`[users] signedKycUrls: ${key} failed for path "${path}":`, error.message);
                    return;
                }
                result[key] = data.signedUrl;
            })
        );
        return result;
    }

    /**
     * Cheap reservation count for the side-panel. Uses HEAD count so it
     * doesn't pull rows. Returns 0 on error (empty reservations is the
     * common case for newly-onboarded renters anyway).
     */
    async reservationCount(userId: string): Promise<number> {
        const { count, error } = await this.supabase.client
            .from('reservations')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId);
        if (error) {
            console.error('[users] reservationCount failed:', error);
            return 0;
        }
        return count ?? 0;
    }
}
