-- Add sort_order column to subtopics table for reordering lessons
ALTER TABLE subtopics ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Update sort_order based on created_at for existing records
UPDATE subtopics 
SET sort_order = EXTRACT(EPOCH FROM created_at)::INTEGER
WHERE sort_order = 0;

-- Create index for faster sorting queries
CREATE INDEX IF NOT EXISTS idx_subtopics_sort_order ON subtopics(sort_order);

-- Add sort_order to subtopic_points for ordering points within lessons
ALTER TABLE subtopic_points ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Update sort_order based on existing sort_order if it exists, otherwise by created_at
UPDATE subtopic_points 
SET sort_order = COALESCE(sort_order, 0)
WHERE sort_order = 0;

-- If no sort_order exists, update from created_at
UPDATE subtopic_points sp
SET sort_order = COALESCE(
    (SELECT sort_order FROM subtopic_points WHERE id = sp.id),
    EXTRACT(EPOCH FROM sp.created_at)::INTEGER
);

CREATE INDEX IF NOT EXISTS idx_subtopic_points_sort_order ON subtopic_points(sort_order);