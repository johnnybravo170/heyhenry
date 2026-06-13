'use client';

import { MessageSquare, X } from 'lucide-react';
import { useChatContext } from './chat-provider';

export function ChatToggle() {
  const { isPanelOpen, togglePanel } = useChatContext();

  // bottom-20 keeps the FAB clear of the mobile OwnerBottomNav; md+ has no
  // bottom nav so it drops back to the corner.
  return (
    <button
      type="button"
      onClick={togglePanel}
      aria-label={isPanelOpen ? 'Close chat' : 'Open chat'}
      className="fixed right-4 bottom-20 z-50 flex size-12 items-center justify-center rounded-full bg-[#0a0a0a] text-white shadow-lg transition-transform hover:scale-105 active:scale-95 md:right-6 md:bottom-6 md:size-14 dark:bg-white dark:text-[#0a0a0a]"
    >
      {isPanelOpen ? <X className="size-6" /> : <MessageSquare className="size-6" />}
    </button>
  );
}
