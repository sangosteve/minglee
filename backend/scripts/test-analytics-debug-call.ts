import axios from 'axios';

const BASE = process.env.BASE || 'http://localhost:5000';
const userId = '6fa80266-55be-4e84-a428-b1512fb76f13';

(async () => {
  try {
    const resp = await axios.get(`${BASE}/internal-debug/analytics/${userId}`);
    console.log('Debug call response:', JSON.stringify(resp.data, null, 2));
    process.exit(0);
  } catch (err: any) {
    console.error('Debug call failed:', err.response?.data || err.message);
    process.exit(1);
  }
})();