export type IntentKind = "offer" | "request";

export type MatchInput = {
	postType: IntentKind;
	postSkills: string[];
	postMinutes: number | null;
	userOfferSkills: string[];
	userRequestSkills: string[];
	userMinutes: number | null;
};

function normalizeSkill(skill: string) {
	return skill.trim().toLowerCase();
}

export function sharedSkills(left: string[], right: string[]) {
	const rightSet = new Set(right.map(normalizeSkill));
	const seen = new Set<string>();
	const matches: string[] = [];

	for (const skill of left) {
		const key = normalizeSkill(skill);
		if (!key || seen.has(key) || !rightSet.has(key)) continue;
		seen.add(key);
		matches.push(skill);
	}

	return matches;
}

export function scoreOpportunity(input: MatchInput) {
	const complementarySkills =
		input.postType === "request"
			? input.userOfferSkills
			: input.userRequestSkills;
	const allUserSkills = [...input.userOfferSkills, ...input.userRequestSkills];
	const primarySkills =
		complementarySkills.length > 0 ? complementarySkills : allUserSkills;
	const shared = sharedSkills(primarySkills, input.postSkills);
	const complementary =
		(input.postType === "request" && input.userOfferSkills.length > 0) ||
		(input.postType === "offer" && input.userRequestSkills.length > 0);

	if (primarySkills.length === 0 && input.postSkills.length === 0) {
		return {
			score: complementary ? 28 : 14,
			explanation: complementary
				? "This is the other side of something you already posted."
				: "Open in the community.",
			shared,
		};
	}

	const denominator = Math.max(primarySkills.length, input.postSkills.length, 1);
	let score = Math.round((shared.length / denominator) * 72);

	if (complementary) score += 16;

	if (input.postMinutes && input.userMinutes) {
		const closeness =
			1 - Math.min(1, Math.abs(input.postMinutes - input.userMinutes) / 180);
		score += Math.round(closeness * 12);
	}

	score = Math.max(8, Math.min(99, score));

	let explanation = "A possible fit in the community.";
	if (shared.length >= 2) {
		explanation = `Strong overlap on ${shared.slice(0, 3).join(", ")}.`;
	} else if (shared.length === 1) {
		explanation = `Matches your ${shared[0]} experience.`;
	} else if (complementary) {
		explanation =
			input.postType === "request"
				? "Someone needs help in an area you can serve."
				: "This offer lines up with help you asked for.";
	}

	return { score, explanation, shared };
}
