/** Remove service credentials and access-bearing links from a workspace export. */
export function redactExport(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactExport);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /token|secret|password|authorization|api.?key|signature|credential|payload|metadata|headers|error|review_url|media_url/i.test(
          key,
        )
          ? "[redacted]"
          : redactExport(item),
      ]),
    );
  }
  return value;
}

export function validateDeleteConfirmation(tenantId: string, confirmation: string): void {
  if (!tenantId || confirmation !== `DELETE ${tenantId}`) {
    throw new Error(`Type DELETE ${tenantId} exactly to confirm.`);
  }
}
