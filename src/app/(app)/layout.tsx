import { requirePageUser } from '@/server/auth/guards';
import { AppNav } from '@/components/app-nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();

  return (
    <div className="min-h-dvh">
      <AppNav displayName={user.displayName} />
      <main id="main" className="container max-w-6xl space-y-5 py-5 pb-24 md:pb-10">
        {children}
      </main>
    </div>
  );
}
