import type { ReactNode } from "react";

import Navigation from "#/components/navigation";

export default function AppShell({ children }: { children: ReactNode }) {
	return (
		<div className="relative min-h-screen bg-background text-foreground">
			<div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,var(--primary)/9%,transparent_58%)]" />
			<div className="relative">
				<Navigation />
				{children}
			</div>
		</div>
	);
}
