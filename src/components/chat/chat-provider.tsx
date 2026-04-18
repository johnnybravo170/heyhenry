'use client';

import { createContext, type ReactNode, useContext } from 'react';
import { type UseHenryReturn, useHenry } from '@/hooks/use-henry';

type ChatContextValue = UseHenryReturn;

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const henry = useHenry();
  return <ChatContext.Provider value={henry}>{children}</ChatContext.Provider>;
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
}
