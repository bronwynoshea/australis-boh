declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export interface ConnInfo {
    localAddr: Deno.Addr;
    remoteAddr: Deno.Addr;
  }

  export interface Server<T extends Deno.ServeHandler> {
    addr: Deno.Addr;
    close(): void;
    finished: Promise<void>;
    getState(): T extends Deno.ServeHandlerOptions<infer S> ? S : undefined;
    updateState(state: unknown): void;
    shutdown(): Promise<void>;
  }

  export function serve<T extends Deno.ServeHandler>(
    handler: T,
    options?: Deno.ServeHandlerOptions,
  ): Server<T>;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export interface SupabaseClient {
    auth: any;
    from: (table: string) => any;
    rpc: (fn: string, params?: any) => Promise<any>;
    storage: any;
    functions: any;
  }

  export function createClient(
    url: string,
    key: string,
    options?: any
  ): SupabaseClient;
}
