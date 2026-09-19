import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/tanstack-react-start"

import { Clock3, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { redirect, useNavigate } from "@tanstack/react-router"

export default function Navigation() {
      const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-6">
        {/* Left */}
        <div className="flex items-center justify-start">
          <a href="/" className="flex items-center gap-2 font-semibold">
            <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
              <Clock3 className="size-4" />
            </div>

            <span>VOLGO</span>
          </a>
        </div>

        {/* Center */}
        <nav className="hidden items-center justify-center gap-1 md:flex">
          <Button variant="ghost" >
            <a href="/discover">Discover</a>
          </Button>

          <Button variant="ghost" >
            <a href="/requests">Requests</a>
          </Button>

          <Button variant="ghost" >
            <a href="/impact">Impact</a>
          </Button>
        </nav>

        {/* Right */}
        <div className="flex items-center justify-end gap-3">
          <div className="hidden items-center gap-3 md:flex">
            <Show when="signed-in">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "size-9",
                  },
                }}
              />
            </Show>

            <Show when="signed-out">
                
                <Button variant="ghost" onClick={() => {
                    navigate({to:'/login'})
                }}>
                  Sign in
                </Button>

              
                <Button onClick={() => {
                     navigate({to:'/login'})
                }}>
                  Get started
                </Button>
            </Show>
          </div>

          <div className="md:hidden">
            <Sheet>
              <SheetTrigger >
                <Button size="icon" variant="ghost">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>

              <SheetContent>
                <div className="mt-8 flex flex-col gap-2">
                  <Button variant="ghost" className="justify-start" >
                    <a href="/discover">Discover</a>
                  </Button>

                  <Button variant="ghost" className="justify-start" >
                    <a href="/requests">Requests</a>
                  </Button>

                  <Button variant="ghost" className="justify-start" >
                    <a href="/impact">Impact</a>
                  </Button>

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
                      <Button className="w-full">
                        Get started
                      </Button>
                    </SignUpButton>
                  </Show>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}