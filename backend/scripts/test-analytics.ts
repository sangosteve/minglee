import axios from 'axios';

const BASE = process.env.BASE || 'http://localhost:5000/api';
const TEST_EMAIL = 'test+tags@example.com';
const TEST_PASS = 'password123';

(async () => {
  try {
    console.log('Starting analytics test');

    // Login
    const loginResp = await axios.post(`${BASE}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASS,
    }, { withCredentials: true });

    console.log('Login response:', loginResp.data);

    // Fetch analytics (use access token)
    const authHeader = { headers: { Authorization: `Bearer ${loginResp.data.accessToken}` }, withCredentials: true };
    const resp = await axios.get(`${BASE}/contacts/analytics/overview`, authHeader);

    console.log('Analytics response:', JSON.stringify(resp.data, null, 2));
    process.exit(0);
  } catch (err: any) {
    console.error('Test failed:', err.response?.data || err.message);
    process.exit(1);
  }
})();