import { SignOutButton } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { Clock3, Eye, EyeOff, MapPin, Sparkles } from "lucide-react";
import { useState } from "react";

import TagInput from "#/components/tag-input";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Switch } from "#/components/ui/switch";
import { Textarea } from "#/components/ui/textarea";
import type { UserProfile } from "#/features/profiles/schema";
import { updateProfileFn } from "#/server/profiles";

function initials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	return parts
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

function formatHours(minutes: number) {
	if (minutes <= 0) return "0 hrs";
	const hours = minutes / 60;
	return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)} hrs`;
}

export default function ProfileForm({
	profile,
	contact,
	mode,
}: {
	profile: UserProfile;
	contact: { phone: string; email: string };
	mode: "profile" | "settings";
}) {
	const [displayName, setDisplayName] = useState(profile.displayName);
	const [bio, setBio] = useState(profile.bio);
	const [skills, setSkills] = useState(profile.skills);
	const [interests, setInterests] = useState(profile.interests);
	const [availability, setAvailability] = useState(profile.availability);
	const [campusArea, setCampusArea] = useState(profile.campusArea);
	const [discoverable, setDiscoverable] = useState(profile.discoverable);
	const [notifyOnInterest, setNotifyOnInterest] = useState(
		profile.notifyOnInterest,
	);
	const [phone, setPhone] = useState(contact.phone);
	const [email, setEmail] = useState(contact.email);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function save() {
		setError(null);
		setSaved(false);
		setSaving(true);

		try {
			await updateProfileFn({
				data: {
					displayName,
					bio,
					skills,
					interests,
					availability,
					campusArea,
					discoverable,
					notifyOnInterest,
					phone,
					email,
				},
			});
			setSaved(true);
		} catch {
			setError("We couldn't save that yet. Please try again.");
		} finally {
			setSaving(false);
		}
	}

	const saveBar = (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<div className="min-h-5 text-sm">
				{error ? (
					<p className="text-destructive" role="alert">
						{error}
					</p>
				) : saved ? (
					<p className="text-muted-foreground">
						Saved. Your public card is up to date.
					</p>
				) : (
					<p className="text-muted-foreground">
						Changes stay on this page until you save.
					</p>
				)}
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Button
					disabled={saving || displayName.trim().length < 2}
					onClick={() => void save()}
				>
					{saving ? "Saving…" : "Save changes"}
				</Button>
				{mode === "settings" ? (
					<SignOutButton>
						<Button variant="ghost">Sign out</Button>
					</SignOutButton>
				) : null}
			</div>
		</div>
	);

	if (mode === "settings") {
		return (
			<div className="space-y-6">
				<div className="space-y-2">
					<Label htmlFor="campusArea">Campus area</Label>
					<Input
						id="campusArea"
						value={campusArea}
						onChange={(event) => setCampusArea(event.target.value)}
						placeholder="Newman, Slusher, downtown…"
					/>
				</div>

				<div className="rounded-2xl border bg-card p-4">
					<p className="text-sm font-medium">Private contact details</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Only people in an accepted match can see these.
					</p>
					<div className="mt-4 grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="contactPhone">Phone</Label>
							<Input
								id="contactPhone"
								type="tel"
								value={phone}
								onChange={(event) => setPhone(event.target.value)}
								autoComplete="tel"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="contactEmail">Email</Label>
							<Input
								id="contactEmail"
								type="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								autoComplete="email"
							/>
						</div>
					</div>
				</div>

				<div className="rounded-2xl border bg-card p-4">
					<div className="flex items-center justify-between gap-4">
						<div>
							<p className="text-sm font-medium">Show me in search</p>
							<p className="text-xs text-muted-foreground">
								People can find your profile when they look for skills.
							</p>
						</div>
						<Switch checked={discoverable} onCheckedChange={setDiscoverable} />
					</div>
					<div className="mt-4 flex items-center justify-between gap-4 border-t pt-4">
						<div>
							<p className="text-sm font-medium">Interest alerts</p>
							<p className="text-xs text-muted-foreground">
								We’ll remember that you want to know when someone reaches out.
							</p>
						</div>
						<Switch
							checked={notifyOnInterest}
							onCheckedChange={setNotifyOnInterest}
						/>
					</div>
				</div>

				{saveBar}
			</div>
		);
	}

	return (
		<div className="grid items-start gap-8 md:grid-cols-[minmax(16rem,19rem)_minmax(0,1fr)] xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
			<aside className="md:sticky md:top-24">
				<div className="overflow-hidden rounded-[1.75rem] border bg-card shadow-sm shadow-foreground/5">
					<div className="relative h-28 bg-primary/12">
						<div className="absolute -top-10 -right-8 size-40 rounded-full bg-primary/25 blur-2xl" />
						<div className="absolute -bottom-12 left-6 size-28 rounded-full bg-primary/15 blur-xl" />
						<p className="absolute top-4 left-5 text-[11px] font-medium tracking-[0.22em] text-primary uppercase">
							Live preview
						</p>
					</div>
					<div className="-mt-10 px-6 pb-6">
						<Avatar className="size-20 border-4 border-card bg-primary text-primary-foreground shadow-md">
							<AvatarFallback className="bg-primary font-heading text-xl font-semibold text-primary-foreground">
								{initials(displayName)}
							</AvatarFallback>
						</Avatar>

						<p className="mt-4 font-heading text-2xl font-semibold tracking-tight">
							{displayName.trim() || "Your name"}
						</p>
						<p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
							<MapPin className="size-3.5 shrink-0" aria-hidden="true" />
							{campusArea.trim() || "Add a campus area"}
						</p>
						<p className="mt-3 line-clamp-4 text-sm leading-6 text-muted-foreground">
							{bio.trim() ||
								"A short note here is how people decide to reach out."}
						</p>

						<div className="mt-4 flex flex-wrap gap-2">
							<Badge
								variant={discoverable ? "secondary" : "outline"}
								className="gap-1.5"
							>
								{discoverable ? (
									<Eye className="size-3" aria-hidden="true" />
								) : (
									<EyeOff className="size-3" aria-hidden="true" />
								)}
								{discoverable ? "Findable in search" : "Hidden from search"}
							</Badge>
							{availability.trim() ? (
								<Badge variant="outline" className="gap-1.5 font-normal">
									<Clock3 className="size-3" aria-hidden="true" />
									{availability}
								</Badge>
							) : null}
						</div>

						{skills.length > 0 ? (
							<div className="mt-5 flex flex-wrap gap-1.5">
								{skills.slice(0, 6).map((skill) => (
									<Badge key={skill} variant="secondary">
										{skill}
									</Badge>
								))}
								{skills.length > 6 ? (
									<Badge variant="outline">+{skills.length - 6}</Badge>
								) : null}
							</div>
						) : (
							<p className="mt-5 text-xs text-muted-foreground">
								Add a few skills to make matching easier.
							</p>
						)}

		
						<Button
							render={
								<Link
									to="/users/$userId"
									params={{ userId: profile.clerkUserId }}
								/>
							}
							nativeButton={false}
							variant="outline"
							className="mt-5 w-full"
						>
							View public profile
						</Button>
					</div>
				</div>
			</aside>

			<div className="space-y-5 pb-2">
				<section className="rounded-[1.75rem] border bg-card p-6 shadow-sm shadow-foreground/5">
					<p className="text-[11px] font-medium tracking-[0.28em] text-primary uppercase">
						About you
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						This is the first thing people read when they consider a match.
					</p>
					<div className="mt-5 grid gap-4">
						<div className="space-y-2">
							<Label htmlFor="displayName">Name</Label>
							<Input
								id="displayName"
								value={displayName}
								onChange={(event) => setDisplayName(event.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="bio">Bio</Label>
							<Textarea
								id="bio"
								value={bio}
								onChange={(event) => setBio(event.target.value)}
								placeholder="What you’re glad to help with around campus."
								className="min-h-28"
							/>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="campusArea">Campus area</Label>
								<Input
									id="campusArea"
									value={campusArea}
									onChange={(event) => setCampusArea(event.target.value)}
									placeholder="Newman, Slusher, downtown…"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="availability">Usual availability</Label>
								<Input
									id="availability"
									value={availability}
									onChange={(event) => setAvailability(event.target.value)}
									placeholder="Weeknights after 6"
								/>
							</div>
						</div>
					</div>
				</section>

				<section className="rounded-[1.75rem] border bg-card p-6 shadow-sm shadow-foreground/5">
					<p className="text-[11px] font-medium tracking-[0.28em] text-primary uppercase">
						How you help
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						Skills get you matched. Interests show what you enjoy giving time
						to.
					</p>
					<div className="mt-5 grid gap-5">
						<div className="space-y-2">
							<Label>Skills</Label>
							<TagInput
								value={skills}
								onChange={setSkills}
								placeholder="Java, calculus, moving…"
							/>
						</div>
						<div className="space-y-2">
							<Label>Interests</Label>
							<TagInput
								value={interests}
								onChange={setInterests}
								placeholder="Tutoring, Linux, cooking…"
							/>
						</div>
					</div>
				</section>

				<section className="rounded-[1.75rem] border bg-card p-6 shadow-sm shadow-foreground/5">
					<div className="flex items-start gap-3">
						<div className="mt-0.5 flex size-9 items-center justify-center rounded-2xl border bg-muted/50">
							<Sparkles className="size-4 text-primary" aria-hidden="true" />
						</div>
						<div className="min-w-0 flex-1">
							<p className="text-sm font-medium">Show me in search</p>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								People can find this card when they look for skills.
							</p>
						</div>
						<Switch checked={discoverable} onCheckedChange={setDiscoverable} />
					</div>
				</section>

				<div className="rounded-[1.75rem] border bg-card px-6 py-4 shadow-sm shadow-foreground/5">
					{saveBar}
				</div>
			</div>
		</div>
	);
}
