// Test M-Pesa Credentials
import axios from 'axios';
import 'dotenv/config';

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;

if (!CONSUMER_KEY || !CONSUMER_SECRET) throw new Error('MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET are required.');

async function testCredentials() {
  try {
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    
    console.log('Testing M-Pesa credentials...');
    console.log('Consumer Key: ' + CONSUMER_KEY.substring(0, 10) + '...');
    console.log('Connecting to sandbox.safaricom.co.ke...\n');
    
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );
    
    console.log('✅ SUCCESS! Your credentials are valid!');
    console.log('\nAccess Token obtained:');
    console.log('Token: ' + response.data.access_token.substring(0, 30) + '...');
    console.log('Expires in: ' + response.data.expires_in + ' seconds');
    
  } catch (error) {
    console.log('❌ ERROR! Credentials test failed:');
    console.log('Error:', error.response?.data?.error_description || error.message);
    process.exit(1);
  }
}

testCredentials();
