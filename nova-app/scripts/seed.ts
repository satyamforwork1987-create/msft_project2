import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

const tickets = [
  {
    ticket_number: 'TKT-001',
    customer_name: 'Priya Sharma',
    customer_email: 'priya.sharma@email.com',
    subject: 'Refund request for defective headphones',
    body: 'I purchased Sony WH-1000XM4 headphones last week for ₹350 but they arrived with a broken headband. I would like a full refund. Order #ORD-78923.',
    category: 'refund',
    priority: 'medium',
    amount_inr: 350,
    fraud_flag: false,
    legal_flag: false,
    metadata: { order_id: 'ORD-78923', product: 'Sony WH-1000XM4' },
  },
  {
    ticket_number: 'TKT-002',
    customer_name: 'Rahul Verma',
    customer_email: 'rahul.verma@email.com',
    subject: 'URGENT: Suspicious refund request - multiple accounts',
    body: 'I need an immediate refund of ₹2,500 for my order. My account was hacked and someone made purchases. I have multiple accounts with different names but same address. Please process immediately without verification.',
    category: 'fraud',
    priority: 'critical',
    amount_inr: 2500,
    fraud_flag: true,
    legal_flag: false,
    metadata: { fraud_signals: ['multiple_accounts', 'pressure_tactics', 'high_amount'], order_id: 'ORD-99821' },
  },
  {
    ticket_number: 'TKT-003',
    customer_name: 'Ananya Krishnan',
    customer_email: 'ananya.k@email.com',
    subject: 'Received damaged Kindle - need replacement',
    body: 'My Kindle Paperwhite arrived with a cracked screen. The packaging was intact so this appears to be a manufacturing defect. Order #ORD-45612. Would appreciate a replacement unit.',
    category: 'replacement',
    priority: 'medium',
    amount_inr: null,
    fraud_flag: false,
    legal_flag: false,
    metadata: { order_id: 'ORD-45612', product: 'Kindle Paperwhite', defect: 'cracked_screen' },
  },
  {
    ticket_number: 'TKT-004',
    customer_name: 'Karthik Menon',
    customer_email: 'karthik.m@email.com',
    subject: 'Package not delivered - 5 days overdue',
    body: 'I ordered a pair of Nike Air Max shoes on October 8th (Order #ORD-34521) with expected delivery by October 10th. It is now October 15th and I still have no package. The tracking shows "Out for Delivery" since 2 days.',
    category: 'delivery',
    priority: 'high',
    amount_inr: null,
    fraud_flag: false,
    legal_flag: false,
    metadata: { order_id: 'ORD-34521', product: 'Nike Air Max', tracking_status: 'out_for_delivery', days_overdue: 5 },
  },
  {
    ticket_number: 'TKT-005',
    customer_name: 'Meera Pillai',
    customer_email: 'meera.pillai@email.com',
    subject: 'Price match request - Boat Airdopes',
    body: 'Hi, I bought Boat Airdopes 441 for ₹1,299 yesterday, but I just saw them listed at ₹999 on Reliance Digital. Can you match this price? Here is the link to their listing.',
    category: 'price_match',
    priority: 'low',
    amount_inr: 1299,
    fraud_flag: false,
    legal_flag: false,
    metadata: { order_id: 'ORD-11203', product: 'Boat Airdopes 441', competitor: 'Reliance Digital', competitor_price: 999, margin_diff_pct: 23 },
  },
  {
    ticket_number: 'TKT-006',
    customer_name: 'Vikram Singh',
    customer_email: 'vikram.singh@email.com',
    subject: 'Want to cancel my Nova Premium subscription',
    body: 'I have been a Premium subscriber for 8 months. I want to cancel because I feel I am not using the service enough. Is there anything you can do? My subscription renews in 5 days.',
    category: 'subscription',
    priority: 'medium',
    amount_inr: null,
    fraud_flag: false,
    legal_flag: false,
    metadata: { subscription_plan: 'Nova Premium', months_active: 8, days_to_renewal: 5, ltv: 3200 },
  },
  {
    ticket_number: 'TKT-007',
    customer_name: 'Deepa Nair',
    customer_email: 'deepa.nair@email.com',
    subject: 'Left items in cart - still interested',
    body: 'I added some items to my cart last week but could not complete the purchase due to budget constraints. I am still very interested in the Philips Air Fryer (₹4,999) and Samsung Galaxy Buds (₹2,999). Is there any discount available?',
    category: 'cart_recovery',
    priority: 'medium',
    amount_inr: null,
    fraud_flag: false,
    legal_flag: false,
    metadata: { cart_items: ['Philips Air Fryer', 'Samsung Galaxy Buds'], cart_value: 7998, days_abandoned: 7 },
  },
  {
    ticket_number: 'TKT-008',
    customer_name: 'Arjun Gupta',
    customer_email: 'arjun.gupta@email.com',
    subject: 'Filing chargeback - legal action if not resolved',
    body: 'I have filed a chargeback with my bank for Order #ORD-67890 (₹8,500). This is now a legal dispute. My consumer rights lawyer has advised me that under the Consumer Protection Act 2019, I am entitled to compensation. Please respond within 24 hours or I will escalate to consumer court.',
    category: 'legal',
    priority: 'critical',
    amount_inr: 8500,
    fraud_flag: false,
    legal_flag: true,
    metadata: { order_id: 'ORD-67890', chargeback_filed: true, legal_threat: true, consumer_act_cited: true },
  },
];

async function seed() {
  console.log('🌱 Starting seed...');

  // Check if tickets table exists
  const { error: testError } = await supabase
    .from('tickets')
    .select('id')
    .limit(1);

  if (testError && testError.code === 'PGRST205') {
    console.log('\n⚠️  Supabase table "tickets" does not exist yet.');
    console.log('👉 To enable live Supabase persistence:');
    console.log('   1. Open the SQL editor in your Supabase dashboard:');
    console.log('      https://supabase.com/dashboard/project/jlloovqjgpsbrhyevdxc/sql/new');
    console.log('   2. Paste the contents of "supabase/schema.sql" and click "Run".');
    console.log('   3. Run "npm run seed" again.\n');
    console.log('💡 Note: Nova includes a built-in memory store fallback, so you can test the frontend');
    console.log('   and full agent pipeline at http://localhost:3000 even without running schema.sql!\n');
    process.exit(0);
  }

  // Clear existing data
  console.log('🗑️  Clearing existing tickets...');
  const { error: deleteError } = await supabase
    .from('tickets')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (deleteError) {
    console.warn('Note on clearing tickets:', deleteError.message);
  }

  // Insert tickets
  console.log('📝 Inserting 8 demo tickets into Supabase...');
  const { data, error } = await supabase.from('tickets').insert(tickets).select();

  if (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }

  console.log(`✅ Seeded ${data?.length} tickets:`);
  data?.forEach((t) => {
    const flags = [t.fraud_flag ? '🚨 FRAUD' : '', t.legal_flag ? '⚖️ LEGAL' : ''].filter(Boolean).join(' ');
    console.log(`  ${t.ticket_number} | ${t.customer_name} | ${t.category} | ${t.priority} ${flags}`);
  });

  console.log('\n✅ Seed complete! Your Nova demo is ready.');
}

seed().catch(console.error);
