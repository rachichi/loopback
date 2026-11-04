-- Hand-logged tickets for the staging board, so transcript matching has something to enhance. NOT a
-- migration. Run after create_staging_board.sql and after loading the meetings (scripts/load_meetings.mjs).
-- Safe to re-run: tickets that already exist are skipped.
--
-- About two per meeting in evals/data/b-cb-9/, written the way staff log them during a meeting: a short
-- title, a line or two, no quotes and no transcript links. Some issues come up again at later meetings
-- (the Bedford Ave rezoning, litter on Franklin Ave), so matching a later meeting should suggest updates
-- to these rather than new tickets. Numbers are assigned by the database (number 0), in this order.

insert into public.tickets (id, board, number, title, type, status, location_text, requester, summary, submitted_by, submitted_at, source)
values
  -- 10/7 ULURP/Land Use Committee, part 1
  ('staging-seed-01', 'staging', 0, 'Bedford Ave & Eastern Pkwy rezoning, 18 stories', 'Land Use Request', 'Open',
   'Bedford Ave and Eastern Pkwy', 'Developer team', 'Developer presented a rezoning for the vacant corner lot. Residents worried about height next to the Parkway.', 'Board office', '2026-10-07', 'manual'),
  ('staging-seed-02', 'staging', 0, 'Ask developer about union jobs and local hiring', 'Land Use Request', 'Open',
   '', 'Board member', 'Member asked if construction will be union or open shop. No clear answer.', 'Board office', '2026-10-07', 'manual'),
  -- 10/7 ULURP/Land Use Committee, part 2
  ('staging-seed-03', 'staging', 0, 'Utica Ave gas station site, BSA variance for affordable housing', 'Land Use Request', 'Open',
   'Utica Ave', 'RiseBoro / applicant attorney', '224 affordable units proposed on the old gas station site. Variance goes to BSA, board asked for a recommendation.', 'Board office', '2026-10-07', 'manual'),
  ('staging-seed-04', 'staging', 0, 'Town hall before land use votes?', 'Board Administration', 'Open',
   '', 'Board member', 'Motion to hold off voting on both projects until there is a town hall.', 'Board office', '2026-10-07', 'manual'),
  -- 10/7 Youth and Education Committee
  ('staging-seed-05', 'staging', 0, 'Voter registration table before Oct 24 deadline', 'Other', 'Open',
   '', 'Committee', 'Table in front of the office on Saturday to register voters before the deadline.', 'Board office', '2026-10-07', 'manual'),
  ('staging-seed-06', 'staging', 0, 'Winter job fair and book fair planning', 'Other', 'Open',
   '', 'Committee chair', 'Job fair with interview workshop, book fair in the spring. Need dates and a lead.', 'Board office', '2026-10-07', 'manual'),
  -- 10/8 Environmental Protection Committee
  ('staging-seed-07', 'staging', 0, 'Litter near Franklin Ave, more corner baskets', 'Quality of Life Complaint', 'Open',
   'Franklin Ave', 'Committee member', 'Neighbors complain about litter and broken glass. Ask DSNY for more baskets, maybe a cleanup day.', 'Board office', '2026-10-08', 'manual'),
  ('staging-seed-08', 'staging', 0, 'Repair and reuse event', 'Other', 'Open',
   '', 'Committee member', 'Idea for a repair and reuse event for residents.', 'Board office', '2026-10-08', 'manual'),
  -- 10/8 Transportation Committee
  ('staging-seed-09', 'staging', 0, 'Street co-naming for Thelma Davis', 'Transportation Request', 'Open',
   'Eastern Pkwy', 'Family / sponsor', 'Request to co-name a stretch of Eastern Pkwy. Block range to confirm.', 'Board office', '2026-10-08', 'manual'),
  ('staging-seed-10', 'staging', 0, 'Flatbush Ave bus lanes (B41)', 'Transportation Request', 'In Progress',
   'Flatbush Ave', 'Committee', 'DOT bus lane plan for Flatbush. Members split, want DOT data on safety and ridership.', 'Board office', '2026-10-08', 'manual'),
  -- 10/14 Public Safety Committee
  ('staging-seed-11', 'staging', 0, 'SLA questionnaire for applicants', 'Liquor License', 'In Progress',
   '', 'Committee chair', 'Draft a standard questionnaire for liquor license applicants. Chair will email it around.', 'Board office', '2026-10-14', 'manual'),
  ('staging-seed-12', 'staging', 0, 'Bring back PAL youth programs', 'Public Safety Issue', 'Open',
   '', 'Committee member', 'Members asked about restarting PAL summer and year-round programs with the precinct.', 'Board office', '2026-10-14', 'manual'),
  -- 10/14 Executive Committee
  ('staging-seed-13', 'staging', 0, 'Monthly NYPD data call', 'Public Safety Issue', 'Open',
   '', 'Public Safety chair', 'NYPD missed the meeting. Set up a monthly call to go over CompStat data.', 'Board office', '2026-10-14', 'manual'),
  ('staging-seed-14', 'staging', 0, 'Robert''s Rules refresher for members', 'Board Administration', 'Open',
   '', 'Chair', 'Disagreement over procedure at the meeting. Bylaws require Robert''s Rules.', 'Board office', '2026-10-14', 'manual'),
  -- 10/16 ULURP/Land Use Committee vote
  ('staging-seed-15', 'staging', 0, 'Soil cleanup concerns at rezoning site', 'Land Use Request', 'Open',
   '', 'Committee member', 'Members want proof of remediation, site was a dumping location.', 'Board office', '2026-10-16', 'manual'),
  -- 10/21 General Board Meeting
  ('staging-seed-16', 'staging', 0, 'Missing trash cans on Franklin, Carroll, Montgomery, Washington', 'Quality of Life Complaint', 'Open',
   'Franklin Ave; Carroll St; Montgomery St; Washington Ave', 'District office', 'Litter baskets missing on several corners. Report to DSNY.', 'Board office', '2026-10-21', 'manual'),
  ('staging-seed-17', 'staging', 0, 'Barnes dance crossing near school', 'Transportation Request', 'Open',
   '', 'Board member', 'Question about the all-way pedestrian crossing and raised crosswalks. Follow up with DOT.', 'Board office', '2026-10-21', 'manual'),
  -- 10/23 FY 28/29 Statement of Needs Public Hearing
  ('staging-seed-18', 'staging', 0, 'Rats in tree beds', 'Quality of Life Complaint', 'Open',
   '', 'Resident', 'Rat burrows in every tree bed on the block. Ask about the rat task force.', 'Board office', '2026-10-23', 'manual'),
  ('staging-seed-19', 'staging', 0, 'Red light / speed camera on Winthrop St at Troy Ave', 'Transportation Request', 'Open',
   'Winthrop St and Troy Ave', 'Resident', 'Speeding westbound on Winthrop. Add to statement of needs.', 'Board office', '2026-10-23', 'manual'),
  ('staging-seed-20', 'staging', 0, 'Crown Heights Library renovation funding', 'Budget Priority', 'In Progress',
   'Crown Heights Library', 'District office', 'Library has asked for capital funding for years. Keep it in the budget priorities.', 'Board office', '2026-10-23', 'manual')
on conflict (id) do nothing;

-- Check: 20 tickets, numbered in order, all manual with no meetings yet.
select number, title, type, status, submitted_at
from public.tickets where board = 'staging' order by number;
