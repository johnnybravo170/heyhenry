'use client';

/**
 * Narrow-viewport tab picker for the project detail page. Rendered below
 * the `lg` breakpoint; the desktop row of links stays a server render.
 */

import { useRouter } from 'next/navigation';

export function ProjectTabSelect({
  projectId,
  currentTab,
  tabs,
}: {
  projectId: string;
  currentTab: string;
  tabs: { key: string; label: string }[];
}) {
  const router = useRouter();
  return (
    <select
      value={currentTab}
      onChange={(e) => router.push(`/projects/${projectId}?tab=${e.target.value}`)}
      className="w-full rounded-md border bg-background px-3 py-2 text-sm font-medium"
    >
      {tabs.map((t) => (
        <option key={t.key} value={t.key}>
          {t.label}
        </option>
      ))}
    </select>
  );
}
