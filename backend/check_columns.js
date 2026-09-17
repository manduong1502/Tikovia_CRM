import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  try {
    const { data: plans, error: pError } = await supabase.from('content_plans').select('*').limit(1);
    if (pError) console.error("Error p:", pError);
    else if (plans && plans.length > 0) console.log("content_plans columns:", Object.keys(plans[0]));

    const { data: posts, error: poError } = await supabase.from('published_contents').select('*').limit(1);
    if (poError) console.error("Error po:", poError);
    else if (posts && posts.length > 0) console.log("published_contents columns:", Object.keys(posts[0]));
  } catch (err) {
    console.error("Catch error:", err);
  }
}

checkColumns();
