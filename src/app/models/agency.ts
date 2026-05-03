import { AgencyStatus } from './enums';

export interface Agency {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  /** Cities the agency declares as operational. Drives the city dropdown
   *  on the "Add vehicle" form and the renter-side "agencies in city X"
   *  filter. The HQ `city` above is automatically considered served, so
   *  callers should fall back to `[city]` when this list is empty. */
  operating_cities: string[];
  latitude: number | null;
  longitude: number | null;
  status: AgencyStatus;
  /** KYC verification badge — independent from operational `status`.
   *  'none' = never started, 'pending' = under admin review,
   *  'verified' = green checkmark on profile, 'rejected' = admin
   *  rejected the dossier and the agency must re-submit. */
  verification_status: 'none' | 'pending' | 'verified' | 'rejected';
  verification_submitted_at: string | null;
  verification_reviewed_at: string | null;
  verification_reviewed_by: string | null;
  plan_code: string | null;
  custom_commission: number | null;
  offers_delivery: boolean;
  delivery_fee: number | null;
  /** 'city' | 'region' | 'national' — UI scope for the home-delivery zone. */
  delivery_scope: string | null;
  /** km within which home delivery is free. */
  free_radius: number | null;
  delivery_min_fee: number | null;
  /** JSONB — list of home-delivery city names. */
  delivery_cities: string[] | null;
  /** Airport delivery is a separate product from home delivery — the
   *  agency drops the car at the airport (or picks it up there). */
  airport_delivery_enabled: boolean;
  /** 'local' = the agency's own city's airport only. 'national' = any
   *  Moroccan airport (with the flat fee below). */
  airport_delivery_scope: 'local' | 'national' | null;
  airport_delivery_fee: number | null;
  /** One-way drop-off — the renter can return the vehicle in another
   *  Moroccan city. Each entry pairs a destination city with a flat
   *  return fee. */
  oneway_dropoff_enabled: boolean;
  oneway_dropoff_cities: { city: string; fee: number }[];
  /** Public-profile cover photo URL — uploaded to the `agency-logos` bucket
   *  under a `cover-{ts}.{ext}` path or hosted externally. */
  cover_image_url: string | null;
  specialties: string[];
  /** Each entry: `{ icon: string, label: string, included: boolean }` —
   *  drives the "What's included" section on the public profile. */
  services: { icon: string; label: string; included: boolean }[];
  languages: string[];
  /** Each entry: `{ q: string, a: string }` — drives the FAQ accordion. */
  faqs: { q: string; a: string }[];
  /** Moroccan business identifier ("Identifiant Commun de l'Entreprise"),
   *  collected during onboarding and verified by admins during review. */
  ice_number: string | null;
  /** Registry-of-commerce number — usually paired with the ICE. */
  rc_number: string | null;
  /** Populated by admins when status flips to 'rejected'. Surfaced to
   *  the applicant as the rejection-banner copy on profile so they
   *  understand what to fix before re-submitting. */
  rejection_reason: string | null;
  /** Stamped on insert by the onboarding flow. Drives the "Submitted N
   *  days ago" line on the pending banner. */
  submitted_at: string | null;
  /** Stamped by admins when status flips to 'active' or 'rejected'. */
  reviewed_at: string | null;
  created_at: string;
}

export interface AgencyInsert {
  id?: string;
  owner_id: string;
  name: string;
  slug: string;
  tagline?: string | null;
  description?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url?: string | null;
  address?: string | null;
  city?: string | null;
  operating_cities?: string[];
  latitude?: number | null;
  longitude?: number | null;
  status: AgencyStatus;
  verification_status?: 'none' | 'pending' | 'verified' | 'rejected';
  verification_submitted_at?: string | null;
  verification_reviewed_at?: string | null;
  verification_reviewed_by?: string | null;
  plan_code?: string | null;
  custom_commission?: number | null;
  offers_delivery?: boolean;
  delivery_fee?: number | null;
  delivery_scope?: string | null;
  free_radius?: number | null;
  delivery_min_fee?: number | null;
  delivery_cities?: string[] | null;
  airport_delivery_enabled?: boolean;
  airport_delivery_scope?: 'local' | 'national' | null;
  airport_delivery_fee?: number | null;
  oneway_dropoff_enabled?: boolean;
  oneway_dropoff_cities?: { city: string; fee: number }[];
  cover_image_url?: string | null;
  specialties?: string[];
  services?: { icon: string; label: string; included: boolean }[];
  languages?: string[];
  faqs?: { q: string; a: string }[];
  ice_number?: string | null;
  rc_number?: string | null;
  rejection_reason?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
}

export type AgencyUpdate = Partial<AgencyInsert>;
