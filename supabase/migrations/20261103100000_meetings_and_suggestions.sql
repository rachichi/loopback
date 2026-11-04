-- Meetings, AI ticket suggestions, and the functions staff use to approve or reject them (transcript
-- matching, V2). ADDITIVE: new tables, functions and one feature flag. Nothing existing changes, and the
-- app does not read any of it until transcript_matching is on for a board.
--
-- meetings holds one row per meeting transcript. Its columns map onto Block Party's meetings table so a
-- later sync can fill it: id -> external_id, cb_id -> board, meeting_youtube_id -> youtube_id,
-- creation_date -> held_on, full_transcript -> transcript. Until then transcripts are loaded by hand
-- (scripts/load_meetings.mjs), with source 'upload' and the file name as external_id.
--
-- ticket_suggestions holds what the match-transcript Edge Function proposes for one meeting: an update to
-- an existing ticket (kind 'update') or a new ticket (kind 'new'). Staff approve, edit or reject each one.
-- Decided rows are kept: they are the audit trail, and later the eval gold for this board.
--
-- Access, all to authenticated, none to anon:
--   meetings            read: board members and platform admins. write: platform admins.
--   ticket_suggestions  read: board members and platform admins. update: can_edit_board. insert and
--                       delete: platform admins. The Edge Function writes with the service role.
--   apply_ticket_suggestion and reject_ticket_suggestion are security invoker, so the ticket and
--   suggestion policies decide what the caller may change.

-- 1. Meetings
create table if not exists public.meetings (
  id          uuid primary key default gen_random_uuid(),
  board       text not null references public.boards (id),
  title       text not null,
  held_on     date not null,
  -- One paragraph per line, so src/transcript.ts buildParagraphs gives stable ids (P1, P2, ...) and offsets.
  transcript  text not null default '',
  source      text not null default 'upload' check (source in ('upload', 'blockparty')),
  external_id text,
  youtube_id  text,
  -- When match-transcript last ran on this meeting.
  matched_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (source, external_id),
  -- Lets ticket_suggestions require that a suggestion's board is its meeting's board.
  unique (id, board)
);
create index if not exists meetings_board_held_on on public.meetings (board, held_on desc);

alter table public.meetings enable row level security;
revoke all on public.meetings from anon;

drop policy if exists "meetings select" on public.meetings;
drop policy if exists "meetings write" on public.meetings;
create policy "meetings select" on public.meetings for select to authenticated
  using (public.is_board_member(board) or public.is_platform_admin());
create policy "meetings write" on public.meetings for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- 2. Suggestions
create table if not exists public.ticket_suggestions (
  id             uuid primary key default gen_random_uuid(),
  board          text not null references public.boards (id),
  meeting_id     uuid not null,
  -- The ticket to update (kind 'update'), or for an approved 'new' suggestion the ticket it created.
  -- Kept when the ticket is deleted later, so the decision stays in the audit trail.
  ticket_id      text references public.tickets (id) on delete set null,
  kind           text not null check (kind in ('update', 'new')),
  -- Paragraph ids as returned by the model, e.g. {P12,P14}.
  evidence       text[] not null default '{}',
  -- The same paragraphs as transcript highlights: [{ meetingId, start, end }].
  spans          jsonb not null default '[]',
  -- Proposed ticket fields. For 'update', only fields that differ from the ticket.
  changes        jsonb not null default '{}',
  -- What staff approved, after any edits. Null until approved.
  applied        jsonb,
  -- Notes from the matcher, e.g. why a suggestion fell back to 'new'.
  reason         text not null default '',
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by     uuid references auth.users,
  decided_at     timestamptz,
  model          text,
  prompt_version text,
  created_at     timestamptz not null default now(),
  foreign key (meeting_id, board) references public.meetings (id, board) on delete cascade
);
create index if not exists ticket_suggestions_meeting on public.ticket_suggestions (meeting_id, status);
create index if not exists ticket_suggestions_ticket on public.ticket_suggestions (ticket_id) where ticket_id is not null;

alter table public.ticket_suggestions enable row level security;
revoke all on public.ticket_suggestions from anon;

drop policy if exists "suggestions select" on public.ticket_suggestions;
drop policy if exists "suggestions update" on public.ticket_suggestions;
drop policy if exists "suggestions insert" on public.ticket_suggestions;
drop policy if exists "suggestions delete" on public.ticket_suggestions;
create policy "suggestions select" on public.ticket_suggestions for select to authenticated
  using (public.is_board_member(board) or public.is_platform_admin());
create policy "suggestions update" on public.ticket_suggestions for update to authenticated
  using (public.can_edit_board(board)) with check (public.can_edit_board(board));
create policy "suggestions insert" on public.ticket_suggestions for insert to authenticated
  with check (public.is_platform_admin());
