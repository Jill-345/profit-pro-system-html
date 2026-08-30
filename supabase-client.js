/* ==========================================================================
   DRR Bakery — Supabase connection
   Loaded on every page, right after the Supabase library and before script.js.

   The anon/public key below is SAFE to have in your website's code — it's
   designed to be public. It only lets people do what your Row Level Security
   policies (from supabase-rls.sql) allow them to do. NEVER put the
   "service_role" key here or anywhere in your website's files — that one
   bypasses all security rules.
   ========================================================================== */

var SUPABASE_URL = "https://flmazbsfxgaibktfjeuk.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsbWF6YnNmeGdhaWJrdGZqZXVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwNzcxOTIsImV4cCI6MjEwMzY1MzE5Mn0.2vgz33Y3ytnP_bdbRWFk9SV8t2dOPJHtAK2PpH17sx8";

// Creates one shared client that script.js uses everywhere.
var supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);