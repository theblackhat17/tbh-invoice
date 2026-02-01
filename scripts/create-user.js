const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://invoice_user:TbhOne0525@Admin@!@localhost:5432/invoice_db'
});

async function createUser() {
  const hash = await bcrypt.hash('admin123', 10);
  
  await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
    ['admin@tbhone.com', hash]
  );
  
  console.log('User created: admin@tbhone.com / admin123');
  process.exit(0);
}

createUser();
