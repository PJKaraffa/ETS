const SUPABASE_URL = "https://aqqwgzdmwazzvapyfvzx.supabase.co";
const SUPABASE_KEY = "sb_publishable_Y5_yifLRZTKIF1HO-EfSdQ_K19NxATf";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      persistSession: true,
      storage: window.sessionStorage,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
