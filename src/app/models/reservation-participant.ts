/** A co-renter on a reservation — i.e. somebody other than the booking
 *  owner who'll be on the rental. The booking owner is `reservations.user_id`
 *  and is *not* duplicated here; participants in this table are co-renters
 *  only.
 *
 *  Lifecycle:
 *  - 'invited'  — booking owner picked them; they have a pending notification.
 *  - 'accepted' — they confirmed. Visible to the agency on the reservation card.
 *  - 'declined' — they passed. Hidden from the agency but kept for audit.
 *
 *  Booking owner pays the full amount; this table is intentionally
 *  payment-free. Per-renter splitting is a v2 concern. */
export type ReservationParticipantStatus = 'invited' | 'accepted' | 'declined';

export interface ReservationParticipant {
  id: string;
  reservation_id: string;
  user_id: string;
  status: ReservationParticipantStatus;
  invited_at: string;
  responded_at: string | null;
}

export interface ReservationParticipantInsert {
  id?: string;
  reservation_id: string;
  user_id: string;
  status?: ReservationParticipantStatus;
  invited_at?: string;
  responded_at?: string | null;
}

export type ReservationParticipantUpdate = Partial<ReservationParticipantInsert>;

/** Joined shape consumed by the friends-on-reservation UI (both customer
 *  and agency sides) — saves a second round-trip for the avatar/name. */
export interface ReservationParticipantWithUser extends ReservationParticipant {
  users: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    phone: string | null;
  } | null;
}
