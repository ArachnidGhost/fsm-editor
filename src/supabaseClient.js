import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lkyhrhpenuutrkijtzrb.supabase.co'
const supabaseKey = 'sb_publishable_JSSSZeYTLCQwV6OAtdE0yw_Y3ysrbaK'
export const supabase = createClient(supabaseUrl, supabaseKey)