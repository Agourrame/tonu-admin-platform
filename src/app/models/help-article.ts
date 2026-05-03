/** A row from `public.help_articles` — backs the "common questions"
 *  list inside the help center modal.
 *
 *  Body intentionally stays plain text (no markdown / HTML) — the modal
 *  splits on `\n\n` and renders each chunk as a `<p>`. Keeps the trust
 *  surface small (no XSS risk via author error).
 *
 *  `category` is one of the values constrained by the DB CHECK; the
 *  client uses it to bucket articles into section headers in the modal. */
export type HelpArticleCategory =
  | 'reservations'
  | 'identity'
  | 'account'
  | 'payments'
  | 'hosting'
  | 'privacy'
  | 'general';

export interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  category: HelpArticleCategory;
  /** Optional ionicon name for the row's leading badge. */
  icon: string | null;
  sort_order: number;
  is_published: boolean;
  updated_at: string;
  created_at: string;
}
