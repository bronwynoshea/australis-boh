declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

declare module 'https://deno.land/std@0.224.0/http/server.ts' {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2.48.0' {
  export function createClient(url: string, key: string, options?: any): any;
}
