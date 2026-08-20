alter table public.hotel_security_logs
  add column if not exists nationality text,
  add column if not exists id_expiry_date date;

create index if not exists hotel_security_logs_doc_number_idx
  on public.hotel_security_logs (doc_number);

create index if not exists hotel_security_logs_mobile_number_idx
  on public.hotel_security_logs (mobile_number);

create index if not exists hotel_security_logs_vehicle_plate_idx
  on public.hotel_security_logs (vehicle_plate);
