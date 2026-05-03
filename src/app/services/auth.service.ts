import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthError, AuthTokenResponsePassword, Session, User as AuthUser } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { User as Profile } from '../models/user';

/**
 * Admin auth state — single source of truth for "who is logged in" and
 * "are they allowed in this admin tool".
 *
 * Two layers:
 *  - `session()` / `authUser()` — Supabase auth identity. Anyone with a
 *    valid email + password can produce one.
 *  - `profile()` — the matching `public.users` row, including `role`.
 *    Drives `isAdmin()` — admin platform routes are gated on this.
 *
 * Role check is enforced at three places (defense in depth):
 *  1. Login page — refuses to navigate home for non-admin sessions, and
 *     signs them out immediately so a stale token can't sneak in.
 *  2. `adminGuard` — re-checks on every route activation.
 *  3. Database RLS — even with a valid session, non-admin reads on
 *     admin-only views/policies will return zero rows.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
    private supabase = inject(SupabaseService);

    private readonly _session = signal<Session | null>(null);
    private readonly _profile = signal<Profile | null>(null);

    /** In-flight loadProfile dedupe. Both `bootstrap()` and the
     *  `onAuthStateChange` listener want to populate `_profile` on init;
     *  if they run in parallel and one times out, its null-fallback would
     *  clobber the other's successful result. Sharing a single promise
     *  per uid prevents that. */
    private inflightProfileLoad: { uid: string; promise: Promise<void> } | null = null;

    /** Resolves once the initial `getSession()` round-trip has completed.
     *  Guards `await whenReady()` before reading `isAdmin()` so they don't
     *  race the bootstrap. */
    readonly whenReady: Promise<void>;

    readonly session = this._session.asReadonly();
    readonly profile = this._profile.asReadonly();
    readonly authUser = computed<AuthUser | null>(() => this._session()?.user ?? null);
    readonly isAuthed = computed(() => this._session() !== null);
    readonly isAdmin = computed(() => {
        const role = this._profile()?.role;
        return role === 'admin' || role === 'superadmin';
    });

    constructor() {
        this.whenReady = this.bootstrap();
        this.supabase.client.auth.onAuthStateChange(async (_event, session) => {
            this._session.set(session);
            if (session?.user) {
                await this.loadProfile(session.user.id);
            } else {
                this._profile.set(null);
            }
        });
    }

    private async bootstrap(): Promise<void> {
        const { data } = await this.supabase.client.auth.getSession();
        this._session.set(data.session);
        if (data.session?.user) {
            await this.loadProfile(data.session.user.id);
        }
    }

    private async loadProfile(uid: string): Promise<void> {
        // Dedupe — return the same promise to a parallel caller.
        if (this.inflightProfileLoad?.uid === uid) {
            return this.inflightProfileLoad.promise;
        }
        const promise = this.doLoadProfile(uid);
        this.inflightProfileLoad = { uid, promise };
        try {
            await promise;
        } finally {
            if (this.inflightProfileLoad?.uid === uid) {
                this.inflightProfileLoad = null;
            }
        }
    }

    private async doLoadProfile(uid: string): Promise<void> {
        // Race the Supabase query against a wall-clock timeout. If the
        // network call hangs we fall back rather than blocking whenReady
        // forever — that would freeze the entire admin shell.
        const queryPromise = this.supabase.client
            .from('users')
            .select('*')
            .eq('id', uid)
            .single();

        const timeoutPromise = new Promise<{ data: null; error: { message: string; code: string } }>((resolve) =>
            setTimeout(
                () =>
                    resolve({
                        data: null,
                        error: { message: 'loadProfile timed out after 10s', code: 'CLIENT_TIMEOUT' }
                    }),
                10_000
            )
        );

        const { data, error } = (await Promise.race([queryPromise, timeoutPromise])) as { data: Profile | null; error: { message: string; code?: string } | null };

        if (error) {
            console.error('[auth] loadProfile failed:', error);
            // Don't clobber a profile that landed from a parallel
            // successful call — only clear if we still have nothing.
            if (!this._profile()) {
                this._profile.set(null);
            }
            return;
        }
        this._profile.set(data);
    }

    signIn(email: string, password: string): Promise<AuthTokenResponsePassword> {
        return this.supabase.client.auth.signInWithPassword({ email, password });
    }

    /**
     * Kicks off the Google OAuth round-trip. supabase-js redirects the
     * window to Google's consent screen; on success Google bounces back
     * to `${origin}/auth/callback?code=...` where the AuthCallback
     * component waits for `onAuthStateChange` to fire and routes the
     * user based on admin role.
     */
    async signInWithGoogle(): Promise<{ error: AuthError | null }> {
        const { error } = await this.supabase.client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`
            }
        });
        return { error };
    }

    async signOut(): Promise<{ error: AuthError | null }> {
        const result = await this.supabase.client.auth.signOut();
        this._session.set(null);
        this._profile.set(null);
        return result;
    }
}
