import { createClient } from "@/lib/supabase/client";

/** Browser Supabase client (cookie-backed session for admin auth). */
export const supabase = createClient();