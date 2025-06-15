export function downloadCSV(data: any[], filename: string) {
  console.log('Starting CSV export with data:', data);
  console.log('Filename:', filename);

  if (!data.length) {
    console.log('No data to export');
    return;
  }

  // Get headers from the first object
  const headers = Object.keys(data[0]);
  console.log('CSV headers:', headers);

  // Convert data to CSV format
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle special cases
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        // Escape commas and quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  console.log('Generated CSV content:', csvContent);

  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  console.log('Triggering download...');
  link.click();
  document.body.removeChild(link);
  console.log('Download triggered');
} 