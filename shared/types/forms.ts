export type FormDestinationType = 'table' | 'lead' | 'candidate';

export type FormFieldType =
  | 'short_text'
  | 'long_text'
  | 'email'
  | 'phone'
  | 'dropdown'
  | 'multi_select'
  | 'checkbox'
  | 'date'
  | 'rating'
  | 'file_upload'
  | 'section';

export interface FormRecord {
  id: string;
  user_id: string;
  workspace_id: string;
  title: string;
  description?: string | null;
  slug: string;
  is_public: boolean;
  theme: Record<string, any>;
  destination_type: FormDestinationType;
  destination_target_id?: string | null;
  job_req_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormFieldRecord {
  id: string;
  form_id: string;
  label: string;
  type: FormFieldType;
  placeholder?: string | null;
  help_text?: string | null;
  required: boolean;
  options?: any | null;
  width: 'full' | 'half' | 'third';
  position: number;
  created_at: string;
  updated_at: string;
}

export interface FormResponseRecord {
  id: string;
  form_id: string;
  submitted_at: string;
  submitted_by_ip?: string | null;
  user_agent?: string | null;
  source?: string | null;
  meta?: any | null;
}

export interface FormResponseValueRecord {
  id: string;
  response_id: string;
  field_id: string;
  value?: string | null;
  json_value?: any | null;
  file_url?: string | null;
}

export interface FormWithFields extends FormRecord {
  fields: FormFieldRecord[];
}

export type PublicForm = FormWithFields;


