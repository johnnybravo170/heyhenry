-- Free-text feedback / questions left on a Command Center queue item without
-- resolving it. Appended (timestamped, per author) so a thread accumulates.
-- The morning triage routine reads this to learn; a copy is also posted as a
-- comment on the linked kanban card when one exists.
alter table ops.decision_bundles
  add column if not exists feedback text;
