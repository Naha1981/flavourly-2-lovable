/** Sign-up needs a restaurant, an email and a password of at least 8 characters. */
export function validateSignup(input: { restaurant: string; email: string; password: string }): string | null {
  if (!input.restaurant.trim() || !input.email.trim() || input.password.length < 8)
    return "Add your restaurant, an email, and a password of at least 8 characters.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return "That email doesn't look right.";
  return null;
}

/** After sign-in, only ever return to a dashboard page — never an outside link. */
export function postLoginPath(redirect: string | undefined): string {
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//") || /[\\\x00-\x1f\x7f]/.test(redirect)) return "/dashboard";
  try {
    const url = new URL(redirect, "https://flavourly.invalid");
    if (url.origin !== "https://flavourly.invalid" || !/^\/dashboard(\/|$)/.test(url.pathname)) return "/dashboard";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/dashboard";
  }
}

/** Friendly sign-in error text. */
export function signInErrorMessage(message: string): string {
  return message.includes("Email not confirmed")
    ? "Confirm your email first, then sign in."
    : "That email and password don't match.";
}
