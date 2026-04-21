-- Step 2 of photo favorites: AI-scored "great shot" hint.
--
-- Henry scores each photo for showcase-worthiness (0-1) during the normal
-- classification pass and writes a one-line reason. The gallery surfaces a
-- sparkle chip when the score is high and the photo isn't already a
-- favorite, nudging the operator to add it to their showcase.

ALTER TABLE public.photos
    ADD COLUMN IF NOT EXISTS ai_showcase_score NUMERIC(4, 3),
    ADD COLUMN IF NOT EXISTS ai_showcase_reason TEXT;
