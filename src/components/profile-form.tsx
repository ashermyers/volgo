import { SignOutButton } from "@clerk/tanstack-react-start";
import { useState } from "react";

import TagInput from "#/components/tag-input";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Switch } from "#/components/ui/switch";
import { Textarea } from "#/components/ui/textarea";
import type { UserProfile } from "#/features/profiles/schema";
import { updateProfileFn } from "#/server/profiles";

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

	return (
		<div className="space-y-6">
			{mode === "profile" ? (
				<>
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
							className="min-h-24"
						/>
					</div>
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
					<div className="space-y-2">
						<Label htmlFor="availability">Usual availability</Label>
						<Input
							id="availability"
							value={availability}
							onChange={(event) => setAvailability(event.target.value)}
							placeholder="Weeknights after 6, Saturday afternoons"
						/>
					</div>
				</>
			) : null}

			<div className="space-y-2">
				<Label htmlFor="campusArea">Campus area</Label>
				<Input
					id="campusArea"
					value={campusArea}
					onChange={(event) => setCampusArea(event.target.value)}
					placeholder="Newman, Slusher, downtown…"
				/>
			</div>

			{mode === "settings" ? (
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
			) : null}

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

			{error ? (
				<p className="text-sm text-destructive" role="alert">
					{error}
				</p>
			) : null}
			{saved ? <p className="text-sm text-muted-foreground">Saved.</p> : null}

			<div className="flex flex-wrap items-center justify-between gap-3">
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
}
