import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  user: 'backend_user',
  host: 'localhost',
  database: 'taigsql',
  password: 'Gjkmpjdfntkm1bpNfqubycrjujGfhrf!',
  port: 6543
});

//const pool = new Pool({
 // user: process.env.DB_USER,
  //host: process.env.DB_HOST,
  //database: process.env.DB_NAME,
  //password: process.env.DB_PASSWORD.trim(),
  //port: process.env.DB_PORT,
  //ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
//});

pool.on('connect', () => console.log('New DB connection'));
pool.on('error', err => console.error('DB error:', err));
