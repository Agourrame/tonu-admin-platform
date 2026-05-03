import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { PlatformConfig, PlatformConfigInsert, PlatformConfigUpdate } from '../models/platform-config';

@Injectable({ providedIn: 'root' })
export class PlatformConfigService {
    private supabase = inject(SupabaseService);

    async list(): Promise<PlatformConfig[]> {
        const { data, error } = await this.supabase.client
            .from('platform_config')
            .select('*')
            .order('key', { ascending: true });
        if (error) {
            console.error('[platform_config] list failed:', error);
            return [];
        }
        return (data as PlatformConfig[]) ?? [];
    }

    async upsert(input: PlatformConfigInsert): Promise<PlatformConfig | null> {
        const { data, error } = await this.supabase.client
            .from('platform_config')
            .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: 'key' })
            .select()
            .single();
        if (error) {
            console.error('[platform_config] upsert failed:', error);
            return null;
        }
        return data as PlatformConfig;
    }

    async update(key: string, patch: PlatformConfigUpdate): Promise<boolean> {
        const { key: _drop, ...safe } = patch;
        const { error } = await this.supabase.client
            .from('platform_config')
            .update({ ...safe, updated_at: new Date().toISOString() })
            .eq('key', key);
        if (error) {
            console.error('[platform_config] update failed:', error, 'key=', key);
            return false;
        }
        return true;
    }

    async remove(key: string): Promise<boolean> {
        const { error } = await this.supabase.client.from('platform_config').delete().eq('key', key);
        if (error) {
            console.error('[platform_config] remove failed:', error);
            return false;
        }
        return true;
    }
}
