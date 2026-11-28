/**
 * TanStack Query keys. Every key starts with the user it belongs to
 * (one user = one business), so one account's cached data can never answer
 * for another's; switching accounts removes the old user's keys.
 */
export const qk = {
  all: (u: string) => ["u", u] as const,
  overview: (u: string) => ["u", u, "overview"] as const,
  search: (u: string, q: string) => ["u", u, "search", q] as const,
}
