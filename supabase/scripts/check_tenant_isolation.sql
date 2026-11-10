-- Tenant isolation and feature flag checks (refactor spec, sections 5 and 7). NOT a migration.
-- Paste into the Supabase SQL editor, set the values below, and run. Safe to re-run.
--
-- Needs the plus-addressed test staff from create_board_test_staff.sql. Do not use a platform admin
-- account: platform admins see every board, so the isolation lines would look like failures.
--
-- Signs in as staff of board_a, then board_b, then checks meetings and suggestions (a staging meeting and
-- suggestion that board_a's staff must not see or decide, and that the staging staff can approve), then
-- runs the flag checks as postgres. It always ends
-- with an exception, so nothing is kept: the test ticket, the ticket counter and the flag changes all
-- roll back, as do the test meeting, suggestion and ticket. The results are in the error message after "ROLLBACK REPORT:".
--
-- A pass looks like this (counts and numbers depend on the data):
--   A sees: <board_a>=<n>                      only board_a
--   A new ticket number: <next_ticket_no>      assigned by the database
--   A insert into B: denied (42501)
--   A update B rows changed: 0
--   A delete B rows deleted: 0
--   A move own ticket to B: denied (42501)
--   B sees: <board_b>=<n>                      only board_b
--   A attach to own ticket: allowed            A attach claiming board B: denied (42501)
--   A upload to own board folder: allowed      A upload to board B folder: denied (42501)
--   B sees A attachments: 0, files: 0          B delete A attachments rows deleted: 0
--   Public view: ordinary ticket shown=1, hidden-type ticket shown=0, hidden type listed=0
--   A sees staging meetings: 0, suggestions: 0
--   A approve staging suggestion: denied (P0002)
--   A reject staging suggestion: denied (P0002)
--   A update staging suggestion rows changed: 0
--   Staging suggestion after A: pending
--   C approve staging suggestion: ticket <n>, source transcript, meetings 1
--   After A override off: ... (boards with map off: 1)
--   Default off, boards with map on: 0
--   Default on, boards with map on: <all> of <all>

do $$
declare
  base_email constant text := 'you@example.org';
  board_a    constant text := 'b-cb-9';
  board_b    constant text := 'm-cb-3';
  ua uuid := (select id from auth.users
              where email = lower(split_part(base_email, '@', 1) || '+' || board_a || '@' || split_part(base_email, '@', 2)));
  ub uuid := (select id from auth.users
              where email = lower(split_part(base_email, '@', 1) || '+' || board_b || '@' || split_part(base_email, '@', 2)));
  -- Staff of the staging board, for the meeting and suggestion checks.
  uc uuid := (select id from auth.users
              where email = lower(split_part(base_email, '@', 1) || '+staging@' || split_part(base_email, '@', 2)));
  mid uuid;
  sid uuid;
  t public.tickets;
  r text := '';
  n int;
  s text;
begin
  if ua is null or ub is null or uc is null then
    raise exception 'Test staff for %, % or staging not found. Run create_board_test_staff.sql first.', board_a, board_b;
  end if;

  -- Isolation, as staff of board_a
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select string_agg(board || '=' || c, ',') into s from (select board, count(*) c from public.tickets group by board) x;
  r := r || E'\nA sees: ' || coalesce(s, 'nothing');

  -- New ticket number: send 0, the database assigns it
  insert into public.tickets (id, number, title, submitted_by, board)
  values ('rollback-test-1', 0, 'Rollback test', 'test', board_a) returning number into n;
  r := r || E'\nA new ticket number: ' || n;

  -- Cross-board denial
  begin
    insert into public.tickets (id, number, title, submitted_by, board) values ('rollback-test-2', 0, 'x', 'test', board_b);
    r := r || E'\nA insert into B: ALLOWED (bad)';
  exception when others then r := r || E'\nA insert into B: denied (' || sqlstate || ')';
  end;
  update public.tickets set title = 'x' where board = board_b;
  get diagnostics n = row_count;
  r := r || E'\nA update B rows changed: ' || n;
  delete from public.tickets where board = board_b;
  get diagnostics n = row_count;
  r := r || E'\nA delete B rows deleted: ' || n;
  begin
    update public.tickets set board = board_b where id = 'rollback-test-1';
    get diagnostics n = row_count;
    r := r || E'\nA move own ticket to B: rows=' || n || ' (bad if 1)';
  exception when others then r := r || E'\nA move own ticket to B: denied (' || sqlstate || ')';
  end;

  -- Isolation, as staff of board_b
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  select string_agg(board || '=' || c, ',') into s from (select board, count(*) c from public.tickets group by board) x;
  r := r || E'\nB sees: ' || coalesce(s, 'nothing');

  -- Attachments (ticket_attachments and the private ticket-files bucket): staff of board_a can attach to their
  -- own ticket and upload into their own folder, not into board_b's; board_b's staff see and delete none of it.
  -- Each step is its own block, so an unexpected error shows up as a line in the report instead of ending the run.
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  begin
    insert into public.ticket_attachments (board, ticket_id, path, name, size_bytes)
    values (board_a, 'rollback-test-1', board_a || '/rollback-test-1/rollback.pdf', 'rollback.pdf', 1);
    r := r || E'\nA attach to own ticket: allowed';
  exception when others then r := r || E'\nA attach to own ticket: DENIED (bad) (' || sqlstate || ')';
  end;
  begin
    insert into public.ticket_attachments (board, ticket_id, path, name, size_bytes)
    values (board_b, 'rollback-test-1', board_b || '/rollback-test-1/rollback.pdf', 'rollback.pdf', 1);
    r := r || E'\nA attach claiming board B: ALLOWED (bad)';
  exception when others then r := r || E'\nA attach claiming board B: denied (' || sqlstate || ')';
  end;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('ticket-files', board_a || '/rollback-test-1/rollback.pdf', ua);
    r := r || E'\nA upload to own board folder: allowed';
  exception when others then r := r || E'\nA upload to own board folder: DENIED (bad) (' || sqlstate || ')';
  end;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('ticket-files', board_b || '/rollback-test-1/rollback.pdf', ua);
    r := r || E'\nA upload to board B folder: ALLOWED (bad)';
  exception when others then r := r || E'\nA upload to board B folder: denied (' || sqlstate || ')';
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  r := r || E'\nB sees A attachments: ' || (select count(*) from public.ticket_attachments)
         || ', files: ' || (select count(*) from storage.objects where bucket_id = 'ticket-files');
  delete from public.ticket_attachments;
  get diagnostics n = row_count;
  r := r || E'\nB delete A attachments rows deleted: ' || n;

  -- Public share view: a ticket of a hidden type (Board Administration) is not returned, an ordinary one is, and the
  -- hidden type is not listed. Needs board_a to have a share link and a type with hidden_from_public.
  perform set_config('role', 'postgres', true);
  declare
    tok text := (select share_token from public.boards where id = board_a);
    hidden_label text := (select e ->> 'label' from public.boards b, jsonb_array_elements(b.ticket_types) e
                          where b.id = board_a and coalesce((e ->> 'hidden_from_public')::boolean, false) limit 1);
    shown int;
    leaked int;
    listed int;
  begin
    if tok is null or hidden_label is null then
      r := r || E'\nPublic view: skipped (board_a has no share link or no hidden type)';
    else
      insert into public.tickets (id, number, title, type, submitted_by, board) values ('rollback-test-pub-1', 0, 'x', hidden_label, 'test', board_a);
      insert into public.tickets (id, number, title, type, submitted_by, board) values ('rollback-test-pub-2', 0, 'x', 'Other', 'test', board_a);
      perform set_config('role', 'anon', true);
      select count(*) filter (where id = 'rollback-test-pub-2'), count(*) filter (where id = 'rollback-test-pub-1')
        into shown, leaked from public.public_board_tickets(tok);
      select count(*) into listed from public.public_board(tok) pb, jsonb_array_elements(pb.ticket_types) e where e ->> 'label' = hidden_label;
      perform set_config('role', 'postgres', true);
      r := r || E'\nPublic view: ordinary ticket shown=' || shown || ', hidden-type ticket shown=' || leaked || ', hidden type listed=' || listed;
    end if;
  end;

  -- Meetings and suggestions: a staging meeting with one pending suggestion, made as postgres
  perform set_config('role', 'postgres', true);
  insert into public.meetings (board, title, held_on, transcript, source, external_id)
  values ('staging', 'Rollback test meeting', current_date, 'First paragraph.' || E'\n' || 'Second paragraph.', 'upload', 'rollback-test')
  returning id into mid;
  insert into public.ticket_suggestions (board, meeting_id, kind, evidence, spans, changes)
  values ('staging', mid, 'new', '{P2}', jsonb_build_array(jsonb_build_object('meetingId', mid, 'start', 17, 'end', 34)),
          '{"title": "Rollback test suggestion", "type": "Other", "status": "Open"}')
  returning id into sid;

  -- As staff of board_a: none of it is visible or decidable
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  r := r || E'\nA sees staging meetings: ' || (select count(*) from public.meetings where board = 'staging')
         || ', suggestions: ' || (select count(*) from public.ticket_suggestions where board = 'staging');
  begin
    perform public.apply_ticket_suggestion(sid);
    r := r || E'\nA approve staging suggestion: ALLOWED (bad)';
  exception when others then r := r || E'\nA approve staging suggestion: denied (' || sqlstate || ')';
  end;
  begin
    perform public.reject_ticket_suggestion(sid);
    r := r || E'\nA reject staging suggestion: ALLOWED (bad)';
  exception when others then r := r || E'\nA reject staging suggestion: denied (' || sqlstate || ')';
  end;
  update public.ticket_suggestions set status = 'approved' where id = sid;
  get diagnostics n = row_count;
  r := r || E'\nA update staging suggestion rows changed: ' || n;
  perform set_config('role', 'postgres', true);
  r := r || E'\nStaging suggestion after A: ' || (select status from public.ticket_suggestions where id = sid);

  -- As staging staff: approving creates a numbered transcript ticket linked to the meeting
  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  t := public.apply_ticket_suggestion(sid);
  r := r || E'\nC approve staging suggestion: ticket ' || t.number || ', source ' || t.source
         || ', meetings ' || cardinality(t.meeting_ids);

  -- Flag off for board_a only
  perform set_config('role', 'postgres', true);
  update public.boards set features = features || '{"district_map": false}' where id = board_a;
  select string_agg(board_id || '=' || (features ->> 'district_map'), ',') into s
    from public.board_effective_features where board_id in (board_a, board_b);
  select count(*) into n from public.board_effective_features where (features ->> 'district_map')::boolean is false;
  r := r || E'\nAfter A override off: ' || s || ' (boards with map off: ' || n || ')';

  -- Flag for everyone: clear overrides, default off, then default on
  update public.boards set features = features - 'district_map' where features ? 'district_map';
  update public.feature_flags set default_enabled = false where key = 'district_map';
  select count(*) into n from public.board_effective_features where (features ->> 'district_map')::boolean;
  r := r || E'\nDefault off, boards with map on: ' || n;
  update public.feature_flags set default_enabled = true where key = 'district_map';
  select count(*) into n from public.board_effective_features where (features ->> 'district_map')::boolean;
  r := r || E'\nDefault on, boards with map on: ' || n || ' of ' || (select count(*) from public.boards);

  raise exception 'ROLLBACK REPORT:%', r;
end $$;

-- Anonymous access is checked from a shell, not here. After migration 3b it must return []:
--   curl "$VITE_SUPABASE_URL/rest/v1/tickets?select=id&limit=1" -H "apikey: $VITE_SUPABASE_ANON_KEY"
