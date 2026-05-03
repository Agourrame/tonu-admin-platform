/** Symmetric friend graph row.
 *
 *  user_a is always the lexicographically smaller UUID and user_b the larger
 *  — that's a DB constraint, enforced by the service at insert time. The
 *  requester (initiator) must be one of the two; the *other* one is the
 *  addressee and is the only party who can flip status from 'pending' to
 *  'accepted'. Either side can delete the row to unfriend.
 *
 *  Status values:
 *  - 'pending'  — addressee hasn't responded yet.
 *  - 'accepted' — both sides see each other in friend lists.
 *  - 'blocked'  — addressee hard-declined; UI should treat as removed. */
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export interface Friendship {
  id: string;
  user_a: string;
  user_b: string;
  requester_id: string;
  status: FriendshipStatus;
  created_at: string;
  responded_at: string | null;
}

export interface FriendshipInsert {
  id?: string;
  user_a: string;
  user_b: string;
  requester_id: string;
  status?: FriendshipStatus;
  created_at?: string;
  responded_at?: string | null;
}

export type FriendshipUpdate = Partial<FriendshipInsert>;

/** Joined shape used by friend-list UIs. The "other" user (relative to
 *  auth.uid()) is hydrated by the service so the template just renders
 *  `friend.other.full_name` without caring which side of the pair is me. */
export interface FriendshipWithOther extends Friendship {
  other: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    invite_code: string;
  };
  /** True when the signed-in user is the addressee of a 'pending' row —
   *  drives the Accept / Decline buttons in the friends modal. */
  is_incoming_pending: boolean;
}
