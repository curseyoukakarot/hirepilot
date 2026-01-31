-- Kanban boards (boards/lists/cards + labels, links, members, comments)
-- Safe additive migration

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kanban_member_role') THEN
    CREATE TYPE kanban_member_role AS ENUM ('owner', 'editor', 'commenter', 'viewer');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kanban_member_type') THEN
    CREATE TYPE kanban_member_type AS ENUM ('user', 'guest');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kanban_assignee_type') THEN
    CREATE TYPE kanban_assignee_type AS ENUM ('user', 'guest');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kanban_entity_type') THEN
    CREATE TYPE kanban_entity_type AS ENUM ('lead', 'candidate', 'opportunity', 'table_row');
  END IF;
END $$;

-- Boards
CREATE TABLE IF NOT EXISTS public.kanban_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  board_type text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

-- Lists
CREATE TABLE IF NOT EXISTS public.kanban_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 1,
  color text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

-- Cards
CREATE TABLE IF NOT EXISTS public.kanban_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.kanban_lists(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  description text,
  due_at timestamptz,
  start_at timestamptz,
  cover_color text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

-- Labels
CREATE TABLE IF NOT EXISTS public.kanban_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Card labels
CREATE TABLE IF NOT EXISTS public.kanban_card_labels (
  card_id uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.kanban_labels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, label_id)
);

-- Card assignees
CREATE TABLE IF NOT EXISTS public.kanban_card_assignees (
  card_id uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  assignee_type kanban_assignee_type NOT NULL DEFAULT 'user',
  assignee_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, assignee_type, assignee_id)
);

-- Comments
CREATE TABLE IF NOT EXISTS public.kanban_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  author_type kanban_assignee_type NOT NULL DEFAULT 'user',
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Card links
CREATE TABLE IF NOT EXISTS public.kanban_card_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  entity_type kanban_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, entity_type, entity_id)
);

