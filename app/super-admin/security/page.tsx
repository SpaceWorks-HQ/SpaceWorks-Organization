import { requireSuperAdminMfa } from "@/lib/permissions";
import { loadSuperAdminSecurityView } from "@/lib/views/app__super-admin__security__page";
import { formatShare } from "@/lib/superAdminInsights";
import { AdminPanel, MetricRows, NameCell } from "@/components/super-admin/AdminPanel";
import { AuditTable } from "@/components/super-admin/AuditTable";
import { Chip, EmptyState, PageHeader, StatTile } from "@/components/ui/display";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const ACTION_WINDOW_DAYS = 7;

export default async function SuperAdminSecurityPage() {
  await requireSuperAdminMfa();
  const { mfaUsers, users, managersWithoutMfa, managers, unverifiedUsers, passwordUsers, providerGroups, activeSessions, sortedActions, recentSecurityEvents, platformAdmins } = await loadSuperAdminSecurityView();
  const adminsWithoutMfa = platformAdmins.filter((admin) => !admin.mfaEnabledAt).length;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Security" description="Account protection, sign-in methods, platform admins and sensitive activity across the instance." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile className="rounded-xl" label="Users with MFA" value={formatShare(mfaUsers, users)} hint={`${mfaUsers.toLocaleString()} of ${users.toLocaleString()} users`} progress={{ value: mfaUsers, max: Math.max(users, 1), tone: "success" }} />
        <StatTile className="rounded-xl" label="Owners and admins without MFA" value={managersWithoutMfa.toLocaleString()} hint={`of ${managers.toLocaleString()} owners and admins`} tone={managersWithoutMfa > 0 ? "attention" : "default"} />
        <StatTile className="rounded-xl" label="Unverified email" value={unverifiedUsers.toLocaleString()} hint={`${formatShare(unverifiedUsers, users)} of users`} />
        <StatTile className="rounded-xl" label="Platform admins" value={platformAdmins.length.toLocaleString()} hint={adminsWithoutMfa > 0 ? `${adminsWithoutMfa} without MFA` : "All use MFA"} tone={adminsWithoutMfa > 0 ? "attention" : "default"} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <AdminPanel title="Sign-in methods">
          <MetricRows
            rows={[
              { label: "Users with a password", value: passwordUsers.toLocaleString() },
              ...providerGroups.map((group) => ({ label: `Linked ${group.provider} accounts`, value: group._count._all.toLocaleString() })),
              { label: "Unexpired database sessions", value: activeSessions.toLocaleString() },
            ]}
          />
        </AdminPanel>
        <AdminPanel title={`Sensitive actions (last ${ACTION_WINDOW_DAYS} days)`} description="Access changes, exports, and credential activity from the audit log.">
          {sortedActions.length === 0 ? (
            <EmptyState mood="sleepy">No sensitive actions recorded this week.</EmptyState>
          ) : (
            <MetricRows rows={sortedActions.map((row) => ({ label: <span className="tabular-nums text-sm">{row.action}</span>, value: row._count._all.toLocaleString() }))} />
          )}
        </AdminPanel>
      </div>

      <AdminPanel title="Recent sensitive activity" description="Latest 25 matching audit events. Metadata is redacted; use the Audit log page to search further.">
        <AuditTable events={recentSecurityEvents} label="Recent sensitive activity" empty="No sensitive activity recorded." />
      </AdminPanel>

      <AdminPanel title="Platform admins" description="People granted the platform admin flag. The SUPER_ADMIN_EMAIL account also has access without the flag. Grant or remove it from a user's page.">
        {platformAdmins.length === 0 ? (
          <EmptyState mood="sleepy">No one holds the flag yet. Only the SUPER_ADMIN_EMAIL account can open this panel.</EmptyState>
        ) : (
          <Table label="Platform admins">
            <THead>
              <tr>
                <TH>Person</TH>
                <TH>Email</TH>
                <TH>Two-step verification</TH>
              </tr>
            </THead>
            <TBody>
              {platformAdmins.map((admin) => (
                <TR key={admin.id}>
                  <TD><NameCell href={`/super-admin/users/${admin.id}`} name={admin.name ?? admin.email ?? "Unnamed"} /></TD>
                  <TD className="text-ink-secondary">{admin.email}{admin.emailVerified ? null : <Chip size="sm" tone="warning" className="ml-2">Unverified</Chip>}</TD>
                  <TD><Chip size="sm" tone={admin.mfaEnabledAt ? "success" : "warning"}>{admin.mfaEnabledAt ? "On" : "Off"}</Chip></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </AdminPanel>
    </div>
  );
}
