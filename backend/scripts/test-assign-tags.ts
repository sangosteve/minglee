import axios from 'axios';

const BASE = 'http://localhost:5000/api';

async function run() {
  try {
    console.log('Starting tag assignment test');

    // 1) Register a test user (if exists, login)
    const testUser = {
      name: 'Test User',
      email: 'test+tags@example.com',
      password: 'password123',
    };

    let accessToken = '';

    try {
      const reg = await axios.post(`${BASE}/auth/register`, testUser, { withCredentials: true });
      console.log('Register response:', reg.data);
      accessToken = reg.data.accessToken || '';
    } catch (err: any) {
      console.error('Register failed:', err.response?.status, err.response?.data);
      if (err.response && (err.response.status === 409 || err.response.data?.error === 'User already exists')) {
        console.log('User already exists, attempting to login...');
        const login = await axios.post(`${BASE}/auth/login`, { email: testUser.email, password: testUser.password }, { withCredentials: true });
        console.log('Login response:', login.data);
        accessToken = login.data.accessToken || '';
      } else {
        throw err;
      }
    }

    if (!accessToken) throw new Error('No access token obtained');

    const authHeader = { headers: { Authorization: `Bearer ${accessToken}` }, withCredentials: true };

    // 2) Create a tag
    const tagPayload = { name: `test-tag-${Date.now()}`, color: '#ff0000', description: 'Tag for automated test' };
    const createTag = await axios.post(`${BASE}/tags`, tagPayload, authHeader);
    console.log('Created tag:', createTag.data);
    const tagId = createTag.data.tag.id;

    // 3) Create a contact without tags
    const contactPayload = { name: `Test Contact ${Date.now()}`, phone: `+100000${Math.floor(Math.random()*10000)}` };
    const createContact = await axios.post(`${BASE}/contacts`, contactPayload, authHeader);
    console.log('Created contact:', createContact.data);
    const contactId = createContact.data.contact.id;

    // 4) Add tag to contact via dedicated endpoint (POST /contacts/:id/tags)
    const addTagResp = await axios.post(`${BASE}/contacts/${contactId}/tags`, { tags: [tagId] }, authHeader);
    console.log('Add tag response:', addTagResp.data);

    // 5) Fetch contact and check tags via single contact endpoint
    const fetched = await axios.get(`${BASE}/contacts/${contactId}`, authHeader);
    console.log('Fetched contact:', fetched.data);

    const assignedTags = fetched.data.contact.tags || [];
    if (!assignedTags.find((t: any) => t.id === tagId)) {
      console.error('FAIL: Tag not found on contact (single endpoint)');
      process.exit(2);
    }

    // 6) Fetch contact list and ensure assigned tag is present in list response as well
    try {
      const listResp = await axios.get(`${BASE}/contacts`, authHeader);
      console.log('List response:', JSON.stringify(listResp.data, null, 2));
      const listed = listResp.data.contacts.find((c: any) => c.id === contactId);
      console.log('Found in list:', listed);
      const listedTags = listed?.tags || [];
      const listedTagIds = listed?.tagIds || [];
      
      console.log('Listed tags:', listedTags);
      console.log('Listed tagIds:', listedTagIds);
      
      if (listedTags.find((t: any) => t.id === tagId) || listedTagIds.includes(tagId)) {
        console.log('SUCCESS: Tag appears on contact in list response');
        process.exit(0);
      } else {
        console.error('FAIL: Tag not found on contact in list response');
        process.exit(2);
      }
    } catch (err: any) {
      console.error('Error fetching list:', err.response?.data || err.message);
      process.exit(1);
    }

  } catch (error: any) {
    console.error('Test failed:', error.response?.data || error.message || error);
    process.exit(1);
  }
}

run();
