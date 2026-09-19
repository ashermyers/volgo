import { createFileRoute, Link } from "@tanstack/react-router";

import AppShell from "#/components/app-shell";
import { SignInPrompt } from "#/components/opportunity-card";
import PageHeader from "#/components/page-header";
import PagePending from "#/components/page-pending";
import ProfileForm from "#/components/profile-form";
import { Button } from "#/components/ui/button";
import { getMyProfileFn } from "#/server/profiles";

export const Route = createFileRoute("/settings")({
	loader: () => getMyProfileFn(),
	pendingComponent: () => <PagePending cards={1} />,
	component: SettingsPage,
});

function SettingsPage() {
	const { isAuthenticated, profile, contact } = Route.useLoaderData();

	return (
		<AppShell>
			<main className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
				<PageHeader
					kicker="Account"
					title="Settings"
					description="Search visibility, interest alerts, and how you appear in the community."
					actions={
						<Button
							render={<Link to="/profile" />}
							nativeButton={false}
							variant="ghost"
						>
							Edit profile
						</Button>
					}
				/>

				{!isAuthenticated || !profile || !contact ? (
					<div className="mt-12">
						<SignInPrompt />
					</div>
				) : (
					<div className="mt-10 rounded-2xl border bg-card p-6">
						<ProfileForm profile={profile} contact={contact} mode="settings" />
					</div>
				)}
			</main>
		</AppShell>
	);
}
