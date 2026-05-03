import { UserRole } from './enums';

/** Identity-verification lifecycle. Mirrors `public.verification_status`:
 *  `none`     — user has never started.
 *  `pending`  — docs uploaded, awaiting admin review (~24h).
 *  `verified` — admin approved; user can book without friction.
 *  `rejected` — admin rejected; rejection_reason is populated and the
 *               user can re-upload to flip back to `pending`. */
export type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

/** App-wide preferences serialized to `users.prefs` (JSONB). All fields
 *  optional — the client falls back to sensible defaults for missing keys. */
export interface UserPrefs {
  push_notifs?: boolean;
  email_notifs?: boolean;
  dark_mode?: boolean;
  language?: 'en' | 'fr' | 'ar';
  currency?: 'MAD' | 'USD' | 'EUR';
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  /** Nullable to allow OAuth signups without a phone number. */
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  city: string | null;
  date_of_birth: string | null;
  cin_number: string | null;
  cin_front_url: string | null;
  cin_back_url: string | null;
  /** LEGACY — prefer `verification_status`. Kept for backfill compatibility. */
  cin_verified: boolean;
  cin_verified_at: string | null;
  license_number: string | null;
  license_front_url: string | null;
  license_back_url: string | null;
  license_expiry_date: string | null;
  /** LEGACY — prefer `verification_status`. */
  license_verified: boolean;
  /** Categories the user holds — A / B / C / D / EB / EC / ED. */
  license_categories: string[];
  trust_score: number | null;
  is_blacklisted: boolean;
  prefs: UserPrefs;
  verification_status: VerificationStatus;
  verification_submitted_at: string | null;
  verification_reviewed_at: string | null;
  verification_rejection_reason: string | null;
  /** Stable 8-char code that drops into `/invite/:code` links. Auto-set
   *  by the DB default and unique across all users. */
  invite_code: string;
  /** Live-captured selfie URL (signed) — forces a face-vs-CIN match at
   *  admin review time so a stolen ID alone isn't enough to pass. */
  selfie_url: string | null;
  created_at: string;
}

export interface UserInsert {
  id?: string;
  full_name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: UserRole;
  city?: string | null;
  date_of_birth?: string | null;
  cin_number?: string | null;
  cin_front_url?: string | null;
  cin_back_url?: string | null;
  cin_verified?: boolean;
  cin_verified_at?: string | null;
  license_number?: string | null;
  license_front_url?: string | null;
  license_back_url?: string | null;
  license_expiry_date?: string | null;
  license_verified?: boolean;
  license_categories?: string[];
  trust_score?: number | null;
  is_blacklisted?: boolean;
  prefs?: UserPrefs;
  verification_status?: VerificationStatus;
  verification_submitted_at?: string | null;
  verification_reviewed_at?: string | null;
  verification_rejection_reason?: string | null;
  invite_code?: string;
  selfie_url?: string | null;
  created_at?: string;
}

export type UserUpdate = Partial<UserInsert>;
