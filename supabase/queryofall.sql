create table public.doctors (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  email text null,
  phone text null,
  address text not null,
  hospital text not null,
  specialization text not null,
  is_verified boolean null default false,
  added_by uuid null,
  created_at timestamp with time zone null default now(),
  area_region text null,
  area text not null default ''::text,
  "City" text null,
  constraint doctors_pkey primary key (id),
  constraint doctors_added_by_fkey foreign KEY (added_by) references profiles (id)
) TABLESPACE pg_default;

create index IF not exists idx_doctors_hospital on public.doctors using btree (hospital) TABLESPACE pg_default;

create index IF not exists idx_doctors_specialization on public.doctors using btree (specialization) TABLESPACE pg_default;

create table public.medical_visit_orders (
  id uuid not null default gen_random_uuid (),
  medical_visit_id uuid not null,
  medicine_id uuid not null,
  quantity integer not null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint medical_visit_orders_pkey primary key (id),
  constraint medical_visit_orders_medical_visit_id_fkey foreign KEY (medical_visit_id) references medical_visits (id),
  constraint medical_visit_orders_medicine_id_fkey foreign KEY (medicine_id) references medicines (id)
) TABLESPACE pg_default;

create table public.medical_visits (
  id uuid not null default gen_random_uuid (),
  medical_area_id uuid not null,
  visit_date date not null,
  notes text null,
  status character varying(20) not null,
  mr_id uuid not null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint medical_visits_pkey primary key (id),
  constraint fk_medical_visits_medical_id foreign KEY (medical_area_id) references medicals (id),
  constraint fk_medical_visits_mr_id foreign KEY (mr_id) references profiles (id)
) TABLESPACE pg_default;

create table public.medicals (
  id uuid not null default gen_random_uuid (),
  name text not null,
  address text null,
  area text null,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  user_id uuid null,
  constraint medicals_pkey primary key (id),
  constraint medicals_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;

create index IF not exists idx_medicals_user_id on public.medicals using btree (user_id) TABLESPACE pg_default;

create table public.medicines (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  category text not null,
  type text not null,
  description text null,
  created_at timestamp with time zone null default now(),
  constraint medicines_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_medicines_category on public.medicines using btree (category) TABLESPACE pg_default;

create table public.profiles (
  id uuid not null default extensions.uuid_generate_v4 (),
  email text not null,
  name text not null,
  role text not null,
  status text not null,
  region text null,
  created_at timestamp with time zone null default now(),
  password text null,
  constraint profiles_pkey primary key (id),
  constraint profiles_email_key unique (email)
) TABLESPACE pg_default;

create table public.visit_orders (
  id uuid not null default extensions.uuid_generate_v4 (),
  visit_id uuid null,
  medicine_id uuid null,
  quantity integer not null,
  created_at timestamp with time zone null default now(),
  constraint visit_orders_pkey primary key (id),
  constraint visit_orders_medicine_id_fkey foreign KEY (medicine_id) references medicines (id),
  constraint visit_orders_visit_id_fkey foreign KEY (visit_id) references visits (id)
) TABLESPACE pg_default;

create table public.visits (
  id uuid not null default extensions.uuid_generate_v4 (),
  mr_id uuid null,
  doctor_id uuid null,
  date date not null,
  status text not null,
  notes text null,
  created_at timestamp with time zone null default now(),
  constraint visits_pkey primary key (id),
  constraint visits_doctor_id_fkey foreign KEY (doctor_id) references doctors (id),
  constraint visits_mr_id_fkey foreign KEY (mr_id) references profiles (id)
) TABLESPACE pg_default;

create index IF not exists idx_visits_date on public.visits using btree (date) TABLESPACE pg_default;

create index IF not exists idx_visits_mr_id on public.visits using btree (mr_id) TABLESPACE pg_default;

create index IF not exists idx_visits_doctor_id on public.visits using btree (doctor_id) TABLESPACE pg_default;