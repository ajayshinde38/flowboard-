import { cn, getInitials } from '@/lib/utils';

interface UserAvatarProps {
  name: string;
  color?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-6 w-6 text-[11px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export function UserAvatar({ name, color = '#786CFF', size = 'sm', className }: UserAvatarProps) {
  return (
    <span
      title={name}
      aria-label={name}
      style={{ backgroundColor: color || '#786CFF' }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-white/15 select-none',
        SIZE_MAP[size],
        className
      )}
    >
      {getInitials(name)}
    </span>
  );
}
