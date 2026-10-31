-- Un document peut être justifié par un fichier (Cloudinary, privé) OU par un lien https (Drive, SharePoint…). Les deux sont facultatifs.
alter table public.staff_documents add column if not exists link_url text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'staff_documents_link_https') then
    alter table public.staff_documents add constraint staff_documents_link_https
      check (link_url is null or (link_url ~* '^https://[^\s]+$' and length(link_url) <= 500));
  end if;
end $$;
