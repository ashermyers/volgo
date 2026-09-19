import { AuthenticateWithRedirectCallback } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sso-callback")({
	component: SSOCallbackPage,
});

function SSOCallbackPage() {
	return <AuthenticateWithRedirectCallback />;
}
