const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    name: String, email: String, mpin: String, password: String,
    role: String, isActive: Boolean, permissions: mongoose.Schema.Types.Mixed
  }, { strict: false }));
  const hashed = await bcrypt.hash('123456', 12);
  const result = await User.updateOne(
    { email: 'admin@example.com' },
    {
      $set: {
        mpin: hashed,
        role: 'admin',
        permissions: { assets: true, events: true, movements: true, persons: true, reports: true, categories: true, users: true }
      },
      $unset: { password: '' }
    }
  );
  console.log('Admin migrated:', result.modifiedCount, 'doc(s) updated. MPIN is 123456');
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
