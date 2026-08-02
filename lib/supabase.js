import { createClient } from '@supabase/supabase-js';

// Essas duas informações vieram do seu painel do Supabase (Settings > API).
// A "publishable key" é segura pra ficar aqui — ela só faz o que as
// regras de acesso do banco (as "policies" que criamos no SQL) permitirem.
const SUPABASE_URL = 'https://uyguoslkfxhxqotlinds.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dXPnNErePxcuVaslRc1PBA_aS_eBZRc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
