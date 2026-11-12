-- Distinguish approval, submission and per-platform publication. Never retry an ambiguous write.
ALTER TABLE public.social_content_drafts DROP CONSTRAINT social_content_drafts_status_check;
ALTER TABLE public.social_content_drafts ADD CONSTRAINT social_content_drafts_status_check
 CHECK(status IN ('drafted','pending_approval','approved','submitting','submitted','publication_unknown','published','rejected'));
