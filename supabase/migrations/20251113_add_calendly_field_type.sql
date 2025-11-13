-- Add 'calendly' to allowed form_fields.type values
-- If the type is constrained via a CHECK constraint, recreate it to include 'calendly'
ALTER TABLE public.form_fields DROP CONSTRAINT IF EXISTS form_fields_type_check;
ALTER TABLE public.form_fields
  ADD CONSTRAINT form_fields_type_check
  CHECK (type IN (
    'short_text',
    'long_text',
    'email',
    'phone',
    'dropdown',
    'multi_select',
    'checkbox',
    'date',
    'rating',
    'file_upload',
    'section',
    'calendly'
  ));

COMMENT ON CONSTRAINT form_fields_type_check ON public.form_fields IS 'Allowed field types including calendly embed';


