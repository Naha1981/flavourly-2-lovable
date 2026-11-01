import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { exportWorkspace, deleteWorkspace } from "@/lib/privacy.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PrivacyControls({ tenantId }: { tenantId: string }) {
  const exportData = useServerFn(exportWorkspace);
  const deleteData = useServerFn(deleteWorkspace);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [deleted, setDeleted] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Privacy action could not complete.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-6 grid gap-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-medium">Workspace data and privacy</h2>
      <p className="text-sm text-muted-foreground">
        Owner access required. Export downloads workspace records as JSON, with credential fields
        and unstructured provider payloads redacted. A missing database setup or oversized export
        stops the download rather than returning a partial file.
      </p>
      <Button
        disabled={busy || deleted || !tenantId}
        variant="outline"
        onClick={() =>
          void run(async () => {
            const result = await exportData({ data: { tenantId } });
            const url = URL.createObjectURL(new Blob([result], { type: "application/json" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = `flavourly-${tenantId}-export.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setMessage("Export prepared. Check your browser downloads.");
          })
        }
      >
        Download workspace data
      </Button>
      <p className="text-sm text-destructive">
        Deletion is permanent and affects every member: restaurant profile, messages, guests, menu,
        drafts, queued jobs and local billing records are removed in one transaction. Export first.
        Cancel an active subscription separately before deleting. In-flight sends must finish or be
        reconciled first. A minimal deleted-workspace ID is retained to block stale jobs from
        recreating it. This does not delete your login account, revoke a connected provider account
        or erase provider backups and legally retained external records.
      </p>
      <Label htmlFor="delete-confirmation">
        Type DELETE {tenantId} to confirm workspace deletion
      </Label>
      <Input
        id="delete-confirmation"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        autoComplete="off"
      />
      <Button
        variant="destructive"
        disabled={busy || deleted || !tenantId || confirmation !== `DELETE ${tenantId}`}
        onClick={() => {
          if (
            !window.confirm(
              "Permanently delete this workspace for every member? This cannot be undone.",
            )
          )
            return;
          void run(async () => {
            await deleteData({ data: { tenantId, confirmation } });
            setDeleted(true);
            setMessage(
              "Workspace data deleted. Your login account and external provider accounts were not deleted.",
            );
          });
        }}
      >
        Permanently delete workspace data
      </Button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
