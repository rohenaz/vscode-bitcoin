import SigmaAvatar from 'sigma-avatars'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface TxAvatarProps {
  txid: string
  size?: number
  className?: string
}

// Use CSS variables for theme colors
const THEME_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)'
]

export function TxAvatar({ txid, size = 32, className }: TxAvatarProps) {
  return (
    <Avatar className={cn("rounded-md", className)} style={{ width: size, height: size }}>
      <SigmaAvatar
        name={txid}
        variant="pixel"
        size={size}
        colors={THEME_COLORS}
      />
    </Avatar>
  )
}
