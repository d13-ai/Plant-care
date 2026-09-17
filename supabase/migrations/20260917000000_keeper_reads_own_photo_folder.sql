-- Photo uploads have been failing since 20260915050000 dropped the blanket
-- public SELECT on storage.objects.
--
-- That drop was right: the policy let anyone holding the publishable key list
-- every keeper's photo paths, published or not. What it missed is that writing
-- an object also reads one back — the storage API returns the row it just
-- wrote — and it was the only SELECT policy on the table, so afterwards a
-- keeper could not see even their own. Every upload came back 400, "new row
-- violates row-level security policy", and the photo stayed stuck on the phone
-- with the sync wedged behind it.
--
-- It went unnoticed because downloads never broke: the bucket is public and
-- public reads bypass RLS, so existing photos kept showing and only new ones
-- failed. The first new photo after the hardening is what found it.
--
-- A keeper may read their own folder, and only their own. That is what the
-- upload needs, and it does not bring the enumeration back: anon gets nothing,
-- and one keeper still cannot list another's.
create policy "plant-photos: keeper reads own folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
