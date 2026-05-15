import { MobileNav } from "@/components/layout/mobile-nav"

export default function EcodimLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Main content with bottom padding for mobile nav */}
      <main className="flex-1 pb-[76px] md:pb-0">
        {children}
      </main>
      
      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  )
}
