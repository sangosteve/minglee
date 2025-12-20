import axios from 'axios';

const BASE = process.env.BASE || 'http://localhost:5000/api';
const TEST_EMAIL = 'test+tags@example.com';
const TEST_PASS = 'password123';

(async () => {
  try {
    const login = await axios.post(`${BASE}/auth/login`, { email: TEST_EMAIL, password: TEST_PASS });
    const authHeader = { headers: { Authorization: `Bearer ${login.data.accessToken}` } };

    const respOld = await axios.get(`${BASE}/contacts/analytics/overview`, authHeader);
    console.log('Old contacts analytics route response:', JSON.stringify(respOld.data, null, 2));
  } catch (err: any) {
    console.error('Old route error:', err.response?.status, err.response?.data || err.message);
    if (err.response?.data) console.error('Error body:', JSON.stringify(err.response.data, null, 2));
    process.exit(1);
  }
})();