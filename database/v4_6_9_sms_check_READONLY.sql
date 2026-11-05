-- =====================================================================================
-- ReqGen v4.6.9 — SMS and email check (READ ONLY; changes nothing)
--
-- Run it in Supabase › SQL Editor after an approval, to see whether ReqGen tried to send the SMS and
-- the email, to whom, and what Sendchamp answered. Send a screenshot of the results if a row says
-- "failed".
--
--   Table 1  the last 30 SMS and email attempts, newest first
--   Table 2  the count of each result in the last 7 days (with the most common error)
--
-- No row at all after an approval means the server did not try: check the Vercel settings in the
-- v4.6.9 deployment guide (SENDCHAMP_API_KEY, and that SENDCHAMP_SMS_ENABLED /
-- SENDCHAMP_EMAIL_ENABLED are not "false").
-- =====================================================================================

-- Table 1: the last 30 attempts
select
  coalesce(to_jsonb(l)->>'created_at', '') as sent_at,
  l.channel,
  l.status,
  coalesce(p.full_name, '') as recipient,
  case when l.channel = 'sms' then coalesce(l.phone, '') else coalesce(l.email, '') end as sent_to,
  coalesce(r.request_no, '') as request_no,
  left(coalesce(l.error, ''), 160) as error,
  left(coalesce(l.provider_response::text, ''), 160) as sendchamp_answer
from public.sms_logs l
left join public.profiles p on p.id = l.recipient_user_id
left join public.requests r on r.id = l.request_id
order by coalesce(to_jsonb(l)->>'created_at', '') desc
limit 30;

-- Table 2: results in the last 7 days
select
  l.channel,
  l.status,
  count(*) as attempts,
  left(coalesce(mode() within group (order by l.error), ''), 160) as most_common_error
from public.sms_logs l
where coalesce((to_jsonb(l)->>'created_at')::timestamptz, now()) >= now() - interval '7 days'
group by l.channel, l.status
order by l.channel, l.status;
