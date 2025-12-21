import { getContactsOverview } from '../src/services/analytics.service';

(async () => {
  try {
    const userId = '6fa80266-55be-4e84-a428-b1512fb76f13';
    const result = await getContactsOverview(userId);
    console.log('Service result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err: any) {
    console.error('Service error:', err.message || err, err.stack || '');
    process.exit(1);
  }
})();