"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPlatformAdmin } from "@/app/actions/super-admin-organisations";
import { Button } from "@/components/ui/button";
import { Callout, Card, CardHeader } from "@/components/ui/display";
import { ConfirmDialog } from "@/components/ui/dialog";

/** Grant or remove access to this panel. Removing it also signs the person out everywhere. */
export function PlatformAdminToggle({ userId, isAdmin, isSelf, emailVerified }: { userId: string; isAdmin: boolean; isSelf: boolean; emailVerified: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    startTransition(async () => {
      const result = await setPlatformAdmin({ userId, grant: !isAdmin });
      setConfirming(false);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  };

  const blocked = isSelf && isAdmin ? "You can't remove your own access." : !isAdmin && !emailVerified ? "They need a verified email address first." : null;

  return (
    <Card as="section" className="rounded-xl">
      <CardHeader
        title="Platform admin"
        description={isAdmin ? "Can review organisations and run this instance. Two-step verification is required to open the panel." : "Platform admins review organisations and run this instance."}
      />
      <div className="flex flex-col gap-3">
        {error ? <Callout tone="danger" role="alert">{error}</Callout> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant={isAdmin ? "dangerOutline" : "secondary"} disabled={pending || Boolean(blocked)} onClick={() => setConfirming(true)}>
            {isAdmin ? "Remove platform admin" : "Make platform admin"}
          </Button>
          {blocked ? <span className="text-caption text-ink-muted">{blocked}</span> : null}
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        title={isAdmin ? "Remove platform admin access?" : "Make this person a platform admin?"}
        message={isAdmin ? "They lose access to this panel and are signed out on every device." : "They can approve and suspend organisations, see every user and change instance settings."}
        confirmLabel={isAdmin ? "Remove access" : "Grant access"}
        destructive={isAdmin}
        loading={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={run}
      />
    </Card>
  );
}
