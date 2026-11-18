import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@flowboard/shared';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/services/api.service';

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordInput) => {
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(values);
      setSubmitted(true);
      if (res.devResetToken) setDevToken(res.devResetToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your account email and we will generate a secure reset link."
    >
      {submitted ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-500">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              If an account matches that email address, a one-time password reset token has been
              issued and expires in 30 minutes.
            </p>
          </div>

          {devToken && (
            <div className="rounded-lg border border-border bg-elevated/60 p-3.5 text-xs">
              <p className="font-semibold text-foreground">Local Development Reset Link</p>
              <p className="mt-1 text-foreground-secondary">
                No external SMTP provider is configured locally. Continue directly with your
                generated reset token:
              </p>
              <Button asChild size="sm" className="mt-3 w-full">
                <Link to={`/reset-password?token=${encodeURIComponent(devToken)}`}>
                  Continue to Reset Password
                </Link>
              </Button>
            </div>
          )}

          <Button variant="outline" asChild className="w-full">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500"
            >
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="fp-email" className="text-xs font-medium text-foreground-secondary">
              Account Email
            </label>
            <Input
              id="fp-email"
              type="email"
              placeholder="alex@flowboard.dev"
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Sending reset link...' : 'Send Reset Link'}
          </Button>

          <p className="text-center text-xs text-foreground-secondary">
            Remembered your password?{' '}
            <Link to="/login" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
