import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { SubscriptionPlan } from '../models/subscription-plan';

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
}
