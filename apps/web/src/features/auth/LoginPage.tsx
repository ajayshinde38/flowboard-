import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@flowboard/shared';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLoginMutation } from '@/hooks/useAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const loginMutation = useLoginMutation();
  const [serverError, setServerError] = useState<string | null>(null);

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ||
    '/app/dashboard';

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);
    try {
      await loginMutation.mutateAsync(values);
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to sign in');
    }
  };

  const handleDemoLogin = async () => {
    form.setValue('email', 'ajay', { shouldValidate: true });
    form.setValue('password', 'ajay', { shouldValidate: true });
    await onSubmit({ email: 'ajay', password: 'ajay' });
  };

  const fillDemoCredentials = () => {
    form.setValue('email', 'ajay', { shouldValidate: true });
    form.setValue('password', 'ajay', { shouldValidate: true });
  };

  return (
    <AuthLayout
      title="Sign in to FlowBoard"
      subtitle="Enter your email or demo username to continue."
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-400"
          >
            {serverError}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="login-email" className="text-xs font-medium text-foreground">
            Email or Demo Username
          </label>
          <Input
            id="login-email"
            type="text"
            autoComplete="username"
            placeholder="you@example.com or ajay"
            {...form.register('email')}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-xs font-medium text-foreground">
              Password
            </label>
            <Link to="/forgot-password" className="text-xs font-medium text-accent hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            {...form.register('password')}
          />
          {form.formState.errors.password && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
        </Button>

        {/* Isolated Demo Account Box */}
        <div className="mt-4 rounded-md border border-border bg-background p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-foreground">Demo Account</p>
              <p className="mt-0.5 text-[11px] text-foreground-secondary">
                Username: <code className="font-mono font-medium text-foreground">ajay</code> ·
                Password: <code className="font-mono font-medium text-foreground">ajay</code>
              </p>
            </div>
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="text-xs font-medium text-accent hover:underline"
            >
              Fill Demo
            </button>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3 w-full"
            disabled={loginMutation.isPending}
            onClick={() => void handleDemoLogin()}
          >
            Try Demo
          </Button>
          <p className="mt-2 text-[11px] text-foreground-secondary">
            Uses an isolated, non-privileged demo workspace with sample projects and tasks.
          </p>
        </div>
      </form>

      <p className="mt-6 text-center text-xs text-foreground-secondary">
        New to FlowBoard?{' '}
        <Link to="/register" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
