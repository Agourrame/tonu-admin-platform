import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
    readonly client: SupabaseClient;

    constructor() {
        this.client = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
            auth: {
                // Bypass `navigator.locks` to avoid edge-case hangs in some
                // Chromium / Firefox contexts where the lock manager isn't
                // available (incognito, certain extensions, etc.).
                lock: async (_name, _timeout, fn) => fn(),
                persistSession: true,
                autoRefreshToken: true,
                // Auto-process OAuth code/tokens when the user lands back on
                // /auth/callback after Google round-trip. supabase-js will
                // fire onAuthStateChange('SIGNED_IN') once the exchange
                // completes — that's what AuthCallback waits on.
                detectSessionInUrl: true,
                flowType: 'pkce'
            }
        });
    }
}
