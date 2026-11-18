import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@flowboard/shared';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRegisterMutation } from '@/hooks/useAuth';

export default function RegisterPage() {
  const navigate = useNavigate();
  const registerMutation = useRegisterMutation();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      workspaceName: '',
    },
  });

  const onSubmit = async (values: RegisterInput) => {
    setServerError(null);
    try {
      await registerMutation.mutateAsync({
        ...values,
        workspaceName: values.workspaceName?.trim() || undefined,
      });
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to create account');
    }
  };

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Set up your FlowBoard account and start collaborating in seconds."
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && (
          <div
            role="alert"
            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500"
          >
            {serverError}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="reg-name" className="text-xs font-medium text-foreground-secondary">
            Full Name
          </label>
          <Input
            id="reg-name"
            autoComplete="name"
            placeholder="Jordan Taylor"
            {...form.register('name')}
          />
          {form.formState.errors.name && (
            <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-email" className="text-xs font-medium text-foreground-secondary">
            Work Email
          </label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder="jordan@company.com"
            {...form.register('email')}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-workspace" className="text-xs font-medium text-foreground-secondary">
            Workspace Name (optional)
          </label>
          <Input
            id="reg-workspace"
            placeholder="e.g., Horizon Engineering"
            {...form.register('workspaceName')}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-password" className="text-xs font-medium text-foreground-secondary">
            Password
          </label>
          <Input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            placeholder="Min 8 chars, uppercase, lowercase & number"
            {...form.register('password')}
          />
          {form.formState.errors.password && (
            <p className="text-xs text-red-500">{form.formState.errors.password.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? 'Creating workspace...' : 'Create Account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-foreground-secondary">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
