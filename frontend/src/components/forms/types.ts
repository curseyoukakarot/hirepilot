import type { FormFieldType } from '../../../../shared/types/forms';

export type BuilderField = {
  id: string;
  label: string;
  type: FormFieldType;
  placeholder?: string | null;
  help_text?: string | null;
  required: boolean;
  options?: any;
  width: 'full' | 'half' | 'third';
  position: number;
};


