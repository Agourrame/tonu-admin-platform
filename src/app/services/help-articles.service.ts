import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { HelpArticle, HelpArticleCategory, HelpArticleInsert, HelpArticleUpdate } from '../models/help-article';

export type HelpArticlesFilter = 'all' | 'published' | 'drafts' | HelpArticleCategory;

export const HELP_CATEGORIES: HelpArticleCategory[] = [
    'reservations',
    'identity',
    'account',
    'payments',
    'hosting',
    'privacy',
    'general'
];

@Injectable({ providedIn: 'root' })
export class HelpArticlesService {
    private supabase = inject(SupabaseService);

    async list(filter: HelpArticlesFilter = 'all'): Promise<HelpArticle[]> {
        let query = this.supabase.client
            .from('help_articles')
            .select('*')
            .order('category', { ascending: true })
            .order('sort_order', { ascending: true });

        switch (filter) {
            case 'published':
                query = query.eq('is_published', true);
                break;
            case 'drafts':
                query = query.eq('is_published', false);
                break;
            case 'all':
                break;
            default:
                // Category filter
                query = query.eq('category', filter);
        }

        const { data, error } = await query;
        if (error) {
            console.error('[help_articles] list failed:', error);
            return [];
        }
        return (data as HelpArticle[]) ?? [];
    }

    async create(input: HelpArticleInsert): Promise<HelpArticle | null> {
        const { data, error } = await this.supabase.client
            .from('help_articles')
            .insert(input)
            .select()
            .single();
        if (error) {
            console.error('[help_articles] create failed:', error);
            return null;
        }
        return data as HelpArticle;
    }

    async update(id: string, patch: HelpArticleUpdate): Promise<boolean> {
        const { id: _drop, slug: _drop2, ...safe } = patch;
        const { error } = await this.supabase.client
            .from('help_articles')
            .update({ ...safe, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) {
            console.error('[help_articles] update failed:', error);
            return false;
        }
        return true;
    }

    async setPublished(id: string, published: boolean): Promise<boolean> {
        return this.update(id, { is_published: published });
    }

    async remove(id: string): Promise<boolean> {
        const { error } = await this.supabase.client.from('help_articles').delete().eq('id', id);
        if (error) {
            console.error('[help_articles] remove failed:', error);
            return false;
        }
        return true;
    }
}
