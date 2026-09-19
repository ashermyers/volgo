import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowRight,
	Check,
	FileText,
	ShieldCheck,
	Sparkles,
	Upload,
} from "lucide-react";
import { useState } from "react";

import AppShell from "#/components/app-shell";
import { SignInPrompt } from "#/components/opportunity-card";
import PagePending from "#/components/page-pending";
import TagInput from "#/components/tag-input";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Textarea } from "#/components/ui/textarea";
import {
	completeOnboardingFn,
	getOnboardingStateFn,
	summarizeResumeFn,
} from "#/server/profiles";

export const Route = createFileRoute("/onboarding")({
	loader: () => getOnboardingStateFn(),
	pendingComponent: () => <PagePending cards={1} />,
	component: OnboardingPage,
});

function fileToBase64(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error("The file could not be read"));
		reader.onload = () => {
			const result = String(reader.result);
			resolve(result.includes(",") ? result.split(",")[1] : result);
		};
		reader.readAsDataURL(file);
	});
}

function mergeTags(current: string[], suggested: string[]) {
	const values = new Map<string, string>();
	for (const value of [...current, ...suggested]) {
		const trimmed = value.trim();
		if (trimmed) values.set(trimmed.toLowerCase(), trimmed);
	}
	return [...values.values()].slice(0, 12);
}

