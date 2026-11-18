import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { theme, toggleTheme } = useUIStore();

  return (
    <div className="flex min-h-screen flex-col justify-between bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <Link to="/">
          <BrandLogo />
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      <main className="mx-auto my-8 w-full max-w-md">
        <div className="rounded-lg border border-border bg-surface p-6 shadow-card sm:p-8">
          <div className="mb-6 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-foreground-secondary">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-md text-center text-xs text-foreground-secondary">
        <Link to="/" className="hover:text-foreground transition-colors">
          Back to FlowBoard home
        </Link>
      </footer>
    </div>
  );
}
