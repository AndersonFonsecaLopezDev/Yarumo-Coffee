-- Defense in depth: `app/staff/page.tsx` already checks MIME type and file size
-- client-side before uploading, but a browser check can always be bypassed
-- (devtools, direct API calls, a modified client, etc). Enforce the same
-- constraints server-side, at the storage bucket level, so Supabase Storage
-- itself rejects any object that doesn't match, regardless of who/what uploads it.
--
-- 5 MB matches the limit already communicated to staff in the upload form.
update storage.buckets
set
  file_size_limit = 5 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'menu-images';
