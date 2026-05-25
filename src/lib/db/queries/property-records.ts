/**
 * Property Record queries + the canonical snapshot shape. Slice 6a of the
 * Customer Portal & Property Record build.
 *
 * The snapshot is a denormalized copy of the project at close-out time,
 * plus contractor / customer / project header info. It powers the
 * permanent `/property-record/<slug>` page and (in Slice 6b/c) the PDF and
 * ZIP exports.
 *
 * Storage paths are stored as-is; URLs are re-signed at render time.
 * See migration 0127 header for the durability caveat.
 */

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { PortalPhotoTag } from '@/lib/validators/portal-photo';
import type { DocumentType } from '@/lib/validators/project-document';
import type { SelectionCategory } from '@/lib/validators/project-selection';

export type PropertyRecordSnapshotV1 = {
  version: 1;
  generated_at: string;
  /**
   * IANA timezone the contractor's tenant was set to at generation time.
   * The Property Record is a permanent artifact — dates are rendered in the
   * tz that was active when the snapshot was frozen, so the document
   * doesn't shift if the contractor later relocates the business.
   *
   * Optional for backwards compatibility with snapshots written before
   * 2026-05-08; readers should fall back to 'America/Vancouver' when
   * absent. New snapshots always set it.
   */
  timezone?: string;
  contractor: {
    name: string;
    /** Storage path in the photos bucket — re-signed at render time. */
    logo_storage_path: string | null;
  };
  customer: {
    name: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
  project: {
    name: string;
    description: string | null;
    start_date: string | null;
    target_end_date: string | null;
  };
  /**
   * The operator-approved ✦ Henry closeout summary — a warm one-paragraph
   * project narrative that renders at the top of the public artifact as
   * plain prose (Henry is invisible client-side). NULL until the operator
   * approves a draft ("Keep"); persisted on the property_records row so it
   * survives regeneration (see migration 20260524015042). Optional for
   * backwards compatibility with snapshots written before that migration.
   */
  summary?: string | null;
  phases: Array<{
    /** Stable id from project_phases — lets photos.phase_id resolve to
     *  a snapshot phase row even though the rest of the snapshot is
     *  denormalized. */
    id: string;
    name: string;
    status: 'upcoming' | 'in_progress' | 'complete';
    started_at: string | null;
    completed_at: string | null;
  }>;
  selections: Array<{
    room: string;
    category: SelectionCategory;
    brand: string | null;
    name: string | null;
    code: string | null;
    finish: string | null;
    supplier: string | null;
    sku: string | null;
    warranty_url: string | null;
    notes: string | null;
    allowance_cents: number | null;
    actual_cost_cents: number | null;
  }>;
  photos: Array<{
    id: string;
    storage_path: string;
    caption: string | null;
    portal_tags: PortalPhotoTag[];
    taken_at: string | null;
    /** Optional pin to a phase — populated when the photo was attached
     *  to a project_phases row at snapshot time. */
    phase_id: string | null;
  }>;
  documents: Array<{
    type: DocumentType;
    title: string;
    storage_path: string;
    bytes: number | null;
    expires_at: string | null;
  }>;
  decisions: Array<{
    label: string;
    description: string | null;
    decided_value: string | null;
    decided_at: string | null;
    decided_by_customer: string | null;
  }>;
  change_orders: Array<{
    title: string;
    description: string;
    cost_impact_cents: number;
    timeline_impact_days: number;
    approved_at: string | null;
    approved_by_name: string | null;
  }>;
};

export type PropertyRecordRow = {
  id: string;
  project_id: string;
  slug: string;
  snapshot: PropertyRecordSnapshotV1;
  generated_at: string;
  pdf_path: string | null;
  zip_path: string | null;
  emailed_at: string | null;
  emailed_to: string | null;
  /** Operator-approved Henry closeout summary (durable across regen). */
  henry_summary: string | null;
  /** TRUE once the operator approves the Henry draft ("Keep"). */
  henry_summary_approved: boolean;
};

/**
 * RLS-aware fetch — used by the operator's project detail page to know
 * whether a record exists yet ("Generate" vs "View / Regenerate").
 */
export const getPropertyRecordForProject = cache(
  async (projectId: string): Promise<PropertyRecordRow | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('property_records')
      .select(
        'id, project_id, slug, snapshot, generated_at, pdf_path, zip_path, emailed_at, emailed_to, henry_summary, henry_summary_approved',
      )
      .eq('project_id', projectId)
      .maybeSingle();
    return (data as unknown as PropertyRecordRow) ?? null;
  },
);
