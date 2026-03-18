// supabaseClient.js
require('dotenv').config(); 
const { createClient } = require('@supabase/supabase-js');

// Grab the hidden variables using the new names
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;