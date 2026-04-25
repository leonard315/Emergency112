import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Sequelize } = require('./node_modules/sequelize');
const bcrypt = require('./node_modules/bcrypt');

const s = new Sequelize('Emergency112','root','',{host:'localhost',dialect:'mysql',logging:false});

try {
  await s.authenticate();
  // Show all users first
  const [all] = await s.query('SELECT id,name,email,role FROM Users');
  console.log('All users:', all);
  // Delete duplicate if exists
  await s.query("DELETE FROM Users WHERE email='security@school.edu.ph' AND id != 7");
  const hash = await bcrypt.hash('security123', 10);
  await s.query('UPDATE Users SET email=?, password=?, role=?, name=? WHERE id=7', {
    replacements: ['security@school.edu.ph', hash, 'security', 'School Security']
  });
  const [rows] = await s.query('SELECT id,name,email,role FROM Users WHERE id=7');
  console.log('✅ Updated:', rows[0]);
} catch(e) {
  console.error('❌', e.message);
} finally {
  process.exit();
}
