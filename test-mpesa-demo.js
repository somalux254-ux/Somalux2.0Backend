import axios from 'axios';
import 'dotenv/config';

// Simulate a subscription request to test the demo mode
async function testDemoMode() {
  try {
    console.log('🧪 Testing M-Pesa Demo Mode...\n');

    // Using a fake token for testing (in real scenario, this would be a valid Supabase token)
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.token';

    const payload = {
      product: 'books',
      planId: '1m',
      phoneNumber: '0712345678'
    };
 
    console.log('📤 Sending request to /api/subscriptions/mpesa/init');
    console.log('   Payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      'http://localhost:5000/api/subscriptions/mpesa/init',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${fakeToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ SUCCESS! Response from backend:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('\n❌ ERROR:');
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      console.error('Status:', error.response.status);
    } else {
      console.error('Message:', error.message);
    }
    process.exit(1);
  }
}

testDemoMode();
