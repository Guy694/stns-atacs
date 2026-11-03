// Linking a Google identity to an existing account.
//
// The e-mail stored on an account was typed in at registration and never verified, so a Google
// login with the same e-mail must not take the account over. Instead the Google callback keeps a
// short-lived signed claim and asks the user to sign in once with the account's own method
// (username/password or ThaiD); only then is the Google identity linked.

type PendingClaim = { provider: "thaid" | "google"; googleSub?: string; email?: string } | null | undefined;
type LoggedInUser = { email: string | null; google_sub: string | null };

/** The Google `sub` to link for a user who has just signed in, or null when nothing should be linked. */
export function googleLinkForLogin(claim: PendingClaim, user: LoggedInUser): string | null {
  if (!claim || claim.provider !== "google" || !claim.googleSub || !claim.email) return null;
  if (user.google_sub) return null;
  if (!user.email || user.email.trim().toLowerCase() !== claim.email.trim().toLowerCase()) return null;
  return claim.googleSub;
}
