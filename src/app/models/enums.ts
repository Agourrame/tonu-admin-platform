export type UserRole = 'client' | 'admin' | 'superadmin';

/** `pending`   — application submitted, awaiting admin review.
 *  `active`    — approved by admin; full /agency-tabs access.
 *  `suspended` — admin paused the agency; no access until lifted.
 *  `rejected`  — admin rejected; rejection_reason populated; the
 *                applicant can edit their dossier and re-submit. */
export type AgencyStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export type VehicleFuel = 'gasoline' | 'diesel' | 'electric' | 'hybrid';

export type VehicleTransmission = 'manual' | 'automatic';

export type VehicleStatus = 'available' | 'rented' | 'maintenance' | 'inactive';

export type PaymentMethod = 'card' | 'cash' | 'transfer';

export type ReservationStatus = 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';

export type ReviewerType = 'user' | 'agency';

export type ReviewTargetType = 'user' | 'vehicle' | 'agency';

export type AgencyDocumentStatus = 'pending' | 'approved' | 'rejected';
