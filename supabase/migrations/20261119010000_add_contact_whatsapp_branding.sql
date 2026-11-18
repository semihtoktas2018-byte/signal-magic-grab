-- Buyer-specific WhatsApp contact for white-label sales/support CTAs.
-- Empty by default: a fresh buyer deployment must configure its own contact.
alter table public.app_branding
  add column if not exists contact_whatsapp text not null default '';
