-- Per-board images from the public Storage bucket `board-assets`, stored as <board id>/<file>.
-- ADDITIVE: a new nullable column plus data for the two boards that have images. Safe with the live app,
-- which does not read background_url. Apply before deploying a client that selects it.
-- A board with no logo_url shows its name as text; with no background_url the home page uses a neutral wash.

alter table public.boards add column if not exists background_url text;

update public.boards set
  logo_url       = 'https://enanmsnprjviztiiemtn.supabase.co/storage/v1/object/public/board-assets/m-cb-3/logo.png',
  background_url = 'https://enanmsnprjviztiiemtn.supabase.co/storage/v1/object/public/board-assets/m-cb-3/background.jpg'
where id = 'm-cb-3';

update public.boards set
  logo_url       = 'https://enanmsnprjviztiiemtn.supabase.co/storage/v1/object/public/board-assets/b-cb-9/logo.jpeg',
  background_url = 'https://enanmsnprjviztiiemtn.supabase.co/storage/v1/object/public/board-assets/b-cb-9/background.jpg'
where id = 'b-cb-9';
