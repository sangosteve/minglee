export interface Contact {
  id: string;
  name?: string | null;
  phone?: string | null;
  email: string;
  
  // Location fields
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude?: number | null;
  longitude?: number | null;
  
  note: string;
  userId?: string | null;
  whatsappBusinessId?: string | null;
  whatsappPhoneNumberId?: string | null;
  tags: string[];
  
  status: 'active' | 'inactive' | 'archived' | 'blocked' | 'lead' | 'customer';
  source: 'manual' | 'whatsapp' | 'import' | 'website' | 'api';
  
  isActive: boolean;
  optIn: boolean;
  lastContactedAt?: string | null;
  customFields: Record<string, any>;
  
  createdAt: string;
  updatedAt: string;
  
  // For UI display (can be computed)
  location?: string;
  lastContact?: string;
  totalConversations?: number;
}