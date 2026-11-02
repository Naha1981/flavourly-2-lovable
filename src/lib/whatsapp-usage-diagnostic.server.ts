/** Safe diagnostic only: never return database messages, hints, SQL or tenant data. */
export function replyUsageErrorReference(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  if (typeof code === "string" && /^(?:PGRST[0-9]{3}|[0-9A-Z]{5})$/.test(code)) {
    return code;
  }
  return error ? "RPC_ERROR" : "EMPTY_RESULT";
}
