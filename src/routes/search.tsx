import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import AppShell from "#/components/app-shell";
import OpportunityCard, { EmptyState } from "#/components/opportunity-card";
import PageHeader from "#/components/page-header";
import PagePending from "#/components/page-pending";
import SegmentedControl from "#/components/segmented-control";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { searchCommunityFn } from "#/server/profiles";

export const Route = createFileRoute("/search")({
	validateSearch: (search: Record<string, unknown>): { q?: string } => ({
		q: typeof search.q === "string" ? search.q : undefined,
	}),
	loaderDeps: ({ search }) => ({ q: search.q ?? "" }),
	loader: ({ deps }) => searchCommunityFn({ data: { query: deps.q } }),
	pendingComponent: () => <PagePending cards={2} />,
	component: SearchPage,
});

function SearchPage() {
	const search = Route.useSearch();
	const q = search.q ?? "";
	const { people, posts, query } = Route.useLoaderData();
	const navigate = Route.useNavigate();
	const [draft, setDraft] = useState(q);
	const [tab, setTab] = useState<"people" | "posts">("people");

	useEffect(() => {
		if (people.length === 0 && posts.length > 0) {
			setTab("posts");
		}
	}, [people.length, posts.length]);

	function runSearch() {
		void navigate({
			to: "/search",
			search: { q: draft.trim() || undefined },
		});
	}

	function submit(event: FormEvent) {
		event.preventDefault();
		runSearch();
	}

	return (
		<AppShell>
			<main className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
				<PageHeader
					kicker="Find people and posts"
					title="Search"
					description="Look up classmates by name or skill, or find an open offer and request."
				/>

				<form onSubmit={submit} className="mt-8 flex gap-2">
					<div className="relative flex-1">
						<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={draft}
							onChange={(event) => setDraft(event.target.value)}
							placeholder="Java, calculus, moving, a name…"
							className="h-10 pl-9"
							aria-label="Search VOLGO"
						/>
					</div>
					<Button type="button" className="h-10" onClick={runSearch}>
						Search
					</Button>
				</form>

				<div className="mt-8">
					<SegmentedControl
						layoutId="search-tab"
						value={tab}
						onChange={setTab}
						options={[
							{ value: "people", label: `People (${people.length})` },
							{ value: "posts", label: `Posts (${posts.length})` },
						]}
					/>
				</div>

				{tab === "people" ? (
					people.length > 0 ? (
						<div className="mt-6 grid gap-3 sm:grid-cols-2">
							{people.map((person) => (
								<Link
									key={person.clerkUserId}
									to="/users/$userId"
									params={{ userId: person.clerkUserId }}
									className="rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/40"
								>
									<p className="font-medium">{person.displayName}</p>
									<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
										{person.bio || "A member of the community."}
									</p>
									{person.skills.length > 0 ? (
										<p className="mt-3 text-xs text-muted-foreground">
											{person.skills.slice(0, 4).join(" · ")}
										</p>
									) : null}
								</Link>
							))}
						</div>
					) : (
						<div className="mt-6">
							<EmptyState
								title={query ? "No people match that" : "Search the community"}
								description={
									query
										? "Try a skill, a first name, or a campus area."
										: "Type a skill or name to find people who can help — or want to."
								}
							/>
						</div>
					)
				) : posts.length > 0 ? (
					<div className="mt-6 grid gap-4 md:grid-cols-2">
						{posts.map((item, index) => (
							<OpportunityCard
								key={item.id}
								item={item}
								index={index}
								person={item.displayName}
								personHref={item.userId}
							/>
						))}
					</div>
				) : (
					<div className="mt-6">
						<EmptyState
							title={query ? "No posts match that" : "Search for a post"}
							description="Try words from a request or offer, like Linux or calculus."
						/>
					</div>
				)}
			</main>
		</AppShell>
	);
}
