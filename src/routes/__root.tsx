import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRoute,
	HeadContent,
	redirect,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import CelebrationOverlay from "#/components/celebration-overlay";
import { Toaster } from "#/components/ui/toast";
import { getOnboardingStatusFn } from "#/server/profiles";

import ClerkProvider from "../integrations/clerk/provider";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
	beforeLoad: async ({ location }) => {
		const publicPaths = ["/login", "/signup", "/sso-callback", "/onboarding"];
		if (publicPaths.includes(location.pathname)) return;

		const status = await getOnboardingStatusFn();
		if (status.isAuthenticated && !status.completed) {
			throw redirect({ to: "/onboarding" });
		}
	},
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "VOLGO — Time given, community gained",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Static script prevents a theme flash before React hydrates.
					dangerouslySetInnerHTML={{
						__html: `try{const theme=localStorage.getItem("volgo-theme");const dark=theme==="dark"||(!theme&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark)}catch{}`,
					}}
				/>
				<HeadContent />
			</head>
			<body className="antialiased">
				<ClerkProvider>
					<Toaster>
						{children}
						<CelebrationOverlay />
					</Toaster>
					<TanStackDevtools
						config={{
							position: "bottom-right",
						}}
						plugins={[
							{
								name: "Tanstack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
						]}
					/>
				</ClerkProvider>
				<Scripts />
			</body>
		</html>
	);
}