-- Board members
CREATE TABLE IF NOT EXISTS public.kanban_board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  member_type kanban_member_type NOT NULL DEFAULT 'user',
  member_id uuid NOT NULL,
  role kanban_member_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, member_type, member_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kanban_boards_workspace ON public.kanban_boards(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kanban_lists_board ON public.kanban_lists(board_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_board ON public.kanban_cards(board_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_list ON public.kanban_cards(list_id);
CREATE INDEX IF NOT EXISTS idx_kanban_board_members_board ON public.kanban_board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_kanban_board_members_member ON public.kanban_board_members(member_id);
CREATE INDEX IF NOT EXISTS idx_kanban_card_links_entity ON public.kanban_card_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_kanban_comments_card ON public.kanban_comments(card_id);
CREATE INDEX IF NOT EXISTS idx_kanban_labels_board ON public.kanban_labels(board_id);
CREATE INDEX IF NOT EXISTS idx_kanban_card_labels_label ON public.kanban_card_labels(label_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_board_position ON public.kanban_cards(board_id, position);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_list_position ON public.kanban_cards(list_id, position);
CREATE INDEX IF NOT EXISTS idx_kanban_lists_board_position ON public.kanban_lists(board_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kanban_labels_board_name ON public.kanban_labels(board_id, name);

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_kanban_boards_updated_at ON public.kanban_boards;
CREATE TRIGGER trg_kanban_boards_updated_at
BEFORE UPDATE ON public.kanban_boards
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_kanban_lists_updated_at ON public.kanban_lists;
CREATE TRIGGER trg_kanban_lists_updated_at
BEFORE UPDATE ON public.kanban_lists
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_kanban_cards_updated_at ON public.kanban_cards;
CREATE TRIGGER trg_kanban_cards_updated_at
BEFORE UPDATE ON public.kanban_cards
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Helper functions (user memberships only; guest mapping TODO)
CREATE OR REPLACE FUNCTION public.kanban_board_role(p_board_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT role::text
  FROM public.kanban_board_members
  WHERE board_id = p_board_id
    AND member_type = 'user'
    AND member_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.kanban_is_board_member(p_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.kanban_board_members
    WHERE board_id = p_board_id
      AND member_type = 'user'
      AND member_id = auth.uid()
  )
$$;

-- RLS
ALTER TABLE public.kanban_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_card_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_card_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_card_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_board_members ENABLE ROW LEVEL SECURITY;

-- Boards policies
DROP POLICY IF EXISTS kanban_boards_select ON public.kanban_boards;
CREATE POLICY kanban_boards_select
ON public.kanban_boards
FOR SELECT
USING (public.kanban_is_board_member(id));

DROP POLICY IF EXISTS kanban_boards_insert ON public.kanban_boards;
CREATE POLICY kanban_boards_insert
ON public.kanban_boards
FOR INSERT
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS kanban_boards_update ON public.kanban_boards;
CREATE POLICY kanban_boards_update
ON public.kanban_boards
FOR UPDATE
USING (public.kanban_board_role(id) IN ('owner', 'editor'))
WITH CHECK (public.kanban_board_role(id) IN ('owner', 'editor'));

DROP POLICY IF EXISTS kanban_boards_delete ON public.kanban_boards;
CREATE POLICY kanban_boards_delete
ON public.kanban_boards
FOR DELETE
USING (public.kanban_board_role(id) IN ('owner', 'editor'));

-- Lists policies
DROP POLICY IF EXISTS kanban_lists_select ON public.kanban_lists;
CREATE POLICY kanban_lists_select
ON public.kanban_lists
FOR SELECT
USING (public.kanban_is_board_member(board_id));

DROP POLICY IF EXISTS kanban_lists_insert ON public.kanban_lists;
CREATE POLICY kanban_lists_insert
ON public.kanban_lists
FOR INSERT
WITH CHECK (
  public.kanban_board_role(board_id) IN ('owner', 'editor')
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS kanban_lists_update ON public.kanban_lists;
CREATE POLICY kanban_lists_update
ON public.kanban_lists
FOR UPDATE
USING (public.kanban_board_role(board_id) IN ('owner', 'editor'))
WITH CHECK (public.kanban_board_role(board_id) IN ('owner', 'editor'));

DROP POLICY IF EXISTS kanban_lists_delete ON public.kanban_lists;
CREATE POLICY kanban_lists_delete
ON public.kanban_lists
FOR DELETE
USING (public.kanban_board_role(board_id) IN ('owner', 'editor'));

-- Cards policies
DROP POLICY IF EXISTS kanban_cards_select ON public.kanban_cards;
CREATE POLICY kanban_cards_select
ON public.kanban_cards
FOR SELECT
USING (public.kanban_is_board_member(board_id));

DROP POLICY IF EXISTS kanban_cards_insert ON public.kanban_cards;
CREATE POLICY kanban_cards_insert
ON public.kanban_cards
FOR INSERT
WITH CHECK (
  public.kanban_board_role(board_id) IN ('owner', 'editor')
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS kanban_cards_update ON public.kanban_cards;
CREATE POLICY kanban_cards_update
ON public.kanban_cards
FOR UPDATE
USING (public.kanban_board_role(board_id) IN ('owner', 'editor'))
WITH CHECK (public.kanban_board_role(board_id) IN ('owner', 'editor'));

DROP POLICY IF EXISTS kanban_cards_delete ON public.kanban_cards;
CREATE POLICY kanban_cards_delete
ON public.kanban_cards
FOR DELETE
USING (public.kanban_board_role(board_id) IN ('owner', 'editor'));

-- Labels policies
DROP POLICY IF EXISTS kanban_labels_select ON public.kanban_labels;
CREATE POLICY kanban_labels_select
ON public.kanban_labels
FOR SELECT
USING (public.kanban_is_board_member(board_id));

DROP POLICY IF EXISTS kanban_labels_insert ON public.kanban_labels;
CREATE POLICY kanban_labels_insert
ON public.kanban_labels
FOR INSERT
WITH CHECK (public.kanban_board_role(board_id) IN ('owner', 'editor'));

DROP POLICY IF EXISTS kanban_labels_update ON public.kanban_labels;
CREATE POLICY kanban_labels_update
ON public.kanban_labels
FOR UPDATE
USING (public.kanban_board_role(board_id) IN ('owner', 'editor'))
WITH CHECK (public.kanban_board_role(board_id) IN ('owner', 'editor'));

DROP POLICY IF EXISTS kanban_labels_delete ON public.kanban_labels;
CREATE POLICY kanban_labels_delete
ON public.kanban_labels
FOR DELETE
USING (public.kanban_board_role(board_id) IN ('owner', 'editor'));

-- Card labels policies
DROP POLICY IF EXISTS kanban_card_labels_select ON public.kanban_card_labels;
CREATE POLICY kanban_card_labels_select
ON public.kanban_card_labels
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.kanban_cards c
    WHERE c.id = kanban_card_labels.card_id
      AND public.kanban_is_board_member(c.board_id)
  )
);

DROP POLICY IF EXISTS kanban_card_labels_insert ON public.kanban_card_labels;
CREATE POLICY kanban_card_labels_insert
ON public.kanban_card_labels
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.kanban_cards c
    WHERE c.id = kanban_card_labels.card_id
      AND public.kanban_board_role(c.board_id) IN ('owner', 'editor')
  )
);

DROP POLICY IF EXISTS kanban_card_labels_delete ON public.kanban_card_labels;
CREATE POLICY kanban_card_labels_delete
ON public.kanban_card_labels
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.kanban_cards c
    WHERE c.id = kanban_card_labels.card_id
      AND public.kanban_board_role(c.board_id) IN ('owner', 'editor')
  )
);

-- Card assignees policies
DROP POLICY IF EXISTS kanban_card_assignees_select ON public.kanban_card_assignees;
CREATE POLICY kanban_card_assignees_select
ON public.kanban_card_assignees
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.kanban_cards c
    WHERE c.id = kanban_card_assignees.card_id
      AND public.kanban_is_board_member(c.board_id)
  )
);

