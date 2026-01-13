// frontend/src/lib/contacts-utils.ts
import type { Contact } from '@/lib/api/contacts';


export interface CSVContact {
  name: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  country?: string;
  status?: string;
  tags?: string;
  note?: string;
}

export const validateCSVRow = (row: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!row.name?.trim()) {
    errors.push('Name is required');
  }
  
  if (!row.phone?.trim()) {
    errors.push('Phone is required');
  } else {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(row.phone.replace(/\s+/g, ''))) {
      errors.push('Phone must be a valid international number');
    }
  }
  
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push('Email must be valid');
  }
  
  const validStatuses = ['active', 'inactive', 'lead', 'customer', 'blocked', 'archived'];
  if (row.status && !validStatuses.includes(row.status.toLowerCase())) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const parseCSV = (text: string): CSVContact[] => {
  const lines = text.split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const contacts: CSVContact[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = lines[i].split(',').map(v => v.trim());
    const contact: CSVContact = {
      name: '',
      phone: '',
    };
    
    headers.forEach((header, index) => {
      if (values[index]) {
        switch (header) {
          case 'name':
          case 'phone':
          case 'email':
          case 'city':
          case 'state':
          case 'country':
          case 'status':
          case 'tags':
          case 'note':
            (contact as any)[header] = values[index];
            break;
        }
      }
    });
    
    contacts.push(contact);
  }
  
  return contacts;
};

export const generateCSV = (contacts: Contact[]): string => {
  const headers = ['Name', 'Phone', 'Email', 'City', 'State', 'Country', 'Status', 'Tags', 'Created At'];
  
  const rows = contacts.map(contact => [
    contact.name || '',
    contact.phone || '',
    contact.email || '',
    contact.city || '',
    contact.state || '',
    contact.country || '',
    contact.status || '',
    (Array.isArray(contact.tags) ? contact.tags.map(t => 
      typeof t === 'object' ? t.name || t.label : t
    ).join('; ') : ''),
    new Date(contact.createdAt).toLocaleDateString(),
  ]);
  
  return [headers, ...rows].map(row => 
    row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');
};

export const downloadCSV = (csvContent: string, filename: string = 'contacts.csv') => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const importContactsFromCSV = async (
  file: File,
  onProgress: (progress: {
    total: number;
    processed: number;
    success: number;
    failed: number;
    errors: string[];
  }) => void,
  createContactApi: (data: any) => Promise<any>
): Promise<void> => {
  const text = await file.text();
  const contacts = parseCSV(text);
  
  const progress = {
    total: contacts.length,
    processed: 0,
    success: 0,
    failed: 0,
    errors: [] as string[],
  };
  
  onProgress(progress);
  
  for (const contact of contacts) {
    try {
      const { isValid, errors } = validateCSVRow(contact);
      
      if (!isValid) {
        progress.failed++;
        progress.errors.push(`Row ${progress.processed + 1}: ${errors.join(', ')}`);
      } else {
        // Transform CSV data to API format
        const apiData: any = {
          name: contact.name.trim(),
          phone: contact.phone.trim(),
        };
        
        if (contact.email) apiData.email = contact.email.trim();
        if (contact.city) apiData.city = contact.city.trim();
        if (contact.state) apiData.state = contact.state.trim();
        if (contact.country) apiData.country = contact.country.trim();
        if (contact.status) apiData.status = contact.status.trim().toLowerCase();
        if (contact.note) apiData.note = contact.note.trim();
        
        if (contact.tags) {
          const tags = contact.tags.split(';').map(t => t.trim()).filter(t => t);
          if (tags.length > 0) {
            apiData.tags = tags;
          }
        }
        
        await createContactApi(apiData);
        progress.success++;
      }
    } catch (error: any) {
      progress.failed++;
      progress.errors.push(`Row ${progress.processed + 1}: ${error.message || 'Unknown error'}`);
    }
    
    progress.processed++;
    onProgress({ ...progress });
  }
};