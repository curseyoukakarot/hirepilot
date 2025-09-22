-- Create avatars bucket if not exists
insert into storage.buckets (id, name, public)
values ('avatars','avatars', true)
on conflict (id) do update set public = true;

-- Allow public read of avatars
drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
on storage.objects for select to public
using ( bucket_id = 'avatars' );

-- Allow authenticated users to insert into their own folder
drop policy if exists "Users insert own avatars" on storage.objects;
create policy "Users insert own avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars' and owner_id::uuid = auth.uid()
);

-- Allow authenticated users to update/delete their own files
drop policy if exists "Users modify own avatars" on storage.objects;
create policy "Users modify own avatars"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars' and owner_id::uuid = auth.uid()
)
with check (
  bucket_id = 'avatars' and owner_id::uuid = auth.uid()
);
    
drop policy if exists "Users delete own avatars" on storage.objects;
create policy "Users delete own avatars"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars' and owner_id::uuid = auth.uid()
);


