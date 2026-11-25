/** Plain-language messages for Supabase auth errors, by error code. */
export function authMessage(error: { code?: string; status?: number; message?: string; name?: string } | null | undefined) {
  if (!error) return "Something went wrong. Try again."
  switch (error.code) {
    case "invalid_credentials":
      return "That email and password don't match. Check them and try again."
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Log in instead."
    case "weak_password":
      return "Choose a stronger password: at least 8 characters, mixing letters and numbers."
    case "same_password":
      return "That's your current password. Choose a new one."
    case "over_email_send_rate_limit":
      return "We've sent a few emails already. Wait a minute, then try again."
    case "over_request_rate_limit":
      return "Too many attempts. Wait a moment, then try again."
    case "email_address_invalid":
      return "Use a real email address you can open."
    case "email_address_not_authorized":
      // Supabase's built-in mailer only delivers to project team members until custom SMTP is set up
      return "We can't send email to this address yet. Try again later, or continue with Google."
    case "signup_disabled":
      return "New sign-ups are paused right now."
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
      return "Your session has ended. Log in again."
    case "otp_expired":
      return "That link has expired. Ask for a new one."
    case "reauthentication_needed":
      return "For your security, change your password with a reset link instead."
  }
  if (error.name === "AuthRetryableFetchError" || error.status === 0) return "Can't reach the server. Check your connection and try again."
  return error.message || "Something went wrong. Try again."
}

/** Reasons the /auth/callback route can send back as ?error=. */
export const CALLBACK_ERRORS: Record<string, string> = {
  link: "That link has expired, was already used, or was opened in a different browser. Log in, or ask for a new link.",
  cancelled: "Google sign-in was cancelled.",
  provider: "Google sign-in didn't work. Try again, or use your email.",
}
