/** Sign-up needs a restaurant, an email and a password of at least 8 characters. */
export function validateSignup(input: {
  restaurant: string;
  email: string;
  password: string;
}): string | null {
  if (!input.restaurant.trim() || !input.email.trim() || input.password.length < 8)
    return "Add your restaurant, an email, and a password of at least 8 characters.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    return "That email doesn't look right.";
  return null;
}

/** After sign-in, only ever return to a dashboard page — never an outside link. */
export function postLoginPath(redirect: string | undefined): string {
  if (
    !redirect ||
    !redirect.startsWith("/") ||
    redirect.startsWith("//") ||
    redirect.includes("\\") ||
    [...redirect].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  )
    return "/dashboard";
  try {
    const url = new URL(redirect, "https://flavourly.invalid");
    if (url.origin !== "https://flavourly.invalid" || !/^\/dashboard(\/|$)/.test(url.pathname))
      return "/dashboard";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/dashboard";
  }
}

/** Friendly sign-in error text. */
export function authServiceErrorMessage(code?: string): string | null {
  if (code === "email_provider_disabled" || code === "signup_disabled")
    return "Email access is paused by the service. No password change is needed. Please contact the team.";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit")
    return "Too many attempts. Please wait before trying again.";
  return null;
}

export function signupErrorMessage(code?: string): string {
  return (
    authServiceErrorMessage(code) ??
    "Account creation could not complete. Please check your details or contact the team."
  );
}

export function signInErrorMessage(message: string, code?: string): string {
  return (
    authServiceErrorMessage(code) ??
    (message.includes("Email not confirmed")
      ? "Confirm your email first, then sign in."
      : "That email and password don't match.")
  );
}
