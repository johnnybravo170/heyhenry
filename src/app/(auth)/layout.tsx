import { HeyHenryWordmark } from '@/components/branding/heyhenry-wordmark';

/**
 * Centered auth layout used by login, signup, magic-link, check-email,
 * callback, and the onboarding plan picker. Wordmark above the card,
 * footer below — gives every auth surface a consistent HeyHenry frame
 * instead of dropping the user into a bare form.
 */

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
      <HeyHenryWordmark />
      {/* max-w-md (was max-w-sm) so the onboarding business-profile step has
          room for its labelled fields; login/signup sit comfortably here too. */}
      <div className="w-full max-w-md">{children}</div>
      <p className="text-xs text-muted-foreground">Built for contractors. Made in Canada.</p>
    </div>
  );
}