function OnboardingPage() {
	const state = Route.useLoaderData();
	const navigate = useNavigate();
	const [step, setStep] = useState<1 | 2>(1);
	const [displayName, setDisplayName] = useState(
		state.profile?.displayName ?? "",
	);
	const [bio, setBio] = useState(state.profile?.bio ?? "");
	const [skills, setSkills] = useState(state.profile?.skills ?? []);
	const [interests, setInterests] = useState(state.profile?.interests ?? []);
	const [availability, setAvailability] = useState(
		state.profile?.availability ?? "",
	);
	const [campusArea, setCampusArea] = useState(state.profile?.campusArea ?? "");
	const [phone, setPhone] = useState(state.contact?.phone ?? "");
	const [email, setEmail] = useState(state.contact?.email ?? "");
	const [saving, setSaving] = useState(false);
	const [isSummarizing, setIsSummarizing] = useState(false);
	const [resumeImported, setResumeImported] = useState(state.resumeImported);
	const [resumeName, setResumeName] = useState("");
	const [error, setError] = useState<string | null>(null);

	if (!state.isAuthenticated || !state.profile || !state.contact) {
		return (
			<AppShell>
				<main className="mx-auto w-full max-w-xl px-6 py-16">
					<SignInPrompt />
				</main>
			</AppShell>
		);
	}

	const profileReady =
		displayName.trim().length >= 2 &&
		skills.length > 0 &&
		resumeImported &&
		!isSummarizing;
	const contactReady = phone.trim().length > 0 || email.trim().length > 0;

	async function importResume(file: File) {
		setError(null);
		setResumeName(file.name);

		const isPdf =
			file.type === "application/pdf" ||
			file.name.toLowerCase().endsWith(".pdf");
		const isText =
			file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
		if (!isPdf && !isText) {
			setError("Upload a PDF or plain-text resume.");
			return;
		}
		if (file.size > 5_000_000) {
			setError("Resume files must be 5 MB or smaller.");
			return;
		}

		setIsSummarizing(true);
		try {
			const summary = await summarizeResumeFn({
				data: {
					name: file.name,
					mimeType: isPdf ? "application/pdf" : "text/plain",
					base64: await fileToBase64(file),
				},
			});
			setBio(summary.bio);
			setSkills((current) => mergeTags(current, summary.skills));
			setInterests((current) => mergeTags(current, summary.interests));
			setResumeImported(true);
		} catch {
			setResumeImported(false);
			setError(
				"We couldn't summarize that resume. Try a text-based PDF or TXT file.",
			);
		} finally {
			setIsSummarizing(false);
		}
	}

	async function finish() {
		if (!profileReady || !contactReady || saving) return;
		setSaving(true);
		setError(null);

		try {
			await completeOnboardingFn({
				data: {
					displayName,
					bio,
					skills,
					interests,
					availability,
					campusArea,
					phone,
					email,
				},
			});
			await navigate({ to: "/" });
		} catch {
			setError("We couldn't finish setup yet. Please check your details.");
			setSaving(false);
		}
	}

	return (
		<AppShell>
			<main className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
				<div className="mb-8">
					<p className="text-sm font-medium text-primary">Welcome to VOLGO</p>
					<h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
						{step === 1
							? "How can you show up?"
							: "How should a match reach you?"}
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						{step === 1
							? "Start with your resume, then review the profile we draft."
							: "This stays private until you accept a match."}
					</p>
					<div
						className="mt-5 grid grid-cols-2 gap-2"
						role="progressbar"
						aria-label="Setup progress"
						aria-valuemin={1}
						aria-valuemax={2}
						aria-valuenow={step}
					>
						<div className="h-1.5 rounded-full bg-primary" />
						<div
							className={
								step === 2
									? "h-1.5 rounded-full bg-primary"
									: "h-1.5 rounded-full bg-muted"
							}
						/>
					</div>
				</div>

				<div className="rounded-2xl border bg-card p-6 shadow-sm">
					{step === 1 ? (
						<div className="space-y-5">
							<div className="rounded-xl border bg-muted/30 p-4">
								<div className="flex items-start gap-3">
									<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background">
										{resumeImported ? (
											<FileText className="size-5 text-primary" />
										) : (
											<Sparkles className="size-5 text-primary" />
										)}
									</div>
									<div className="min-w-0 flex-1">
										<p className="text-sm font-medium">Upload your resume</p>
										<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
											We’ll draft your bio, skills, and interests for you to
											review using Gemini. The original file is not retained.
										</p>
										<Input
											id="resume-upload"
											type="file"
											accept=".pdf,.txt,application/pdf,text/plain"
											className="sr-only"
											disabled={isSummarizing}
											onChange={(event) => {
												const file = event.target.files?.[0];
												if (file) void importResume(file);
											}}
										/>
										<div className="mt-3 flex flex-wrap items-center gap-3">
											<Button
												render={<Label htmlFor="resume-upload" />}
												nativeButton={false}
												variant="outline"
												size="sm"
												className="cursor-pointer gap-2"
											>
												<Upload className="size-4" />
												{resumeImported ? "Replace resume" : "Choose resume"}
											</Button>
											{isSummarizing ? (
												<span className="text-xs text-muted-foreground">
													Reading and summarizing…
												</span>
											) : resumeImported ? (
												<span className="truncate text-xs text-primary">
													{resumeName || "Resume summarized"}
												</span>
											) : (
												<span className="text-xs text-muted-foreground">
													PDF or TXT · 5 MB max
												</span>
											)}
										</div>
									</div>
								</div>
							</div>
							{error ? (
								<p className="text-sm text-destructive" role="alert">
									{error}
								</p>
							) : null}
							<div className="space-y-2">
								<Label htmlFor="onboarding-name">Name</Label>
								<Input
									id="onboarding-name"
									value={displayName}
									onChange={(event) => setDisplayName(event.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="onboarding-bio">A short introduction</Label>
								<Textarea
									id="onboarding-bio"
									value={bio}
									onChange={(event) => setBio(event.target.value)}
									placeholder="What are you glad to help with?"
									className="min-h-24"
								/>
							</div>
							<div className="space-y-2">
								<Label>Skills</Label>
								<TagInput
									value={skills}
									onChange={setSkills}
									placeholder="Add at least one skill"
								/>
							</div>
							<div className="space-y-2">
								<Label>Interests</Label>
								<TagInput
									value={interests}
									onChange={setInterests}
									placeholder="Tutoring, hiking, cooking…"
								/>
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="onboarding-availability">Availability</Label>
									<Input
										id="onboarding-availability"
										value={availability}
										onChange={(event) => setAvailability(event.target.value)}
										placeholder="Weeknights after 6"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="onboarding-area">Campus area</Label>
									<Input
										id="onboarding-area"
										value={campusArea}
										onChange={(event) => setCampusArea(event.target.value)}
										placeholder="Newman Library"
									/>
								</div>
							</div>
							<Button
								className="w-full gap-2"
								disabled={!profileReady}
								onClick={() => setStep(2)}
							>
								Continue
								<ArrowRight className="size-4" />
							</Button>
						</div>
					) : (
						<div className="space-y-5">
							<div className="rounded-xl border bg-muted/40 p-4">
								<div className="flex gap-3">
									<ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
									<div>
										<p className="text-sm font-medium">
											Shared only after acceptance
										</p>
										<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
											People browsing VOLGO cannot see this. Contact details are
											revealed only to the person in an accepted match.
										</p>
									</div>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="onboarding-phone">Phone number</Label>
								<Input
									id="onboarding-phone"
									type="tel"
									value={phone}
									onChange={(event) => setPhone(event.target.value)}
									placeholder="(540) 555-0123"
									autoComplete="tel"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="onboarding-email">Email</Label>
								<Input
									id="onboarding-email"
									type="email"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									placeholder="you@vt.edu"
									autoComplete="email"
								/>
							</div>
							<p className="text-xs text-muted-foreground">
								Add at least one way for your match to contact you.
							</p>
							{error ? (
								<p className="text-sm text-destructive" role="alert">
									{error}
								</p>
							) : null}
							<div className="flex gap-3">
								<Button
									variant="outline"
									className="gap-2"
									onClick={() => setStep(1)}
								>
									<ArrowLeft className="size-4" />
									Back
								</Button>
								<Button
									className="flex-1 gap-2"
									disabled={!contactReady || saving}
									onClick={() => void finish()}
								>
									<Check className="size-4" />
									{saving ? "Finishing…" : "Finish setup"}
								</Button>
							</div>
						</div>
					)}
				</div>
			</main>
		</AppShell>
	);
}
