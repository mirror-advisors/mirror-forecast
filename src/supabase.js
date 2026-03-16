import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://pkphesuvwzlowbssepxi.supabase.co'
const supabaseKey = 'sb_publishable_CF_Xb2Ydv7rY55oRvrwU7w_pFHkBbY5'
export const supabase = createClient(supabaseUrl, supabaseKey)
