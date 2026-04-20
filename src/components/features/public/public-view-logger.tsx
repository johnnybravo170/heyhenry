'use client';

import { useEffect } from 'react';
import {
  logChangeOrderViewAction,
  logInvoiceViewAction,
  logPortalViewAction,
  logQuoteViewAction,
} from '@/server/actions/public-views';

type ResourceType = 'change_order' | 'portal' | 'invoice' | 'quote';

export function PublicViewLogger({
  resourceType,
  identifier,
}: {
  resourceType: ResourceType;
  identifier: string;
}) {
  useEffect(() => {
    const key = `public-view-${resourceType}-${identifier}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, String(Date.now()));
    const input = {
      sessionId: sessionStorage.getItem('hh-session') ?? undefined,
      userAgent: navigator.userAgent,
    };
    const run = () => {
      switch (resourceType) {
        case 'change_order':
          return logChangeOrderViewAction(identifier, input);
        case 'portal':
          return logPortalViewAction(identifier, input);
        case 'invoice':
          return logInvoiceViewAction(identifier, input);
        case 'quote':
          return logQuoteViewAction(identifier, input);
      }
    };
    run().catch(() => {});
  }, [resourceType, identifier]);

  return null;
}
