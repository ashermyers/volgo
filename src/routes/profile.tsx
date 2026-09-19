import { createFileRoute, Link } from "@tanstack/react-router";

import AppShell from "#/components/app-shell";
import { SignInPrompt } from "#/components/opportunity-card";
import PageHeader from "#/components/page-header";
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
	const { isAuthenticated, profile } = Route.useLoaderData();

	return (
		<AppShell>
			<main className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
				<PageHeader
					kicker="How you show up"
					title="Your profile"
					description="Skills, availability, and a short note so people know how you like to serve."
					actions={
						<Button
							render={<Link to="/settings" />}
							nativeButton={false}
							variant="ghost"
						>
							Settings
						</Button>
					}
				/>

				{!isAuthenticated || !profile ? (
					<div className="mt-12">
						<SignInPrompt />
					</div>
				) : (
					<div className="mt-10 rounded-2xl border bg-card p-6">
						<ProfileForm profile={profile} mode="profile" />
					</div>
				)}
			</main>
		</AppShell>
	);
}
