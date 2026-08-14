-- At most one open (todo / in_progress) instance per recurring template.
-- First cancel race duplicates so the unique index can apply.

with ranked as (
  select
    id,
    row_number() over (
      partition by recurring_template_id
      order by
        case status when 'in_progress' then 0 else 1 end,
        due_at desc nulls last,
        created_at desc
    ) as rn
  from public.tasks
  where recurring_template_id is not null
    and status in ('todo', 'in_progress')
)
update public.tasks t
set
  status = 'cancelled',
  updated_at = now()
from ranked r
where t.id = r.id
  and r.rn > 1;

create unique index if not exists tasks_one_open_per_recurring_template_idx
  on public.tasks (recurring_template_id)
  where recurring_template_id is not null
    and status in ('todo', 'in_progress');

comment on index public.tasks_one_open_per_recurring_template_idx is
  'Recurring series: only one open task card at a time per template.';
