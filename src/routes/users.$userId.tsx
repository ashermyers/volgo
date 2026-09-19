import { createFileRoute, Link } from "@tanstack/react-router";

import AppShell from "#/components/app-shell";
import { EmptyState } from "#/components/opportunity-card";
import PageHeader from "#/components/page-header";
import PagePending from "#/components/page-pending";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { getPublicProfileFn } from "#/server/profiles";

export const Route = createFileRoute("/users/$userId")({
	loader: async ({ params }) =>
		getPublicProfileFn({ data: { userId: params.userId } }),
	pendingComponent: () => <PagePending cards={1} />,
	component: PublicProfilePage,
});

function PublicProfilePage() {
	const profile = Route.useLoaderData();
	const { userId } = Route.useParams();

	if (!profile) {
		return (
			<AppShell>
				<main className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
					<EmptyState
						title="This profile isn’t public"
						description="They may have turned search visibility off, or this person hasn’t joined VOLGO yet."
						action={
							<Button
								render={<Link to="/search" />}
								nativeButton={false}
								className="mt-5"
							>
								Back to search
							</Button>
						}
					/>
				</main>
			</AppShell>
		);
	}

	return (
		<AppShell>
			<main className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
				<PageHeader
					kicker={profile.campusArea || "Community member"}
					title={profile.displayName}
					description={
						profile.bio ||
						"This person is part of VOLGO. Skills and recent service show how they like to help."
					}
					actions={
						profile.isSelf ? (
							<Button
								render={<Link to="/profile" />}
								nativeButton={false}
								variant="outline"
							>
								Edit profile
							</Button>
						) : (
							<Button render={<Link to="/" />} nativeButton={false}>
								Offer to help
							</Button>
						)
					}
				/>

				<section className="mt-10 rounded-2xl border bg-card p-6">
					<p className="text-sm font-medium">Skills</p>
					{profile.skills.length > 0 ? (
						<div className="mt-3 flex flex-wrap gap-2">
							{profile.skills.map((skill) => (
								<Badge key={skill} variant="secondary">
									{skill}
								</Badge>
							))}
						</div>
					) : (
						<p className="mt-2 text-sm text-muted-foreground">
							No skills listed yet.
						</p>
					)}

					{profile.interests.length > 0 ? (
						<>
							<p className="mt-6 text-sm font-medium">Interests</p>
							<div className="mt-3 flex flex-wrap gap-2">
								{profile.interests.map((interest) => (
									<Badge key={interest} variant="outline">
										{interest}
									</Badge>
								))}
							</div>
						</>
					) : null}

					{profile.availability ? (
						<p className="mt-6 text-sm text-muted-foreground">
							Usually around: {profile.availability}
						</p>
					) : null}
				</section>

				{profile.recentTitles.length > 0 ? (
					<section className="mt-8">
						<p className="mb-3 text-sm font-medium">Recent posts</p>
						<ul className="space-y-2">
							{profile.recentTitles.map((title) => (
								<li
									key={`${userId}-${title}`}
									className="rounded-xl border bg-card px-4 py-3 text-sm"
								>
									{title}
								</li>
							))}
						</ul>
					</section>
				) : null}
			</main>
		</AppShell>
	);
}
