const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://invoice_user:TbhOne0525@Admin@!@localhost:5432/invoice_db'
});

async function createUser() {
  const email = 'theblackhat17@protonmail.com'; // Change ici
  const password = '^gU#1n*PaWXeSpzaUMbhPravK791@tbSRN0UmamXeHR09yF0*Bb@&$dGxb'; // Change ici
  
  const hash = await bcrypt.hash(password, 10);
  
  try {
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hash]
    );
    
    console.log('✅ Compte créé:');
    console.log('   Email:', result.rows[0].email);
    console.log('   Mot de passe:', password);
  } catch (err) {
    if (err.code === '23505') {
      console.log('❌ Cet email existe déjà');
    } else {
      console.error('❌ Erreur:', err);
    }
  }
  
  process.exit(0);
}

createUser();
