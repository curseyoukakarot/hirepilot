interface Lead {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  [key: string]: any;
}

export function personalizeMessage(template: string, lead: Lead): string {
  let message = template;

  // Replace common variables
  const variables = {
    '{{first_name}}': lead.first_name || '',
    '{{last_name}}': lead.last_name || '',
    '{{full_name}}': `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
    '{{company}}': lead.company || '',
    '{{title}}': lead.title || '',
    '{{email}}': lead.email || '',
  };

  // Replace all variables in the template
  Object.entries(variables).forEach(([key, value]) => {
    message = message.replace(new RegExp(key, 'g'), value);
  });

  // Replace any remaining {{path.to.value}} style variables using lead object keys
  message = message.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path) => {
    const value = path.split('.').reduce((acc: any, part: string) => (acc ? acc[part] : undefined), lead);
    return (value !== undefined && value !== null) ? String(value) : _match;
  });

  return message;
} 