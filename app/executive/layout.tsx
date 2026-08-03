import ExecutiveGuard from "@/app/components/executive/ExecutiveGuard";
import ExecutiveNavigation from "@/app/components/executive/ExecutiveNavigation";

export default function ExecutiveLayout({ children }: { children: React.ReactNode }) {
  return <ExecutiveGuard><div className="space-y-5"><div className="px-3 pt-5 sm:px-6 lg:px-8"><ExecutiveNavigation /></div>{children}</div></ExecutiveGuard>;
}
