import { SignUp } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/signup")({
	component: SignUpPage,
});

function SignUpPage() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background">
			<SignUp signInUrl="/login" routing="hash" />
		</div>
	);
}
