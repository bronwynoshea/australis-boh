// Type declarations for Deno modules to fix IDE errors
declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (req: Request) => Promise<Response>): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export function createClient(url: string, key: string): any;
  export interface SupabaseClient {
    from(table: string): any;
    auth: any;
    functions: any;
  }
}

declare module 'https://esm.sh/resend@2.0.0' {
  export class Resend {
    constructor(apiKey: string);
    emails: {
      send(options: {
        from: string;
        to: string[];
        subject: string;
        html: string;
      }): Promise<{ data: any; error: any }>;
    };
  }
}

// Global Deno environment types
declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
  };
}
