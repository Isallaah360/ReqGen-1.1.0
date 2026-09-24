-- ReqGen v2.0.0.7 Phase 6 stabilisation
-- Server-side workflow invariants that must hold regardless of UI/client state.

create or replace function public.reqgen_enforce_request_routing_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- An OFFICIAL request must never arrive at DG without a funded subhead.
  if upper(coalesce(new.request_type, '')) = 'OFFICIAL'
     and upper(replace(coalesce(new.current_stage, ''), ' ', '')) = 'DG'
     and new.subhead_id is null then
    raise exception 'Official request cannot be routed to DG without a subhead assignment.';
  end if;

  -- When DG approval advances an official request to Account, routing must be
  -- deterministic and the request owner must be the officer attached to it.
  if upper(coalesce(new.request_type, '')) = 'OFFICIAL'
     and upper(replace(coalesce(old.current_stage, ''), ' ', '')) = 'DG'
     and upper(replace(coalesce(new.current_stage, ''), ' ', '')) = 'ACCOUNT' then
    if new.subhead_id is null then
      raise exception 'DG approval requires a subhead assignment.';
    end if;
    if new.assigned_account_officer_id is null then
      raise exception 'DG approval cannot route to Account because no Account Officer is assigned.';
    end if;
    new.current_owner := new.assigned_account_officer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reqgen_request_routing_integrity on public.requests;
create trigger trg_reqgen_request_routing_integrity
before insert or update of current_stage, subhead_id, assigned_account_officer_id, current_owner
on public.requests
for each row execute function public.reqgen_enforce_request_routing_integrity();
