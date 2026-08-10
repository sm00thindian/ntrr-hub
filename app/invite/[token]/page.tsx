import Link from "next/link";
import { redirect } from "next/navigation";

import { AcceptInviteForm } from "@/components/family/accept-invite-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getInviteByToken } from "@/lib/households/queries";
import { createClient } from "@/lib/supabase/server";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    return (
      <main className="safe-top safe-bottom flex min-h-dvh items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invite not found</CardTitle>
            <CardDescription>This invite link is invalid or no longer available.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">Go home</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (invite.acceptedAt) {
    redirect("/dashboard");
  }

  if (invite.revokedAt || invite.isExpired) {
    return (
      <main className="safe-top safe-bottom flex min-h-dvh items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invite unavailable</CardTitle>
            <CardDescription>
              {invite.revokedAt
                ? "This invite has been revoked."
                : "This invite has expired. Ask for a new one."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`/login?next=/invite/${token}`);
  }

  return (
    <main className="safe-top safe-bottom flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join {invite.householdName}</CardTitle>
          <CardDescription>
            You&apos;ve been invited to coordinate care together in Hub.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AcceptInviteForm
            token={token}
            householdName={invite.householdName}
            email={invite.email}
            role={invite.role}
            persona={invite.persona}
            userEmail={user.email}
          />
        </CardContent>
      </Card>
    </main>
  );
}