// frontend/src/lib/system-variables.ts
import { VariableService } from "./variable-service";

// Helper functions
export const containsVariables = (text: string): boolean => {
  return /\{\{([^}]+)\}\}/.test(text);
};

export const extractVariables = (text: string): string[] => {
  return VariableService.extractVariables(text);
};

export const resolveVariable = (text: string, contactData: any, userData?: any, conversationData?: any): string => {
  return VariableService.replaceVariables(text, {
    contact: contactData,
    user: userData,
    conversation: conversationData
  });
};

// System variables configuration for UI
export const SYSTEM_VARIABLES = [
  // Contact variables
  { key: 'contact.name', label: 'contact.name', description: "Contact's full name", category: 'contact', example: "John Doe" },
  { key: 'contact.firstName', label: 'contact.firstName', description: "Contact's first name", category: 'contact', example: "John" },
  { key: 'contact.lastName', label: 'contact.lastName', description: "Contact's last name", category: 'contact', example: "Doe" },
  { key: 'contact.phone', label: 'contact.phone', description: "Contact's phone number", category: 'contact', example: "+1234567890" },
  { key: 'contact.email', label: 'contact.email', description: "Contact's email address", category: 'contact', example: "john@example.com" },
  { key: 'contact.city', label: 'contact.city', description: "Contact's city", category: 'contact', example: "New York" },
  { key: 'contact.country', label: 'contact.country', description: "Contact's country", category: 'contact', example: "USA" },
  { key: 'contact.status', label: 'contact.status', description: "Contact's status", category: 'contact', example: "Active" },
  { key: 'contact.tags', label: 'contact.tags', description: "Contact's tags (comma-separated)", category: 'contact', example: "VIP, Customer" },
  
  // User/Agent variables
  { key: 'user.name', label: 'user.name', description: "Your full name", category: 'user', example: "Jane Smith" },
  { key: 'user.firstName', label: 'user.firstName', description: "Your first name", category: 'user', example: "Jane" },
  { key: 'user.lastName', label: 'user.lastName', description: "Your last name", category: 'user', example: "Smith" },
  { key: 'user.email', label: 'user.email', description: "Your email", category: 'user', example: "jane@example.com" },
  { key: 'user.company', label: 'user.company', description: "Your company name", category: 'user', example: "Our Company" },
  
  // Date/Time variables
  { key: 'date.today', label: 'date.today', description: "Today's date", category: 'date', example: "16/12/2025" },
  { key: 'date.current', label: 'date.current', description: "Current date", category: 'date', example: "16/12/2025" },
  { key: 'time.current', label: 'time.current', description: "Current time", category: 'date', example: "21:30" },
  { key: 'time.now', label: 'time.now', description: "Current time", category: 'date', example: "21:30" },
  { key: 'day.today', label: 'day.today', description: "Today's day", category: 'date', example: "Tuesday" },
  { key: 'date.year', label: 'date.year', description: "Current year", category: 'date', example: "2025" },
  { key: 'date.month', label: 'date.month', description: "Current month", category: 'date', example: "12" },
  { key: 'date.day', label: 'date.day', description: "Current day of month", category: 'date', example: "16" },
  { key: 'date.hour', label: 'date.hour', description: "Current hour", category: 'date', example: "21" },
  { key: 'date.minute', label: 'date.minute', description: "Current minute", category: 'date', example: "30" },
  
  // Company variables
  { key: 'company.name', label: 'company.name', description: "Company name", category: 'company', example: "Our Company" },
  { key: 'company.phone', label: 'company.phone', description: "Company phone", category: 'company', example: "" },
  { key: 'company.email', label: 'company.email', description: "Company email", category: 'company', example: "" },
  { key: 'company.website', label: 'company.website', description: "Company website", category: 'company', example: "" },
];

export const VARIABLE_CATEGORIES = [
  { key: 'contact', label: 'Contact Information' },
  { key: 'user', label: 'User/Agent Information' },
  { key: 'date', label: 'Date & Time' },
  { key: 'company', label: 'Company Information' },
];