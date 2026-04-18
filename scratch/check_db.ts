
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wqwtfcmgeuxzfejpveyx.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indxd3RmY21nZXV4emZlanB2ZXl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk4OTYzNiwiZXhwIjoyMDkxNTY1NjM2fQ.9UlNX65XumifylLWq74ZvKHp8ig1_k_YKKFwyNEn2a0'

const admin = createClient(supabaseUrl, supabaseServiceKey)

async function checkData() {
  console.log("--- PROBING DATABASE ---")
  
  // 1. check topics count
  const { count: topicCount } = await admin.from('topics').select('*', { count: 'exact', head: true })
  console.log("Total topics:", topicCount)

  // 2. check questions count
  const { count: qCount } = await admin.from('exam_questions').select('*', { count: 'exact', head: true })
  console.log("Total questions:", qCount)

  // 3. check questions with topic_id
  const { count: qWithTopicCount } = await admin.from('exam_questions').select('*', { count: 'exact', head: true }).not('topic_id', 'is', null)
  console.log("Questions with topic_id:", qWithTopicCount)

  // 4. check specific topics (first 5)
  const { data: topics } = await admin.from('topics').select('id, title').limit(5)
  console.log("Sample topics:", topics)

  if (topics && topics.length > 0) {
    for (const t of topics) {
      const { count } = await admin.from('exam_questions').select('*', { count: 'exact', head: true }).eq('topic_id', t.id)
      console.log(`Topic "${t.title}" (${t.id}) has ${count} questions.`)
    }
  }
}

checkData()
