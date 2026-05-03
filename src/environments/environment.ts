// This file is replaced during prod builds via angular.json fileReplacements.
// Default = development.
//
// Supabase — Project Settings → API in the Supabase dashboard.
// Only the anon/public key is allowed here; it ships in the browser bundle and
// relies on Row Level Security for protection. NEVER use the service_role key.

export const environment = {
    production: false,
    supabaseUrl: 'https://nnairidnjxnstgdkmqne.supabase.co',
    supabaseAnonKey:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uYWlyaWRuanhuc3RnZGttcW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjkwNzIsImV4cCI6MjA5MjM0NTA3Mn0.O0WC6nWjGNY_iWf6-cJJmQCQuX-9ji-COFZa3r8FhJc'
};
