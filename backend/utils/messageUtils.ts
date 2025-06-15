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

  return message;
} 