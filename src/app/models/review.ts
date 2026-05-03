import { ReviewerType, ReviewTargetType } from './enums';

/**
 * DB enforces that exactly one of `user_reviewer_id` / `agency_reviewer_id` is set
 * (via a CHECK constraint). Not expressible in TS — consumers must respect the
 * `reviewer_type` discriminator when writing.
 */
export interface Review {
  id: string;
  reservation_id: string;
  reviewer_type: ReviewerType;
  user_reviewer_id: string | null;
  agency_reviewer_id: string | null;
  target_type: ReviewTargetType;
  rating: number;
  comment: string | null;
  is_visible: boolean;
  created_at: string;
}

export interface ReviewInsert {
  id?: string;
  reservation_id: string;
  reviewer_type: ReviewerType;
  user_reviewer_id?: string | null;
  agency_reviewer_id?: string | null;
  target_type: ReviewTargetType;
  rating: number;
  comment?: string | null;
  is_visible?: boolean;
  created_at?: string;
}

export type ReviewUpdate = Partial<ReviewInsert>;
