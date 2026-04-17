-- Worker invite codes: single-use, time-limited links owners send to workers.

CREATE TABLE public.worker_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'worker' CHECK (role IN ('worker', 'member')),
    created_by UUID NOT NULL,
    used_by UUID,
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.worker_invites (tenant_id);
CREATE INDEX ON public.worker_invites (code);
