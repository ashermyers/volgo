import {
	Show,
	SignInButton,
	SignUpButton,
	UserButton,
} from "@clerk/tanstack-react-start";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
	CircleUser,
	Menu,
	Moon,
	Search,
	Settings,
	Sun,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import NotificationCenter from "#/components/notification-center";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const links = [
	{ to: "/discover", label: "Discover" },
	{ to: "/requests", label: "Requests" },
	{ to: "/leaderboard", label: "Leaders" },
	{ to: "/audit", label: "Audit" },
	{ to: "/impact", label: "Impact" },
] as const;

function ThemeToggle({ mobile = false }: { mobile?: boolean }) {
	const [isDark, setIsDark] = useState(false);

	useEffect(() => {
		setIsDark(document.documentElement.classList.contains("dark"));
	}, []);

	function toggleTheme() {
		const nextIsDark = !document.documentElement.classList.contains("dark");
		document.documentElement.classList.toggle("dark", nextIsDark);
		localStorage.setItem("volgo-theme", nextIsDark ? "dark" : "light");
		setIsDark(nextIsDark);
	}

	const label = isDark ? "Switch to light mode" : "Switch to dark mode";

	return (
		<Button
			size={mobile ? "default" : "icon"}
			variant="ghost"
			className={mobile ? "w-full justify-start" : undefined}
			onClick={toggleTheme}
			aria-label={label}
			title={label}
		>
			{isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
			{mobile ? <span>{isDark ? "Light mode" : "Dark mode"}</span> : null}
		</Button>
	);
}

export default function Navigation() {
	const navigate = useNavigate();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		<header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
			<div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-6">
				<div className="flex items-center justify-start">
					<Link
						to="/"
						className="flex items-center gap-2.5 font-heading text-[15px] font-semibold tracking-tight"
					>
						<img src="https://storage.volgo.org/VOLGO.png" alt="VOLGO" className="h-13 w-auto" />
					</Link>
				</div>

				<nav className="hidden items-center justify-center gap-1 md:flex">
					{links.map((link) => {
						const active = pathname === link.to;

						return (
							<Link
								key={link.to}
								to={link.to}
								className={cn(
									buttonVariants({ variant: "ghost" }),
									"relative",
									active ? "text-foreground" : "text-muted-foreground",
								)}
							>
								{active ? (
									<motion.span
										layoutId="nav-pill"
										className="absolute inset-0 rounded-lg bg-muted"
										transition={{ type: "spring", stiffness: 420, damping: 34 }}
									/>
								) : null}
								<span className="relative z-10">{link.label}</span>
							</Link>
						);
					})}
				</nav>

				<div className="flex items-center justify-end gap-2">
					<Show when="signed-in">
						<NotificationCenter />
					</Show>
					<div className="hidden items-center gap-2 md:flex">
						<ThemeToggle />
						<Button
							size="icon"
							variant="ghost"
							render={<Link to="/search" />}
							nativeButton={false}
							aria-label="Search"
						>
							<Search className="size-4" />
						</Button>

						<Show when="signed-in">
							<Button
								size="icon"
								variant="ghost"
								render={<Link to="/profile" />}
								nativeButton={false}
								aria-label="Profile"
							>
								<CircleUser className="size-4" />
							</Button>
							{/* <Button
								size="icon"
								variant="ghost"
								render={<Link to="/settings" />}
								nativeButton={false}
								aria-label="Settings"
							>
								<Settings className="size-4" />
							</Button> */}
							{/* <UserButton
								appearance={{
									elements: {
										avatarBox: "size-9",
									},
								}}
							/> */}
						</Show>

						<Show when="signed-out">
							<Button
								variant="ghost"
								onClick={() => {
									void navigate({ to: "/login" });
								}}
							>
								Sign in
							</Button>

							<Button
								onClick={() => {
									void navigate({ to: "/login" });
								}}
							>
								Get started
							</Button>
						</Show>
					</div>

					<div className="md:hidden">
						<Sheet>
							<SheetTrigger render={<Button size="icon" variant="ghost" />}>
								<Menu className="size-5" />
							</SheetTrigger>

							<SheetContent>
								<div className="mt-8 flex flex-col gap-2">
									{links.map((link) => (
										<Link
											key={link.to}
											to={link.to}
											className={cn(
												buttonVariants({
													variant: "ghost",
													className: "justify-start",
												}),
												pathname === link.to
													? "bg-muted text-foreground"
													: "text-muted-foreground",
											)}
										>
											{link.label}
										</Link>
									))}
									<Link
										to="/search"
										className={cn(
											buttonVariants({
												variant: "ghost",
												className: "justify-start",
											}),
											pathname === "/search"
												? "bg-muted text-foreground"
												: "text-muted-foreground",
										)}
									>
										Search
									</Link>
									<ThemeToggle mobile />
									<Link
										to="/profile"
										className={cn(
											buttonVariants({
												variant: "ghost",
												className: "justify-start",
											}),
											pathname === "/profile"
												? "bg-muted text-foreground"
												: "text-muted-foreground",
										)}
									>
										Profile
									</Link>
									{/* <Link
										to="/settings"
										className={cn(
											buttonVariants({
												variant: "ghost",
												className: "justify-start",
											}),
											pathname === "/settings"
												? "bg-muted text-foreground"
												: "text-muted-foreground",
										)}
									>
										Settings
									</Link> */}

									<div className="my-2 border-t" />

									<Show when="signed-in">
										<div className="flex items-center gap-3 px-3 py-2">
											<UserButton
												appearance={{
													elements: {
														avatarBox: "size-9",
													},
												}}
											/>
											<span className="text-sm font-medium">Account</span>
										</div>
									</Show>

									<Show when="signed-out">
										<SignInButton>
											<Button variant="outline" className="w-full">
												Sign in
											</Button>
										</SignInButton>

										<SignUpButton>
											<Button className="w-full">Get started</Button>
										</SignUpButton>
									</Show>
								</div>
							</SheetContent>
						</Sheet>
					</div>
				</div>
			</div>
		</header>
	);
}
