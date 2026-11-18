import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { resetPasswordSchema, type ResetPasswordInput } from '@flowboard/shared';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/services/api.service';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: searchParams.get('token') || '',
      password: '',
    },
  });

  const onSubmit = async (values: ResetPasswordInput) => {
    setError(null);
    setLoading(true);
    try {
      await authApi.resetPassword(values);
      toast.success('Password reset successfully. Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Enter your reset token and choose a strong new password."
    >
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
          <label htmlFor="rp-token" className="text-xs font-medium text-foreground-secondary">
            Reset Token
          </label>
          <Input
            id="rp-token"
            placeholder="Paste your reset token"
            className="font-mono text-xs"
            {...form.register('token')}
          />
          {form.formState.errors.token && (
            <p className="text-xs text-red-500">{form.formState.errors.token.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="rp-password" className="text-xs font-medium text-foreground-secondary">
            New Password
          </label>
          <Input
            id="rp-password"
            type="password"
            autoComplete="new-password"
            placeholder="Min 8 chars, uppercase, lowercase & number"
            {...form.register('password')}
          />
          {form.formState.errors.password && (
            <p className="text-xs text-red-500">{form.formState.errors.password.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Updating password...' : 'Reset Password'}
        </Button>

        <p className="text-center text-xs text-foreground-secondary">
          <Link to="/login" className="font-medium text-accent hover:underline">
            Return to sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
