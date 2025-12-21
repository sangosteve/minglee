import axios from 'axios';

const BASE = process.env.BASE || 'http://localhost:5000/api';
const TEST_EMAIL = 'test+tags@example.com';
const TEST_PASS = 'password123';

(async () => {
  try {
    console.log('Starting new analytics test');

    const login = await axios.post(`${BASE}/auth/login`, { email: TEST_EMAIL, password: TEST_PASS });
    console.log('Login response:', login.data);

    const authHeader = { headers: { Authorization: `Bearer ${login.data.accessToken}` } };
    const respNew = await axios.get(`${BASE}/analytics/contacts/overview`, authHeader);
    console.log('New analytics route response:', JSON.stringify(respNew.data, null, 2));

    const respOld = await axios.get(`${BASE}/contacts/analytics/overview`, authHeader);
    console.log('Old contacts analytics route response:', JSON.stringify(respOld.data, null, 2));
    process.exit(0);
  } catch (err: any) {
    console.error('Test failed:', err.response?.data || err.message);
    process.exit(1);
  }
})();