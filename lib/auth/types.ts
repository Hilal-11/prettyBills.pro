/** The signed-in user as the UI sees it: only what the sidebar and editor need. */
export type SessionUser = {
  id: string
  email: string
  name: string
  initials: string
  avatarUrl: string | null
  plan: "Free"
}