create policy "suggestions delete" on public.ticket_suggestions for delete to authenticated
  using (public.is_platform_admin());

-- 3. Approve. `edited` is staff's version of the proposed fields; null approves the suggestion as is.
-- Fields an approval may set: title, type, status, summary, location_text, requester, deadline.
-- 'update' merges them into the ticket, adds the meeting to meeting_ids (oldest meeting first) and the
-- suggestion's highlights to spans. 'new' inserts a ticket with number 0 (the trigger numbers it),
-- source 'transcript', and the meeting as submitter. Returns the ticket as saved.
create or replace function public.apply_ticket_suggestion(s uuid, edited jsonb default null)
returns public.tickets
language plpgsql security invoker set search_path = public as $$
declare
  sug public.ticket_suggestions;
  m   public.meetings;
  t   public.tickets;
  c   jsonb;
begin
  select * into sug from public.ticket_suggestions where id = s for update;
  if not found then
    raise exception 'Suggestion not found.' using errcode = 'P0002';
  end if;
  if not public.can_edit_board(sug.board) then
    raise exception 'Only staff can approve suggestions on this board.' using errcode = '42501';
  end if;
  if sug.status <> 'pending' then
    raise exception 'This suggestion was already %.', sug.status using errcode = '55000';
  end if;
  select * into m from public.meetings where id = sug.meeting_id;

  -- Keep only the fields an approval may set.
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into c
  from jsonb_each(coalesce(edited, sug.changes))
  where key in ('title', 'type', 'status', 'summary', 'location_text', 'requester', 'deadline');

  if sug.kind = 'update' then
    select * into t from public.tickets where id = sug.ticket_id and board = sug.board for update;
    if not found then
      raise exception 'The ticket for this suggestion no longer exists.' using errcode = 'P0002';
    end if;
    update public.tickets set
      title         = coalesce(c ->> 'title', title),
      type          = coalesce(c ->> 'type', type),
      status        = coalesce(c ->> 'status', status),
      summary       = coalesce(c ->> 'summary', summary),
      location_text = coalesce(c ->> 'location_text', location_text),
      requester     = coalesce(c ->> 'requester', requester),
      deadline      = case when c ? 'deadline' then nullif(c ->> 'deadline', '')::date else deadline end,
      -- Ids not in meetings (the CB3 demo meetings) sort first, then by meeting date.
      meeting_ids   = (
        select coalesce(array_agg(x.id order by x.held_on nulls first, x.ord), '{}')
        from (
          select distinct on (u.id) u.id, u.ord, mm.held_on
          from unnest(t.meeting_ids || array[sug.meeting_id::text]) with ordinality as u (id, ord)
          left join public.meetings mm on mm.id::text = u.id
          order by u.id, u.ord
        ) x
      ),
      spans         = t.spans || coalesce(
        (select jsonb_agg(e) from jsonb_array_elements(sug.spans) e where not t.spans @> jsonb_build_array(e)),
        '[]'::jsonb)
    where id = t.id
    returning * into t;
  else
    insert into public.tickets (id, board, number, title, type, status, summary, location_text, requester,
                                deadline, submitted_by, submitted_at, meeting_ids, spans, source)
    values (gen_random_uuid()::text, sug.board, 0,
            coalesce(nullif(c ->> 'title', ''), 'Untitled'), coalesce(c ->> 'type', 'Other'),
            coalesce(c ->> 'status', 'Open'), coalesce(c ->> 'summary', ''), coalesce(c ->> 'location_text', ''),
            coalesce(c ->> 'requester', ''), nullif(c ->> 'deadline', '')::date,
            m.title, m.held_on, array[m.id::text], sug.spans, 'transcript')
    returning * into t;
  end if;

  update public.ticket_suggestions
  set status = 'approved', applied = c, ticket_id = t.id, decided_by = auth.uid(), decided_at = now()
  where id = s;
  return t;
end $$;

create or replace function public.reject_ticket_suggestion(s uuid)
returns void
language plpgsql security invoker set search_path = public as $$
begin
  update public.ticket_suggestions
  set status = 'rejected', decided_by = auth.uid(), decided_at = now()
  where id = s and status = 'pending';
  if not found then
    raise exception 'No pending suggestion to reject (already decided, or not on your board).' using errcode = 'P0002';
  end if;
end $$;

revoke all on function public.apply_ticket_suggestion(uuid, jsonb), public.reject_ticket_suggestion(uuid) from public, anon;
grant execute on function public.apply_ticket_suggestion(uuid, jsonb), public.reject_ticket_suggestion(uuid) to authenticated;

-- 4. Meeting minutes: a later phase, off everywhere until then.
insert into public.feature_flags (key, description, default_enabled, requires_board_setup) values
  ('meeting_minutes', 'Draft meeting minutes from a processed transcript (V3)', false, false)
on conflict (key) do nothing;
