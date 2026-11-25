import { getCurrentUser } from "@/lib/auth/user"

import { NavUser } from "./nav-user"

/** Reads the session (request-time), so it renders inside a Suspense boundary. Guests get the guest menu. */
export async function SidebarUser() {
  const user = await getCurrentUser()
  return <NavUser user={user} />
}
