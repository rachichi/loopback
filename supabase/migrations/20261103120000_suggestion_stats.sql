-- How staff respond to AI suggestions, per board and kind (transcript matching, V2). ADDITIVE: one view.
--
-- Usage analytics (Better Stack) gets one suggestion_reviewed event per decision, but never user ids, so
-- it can count decisions and not people. This view counts both from ticket_suggestions.decided_by.
-- security_invoker, so RLS applies: staff see their own board's row, platform admins every board's.
--
--   select * from public.board_suggestion_stats where board = 'staging';

create or replace view public.board_suggestion_stats with (security_invoker = true) as
select
  board,
  kind,
  count(*) filter (where status = 'pending')                         as pending,
  count(*) filter (where status = 'approved')                        as accepted,
  count(*) filter (where status = 'rejected')                        as rejected,
  round(100.0 * count(*) filter (where status = 'approved')
        / nullif(count(*) filter (where status <> 'pending'), 0), 1) as accepted_pct,
  -- Distinct people who pressed Reviewed or Reject.
  count(distinct decided_by)                                         as reviewers,
  count(distinct decided_by) filter (where status = 'approved')      as people_who_accepted,
  max(decided_at)                                                    as last_decided_at
from public.ticket_suggestions
group by board, kind;

revoke all on public.board_suggestion_stats from anon;
grant select on public.board_suggestion_stats to authenticated;
