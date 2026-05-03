import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { SubscriptionPlan, SubscriptionPlanInsert, SubscriptionPlanUpdate } from '../models/subscription-plan';

@Injectable({ providedIn: 'root' })
export class SubscriptionPlansService {
    private supabase = inject(SupabaseService);

    /** Active plans only — what gets shown to agency owners. Admins see
     *  everything via `listAll()` since they need to manage retired plans. */
    async listActive(): Promise<SubscriptionPlan[]> {
        const { data, error } = await this.supabase.client
            .from('subscription_plans')
            .select('*')
            .eq('is_active', true)
            .order('monthly_price', { ascending: true });
        if (error) {
            console.error('[plans] listActive failed:', error);
            return [];
        }
        return (data as SubscriptionPlan[]) ?? [];
    }

    async listAll(): Promise<SubscriptionPlan[]> {
        const { data, error } = await this.supabase.client
            .from('subscription_plans')
            .select('*')
            .order('monthly_price', { ascending: true });
        if (error) {
            console.error('[plans] listAll failed:', error);
            return [];
        }
        return (data as SubscriptionPlan[]) ?? [];
    }

    async create(input: SubscriptionPlanInsert): Promise<SubscriptionPlan | null> {
        const { data, error } = await this.supabase.client
            .from('subscription_plans')
            .insert(input)
            .select()
            .single();
        if (error) {
            console.error('[plans] create failed:', error);
            return null;
        }
        return data as SubscriptionPlan;
    }

    async update(code: string, patch: SubscriptionPlanUpdate): Promise<boolean> {
        // The `code` column is the PK — block accidental renames here so a
        // bad form payload can't orphan the agencies.plan_code FKs.
        const { code: _drop, ...safePatch } = patch;
        const { error } = await this.supabase.client
            .from('subscription_plans')
            .update(safePatch)
            .eq('code', code);
        if (error) {
            console.error('[plans] update failed:', error, 'code=', code);
            return false;
        }
        return true;
    }

    async remove(code: string): Promise<boolean> {
        const { error } = await this.supabase.client
            .from('subscription_plans')
            .delete()
            .eq('code', code);
        if (error) {
            console.error('[plans] remove failed:', error, 'code=', code);
            return false;
        }
        return true;
    }

    /** How many agencies are currently bound to this plan? Used by the
     *  delete confirmation to warn before orphaning the FK. */
    async agencyCount(planCode: string): Promise<number> {
        const { count, error } = await this.supabase.client
            .from('agencies')
            .select('id', { count: 'exact', head: true })
            .eq('plan_code', planCode);
        if (error) {
            console.error('[plans] agencyCount failed:', error);
            return 0;
        }
        return count ?? 0;
    }
}
