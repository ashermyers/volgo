import { createFileRoute, Link } from "@tanstack/react-router";

import AppShell from "#/components/app-shell";
import { SignInPrompt } from "#/components/opportunity-card";
import PagePending from "#/components/page-pending";
import ProfileForm from "#/components/profile-form";
import { Button } from "#/components/ui/button";
import { getMyProfileFn } from "#/server/profiles";

export const Route = createFileRoute("/profile")({
	loader: () => getMyProfileFn(),
	pendingComponent: () => <PagePending cards={1} />,
	component: ProfilePage,
});

function ProfilePage() {
	const { isAuthenticated, profile, contact } = Route.useLoaderData();

	return (
		<AppShell>
			<main className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
				<div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
					<div className="max-w-2xl">
						<p className="text-[11px] font-medium tracking-[0.32em] text-primary uppercase">
							How you show up
						</p>
						<h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
							Your profile
						</h1>
						<p className="mt-3 max-w-xl text-base text-muted-foreground">
							Edit the card people see, then save. The preview updates as you
							type.
						</p>
					</div>
					<Button
						render={<Link to="/settings" />}
						nativeButton={false}
						variant="ghost"
					>
						Settings
					</Button>
				</div>

				{!isAuthenticated || !profile || !contact ? (
					<div className="mt-12">
						<SignInPrompt />
					</div>
				) : (
					<div className="mt-10">
						<ProfileForm profile={profile} contact={contact} mode="profile" />
					</div>
				)}
			</main>
		</AppShell>
	);
}
