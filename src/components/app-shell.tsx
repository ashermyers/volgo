import type { ReactNode } from "react";

import Navigation from "#/components/navigation";
import SiteFooter from "#/components/site-footer";

export default function AppShell({ children }: { children: ReactNode }) {
	return (
		<div className="relative flex min-h-screen flex-col bg-background text-foreground">
			<div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,var(--primary)/9%,transparent_58%)]" />
			<div className="relative flex flex-1 flex-col">
				<Navigation />
				<div className="flex-1">{children}</div>
				<SiteFooter />
			</div>
		</div>
	);
}