DROP POLICY IF EXISTS kanban_card_assignees_insert ON public.kanban_card_assignees;
CREATE POLICY kanban_card_assignees_insert
ON public.kanban_card_assignees
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.kanban_cards c
    WHERE c.id = kanban_card_assignees.card_id
      AND public.kanban_board_role(c.board_id) IN ('owner', 'editor')
  )
);

DROP POLICY IF EXISTS kanban_card_assignees_delete ON public.kanban_card_assignees;
CREATE POLICY kanban_card_assignees_delete
ON public.kanban_card_assignees
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.kanban_cards c
    WHERE c.id = kanban_card_assignees.card_id
      AND public.kanban_board_role(c.board_id) IN ('owner', 'editor')
  )
);

-- Comments policies
DROP POLICY IF EXISTS kanban_comments_select ON public.kanban_comments;
CREATE POLICY kanban_comments_select
ON public.kanban_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.kanban_cards c
    WHERE c.id = kanban_comments.card_id
      AND public.kanban_is_board_member(c.board_id)
  )
);

DROP POLICY IF EXISTS kanban_comments_insert ON public.kanban_comments;
CREATE POLICY kanban_comments_insert
ON public.kanban_comments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.kanban_cards c
    WHERE c.id = kanban_comments.card_id
      AND public.kanban_board_role(c.board_id) IN ('owner', 'editor', 'commenter')
  )
  AND author_type = 'user'
  AND author_id = auth.uid()
);

DROP POLICY IF EXISTS kanban_comments_update ON public.kanban_comments;
CREATE POLICY kanban_comments_update
ON public.kanban_comments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.kanban_cards c
    WHERE c.id = kanban_comments.card_id
      AND (
        public.kanban_board_role(c.board_id) IN ('owner', 'editor')
        OR (kanban_comments.author_type = 'user' AND kanban_comments.author_id = auth.uid())
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.kanban_cards c
    WHERE c.id = kanban_comments.card_id
      AND (
        public.kanban_board_role(c.board_id) IN ('owner', 'editor')
        OR (kanban_comments.author_type = 'user' AND kanban_comments.author_id = auth.uid())
      )
  )
);

DROP POLICY IF EXISTS kanban_comments_delete ON public.kanban_comments;
CREATE POLICY kanban_comments_delete
ON public.kanban_comments
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.kanban_cards c
    WHERE c.id = kanban_comments.card_id
      AND (
        public.kanban_board_role(c.board_id) IN ('owner', 'editor')
        OR (kanban_comments.author_type = 'user' AND kanban_comments.author_id = auth.uid())
      )
  )
);

-- Card links policies
DROP POLICY IF EXISTS kanban_card_links_select ON public.kanban_card_links;
CREATE POLICY kanban_card_links_select
ON public.kanban_card_links
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.kanban_cards c
    WHERE c.id = kanban_card_links.card_id
      AND public.kanban_is_board_member(c.board_id)
  )
);

DROP POLICY IF EXISTS kanban_card_links_insert ON public.kanban_card_links;
CREATE POLICY kanban_card_links_insert
ON public.kanban_card_links
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.kanban_cards c
    WHERE c.id = kanban_card_links.card_id
      AND public.kanban_board_role(c.board_id) IN ('owner', 'editor')
  )
);

DROP POLICY IF EXISTS kanban_card_links_delete ON public.kanban_card_links;
CREATE POLICY kanban_card_links_delete
ON public.kanban_card_links
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.kanban_cards c
    WHERE c.id = kanban_card_links.card_id
      AND public.kanban_board_role(c.board_id) IN ('owner', 'editor')
  )
);

-- Board members policies
DROP POLICY IF EXISTS kanban_board_members_select ON public.kanban_board_members;
CREATE POLICY kanban_board_members_select
ON public.kanban_board_members
FOR SELECT
USING (public.kanban_is_board_member(board_id));

DROP POLICY IF EXISTS kanban_board_members_insert ON public.kanban_board_members;
CREATE POLICY kanban_board_members_insert
ON public.kanban_board_members
FOR INSERT
WITH CHECK (public.kanban_board_role(board_id) = 'owner');

DROP POLICY IF EXISTS kanban_board_members_update ON public.kanban_board_members;
CREATE POLICY kanban_board_members_update
ON public.kanban_board_members
FOR UPDATE
USING (public.kanban_board_role(board_id) = 'owner')
WITH CHECK (public.kanban_board_role(board_id) = 'owner');

DROP POLICY IF EXISTS kanban_board_members_delete ON public.kanban_board_members;
CREATE POLICY kanban_board_members_delete
ON public.kanban_board_members
FOR DELETE
USING (public.kanban_board_role(board_id) = 'owner');

