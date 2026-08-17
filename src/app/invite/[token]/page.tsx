import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql } from "drizzle-orm";

import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user-auth/session";
import { SwitchAccountButton } from "./switch-account-button";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/?invite=${encodeURIComponent(token)}`);
  }

  const invite = await db.execute<{
    project_id: string;
    slug: string;
    email: string;
    accepted: boolean;
    expired: boolean;
  }>(sql`
    select
      pi.project_id::text as project_id,
      p.slug,
      lower(pi.email) as email,
      pi.accepted_at is not null as accepted,
      pi.expires_at <= now() as expired
    from project_invitations pi
    join projects p on p.id = pi.project_id
    where pi.token = ${token}
    limit 1
  `);

  const row = invite.rows[0];
  if (!row) notFound();

  const membership = await db.execute<{ exists: boolean }>(sql`
    select exists (
      select 1
      from project_members
      where project_id = ${row.project_id}::uuid
        and user_id = ${user.id}
    ) as exists
  `);

  if (membership.rows[0]?.exists) {
    redirect(`/dashboard/${row.slug}`);
  }

  if (row.email !== user.email.toLowerCase()) {
    return (
      <InviteMessage
        title="Wrong account"
        message={`This invite is for ${row.email}. Sign in with that email to accept it.`}
        token={token}
      />
    );
  }

  if (row.expired) {
    return (
      <InviteMessage
        title="Invite expired"
        message="Ask the project owner to create a new invite link."
      />
    );
  }

  if (row.accepted) {
    return (
      <InviteMessage
        title="Invite already used"
        message="Ask the project owner to create a new invite link if you still need access."
      />
    );
  }

  const accepted = await db.execute<{ slug: string }>(sql`
    with invite as (
      select id, project_id, role, invited_by
      from project_invitations
      where token = ${token}
        and lower(email) = ${user.email.toLowerCase()}
        and accepted_at is null
        and expires_at > now()
      limit 1
    ), member as (
      insert into project_members (project_id, user_id, role, invited_by)
      select project_id, ${user.id}, role, invited_by
      from invite
      on conflict (project_id, user_id) do update
        set role = case
          when project_members.role = 'owner' then 'owner'::project_role
          else excluded.role
        end,
        invited_by = excluded.invited_by
      returning project_id
    ), mark_accepted as (
      update project_invitations pi
      set accepted_at = now()
      from invite
      where pi.id = invite.id
      returning pi.project_id
    )
    select p.slug
    from projects p
    join member m on m.project_id = p.id
    limit 1
  `);

  const slug = accepted.rows[0]?.slug;
  if (!slug) notFound();

  redirect(`/dashboard/${slug}`);
}

function InviteMessage({
  title,
  message,
  token,
}: {
  title: string;
  message: string;
  token?: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-16">
      <main className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
        {token ? (
          <SwitchAccountButton token={token} />
        ) : (
          <Link className={buttonVariants({ variant: "outline" })} href="/">
            Back to sign in
          </Link>
        )}
      </main>
    </div>
  );
}
