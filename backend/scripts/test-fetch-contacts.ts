import axios from 'axios';

const BASE = 'http://localhost:5000/api';

async function run() {
  try {
    console.log('Testing GET /api/contacts');

    // Login
    const login = await axios.post(`${BASE}/auth/login`, 
      { email: 'test+tags@example.com', password: 'password123' }, 
      { withCredentials: true }
    );
    const accessToken = login.data.accessToken;
    console.log('✅ Logged in');

    const authHeader = { headers: { Authorization: `Bearer ${accessToken}` }, withCredentials: true };

    // Fetch all contacts
    const resp = await axios.get(`${BASE}/contacts`, authHeader);
    console.log('✅ Fetched contacts successfully');
    console.log(`Total contacts: ${resp.data.pagination.total}`);
    console.log(`Page: ${resp.data.pagination.page}/${resp.data.pagination.pages}`);
    console.log('');

    // Show first 3 contacts with their tags
    console.log('First 3 contacts:');
    resp.data.contacts.slice(0, 3).forEach((contact: any, idx: number) => {
      console.log(`${idx + 1}. ${contact.name} (${contact.phone})`);
      console.log(`   Status: ${contact.status}`);
      console.log(`   tagIds: ${contact.tagIds ? contact.tagIds.join(', ').slice(0, 50) : 'none'}`);
      console.log(`   tags: ${contact.tags ? `${contact.tags.length} objects` : 'undefined'}`);
      console.log('');
    });

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Test failed:', error.response?.data || error.message || error);
    process.exit(1);
  }
}

run();
