import 'dotenv/config';
console.log('MPESA_MODE:', process.env.MPESA_MODE);
console.log('MPESA_CONSUMER_KEY:', process.env.MPESA_CONSUMER_KEY?.substring(0, 10) + '***');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
