const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkSubject() {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, slug, title')
    .eq('slug', 'est-1-math-core')
    .single()

  if (error) {
    console.error('Error fetching subject:', error.message)
  } else {
    console.log('Subject found:', data)
  }
}

checkSubject()
