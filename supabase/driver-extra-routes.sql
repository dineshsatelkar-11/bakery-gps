-- Extra route log (salary auto-fills from this)
create table if not exists driver_extra_routes (
  id bigserial primary key,
  driver_name text not null,
  date date not null,
  days numeric default 1,
  rate numeric default 0,
  amount numeric default 0,
  note text,
  created_at timestamptz default now()
);
create index if not exists idx_driver_extra_routes_drv_date on driver_extra_routes (driver_name, date);
