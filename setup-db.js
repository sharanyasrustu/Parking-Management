/**
 * SHARANYA PARKING - Automated Database Setup & Seeder Script
 * 
 * Usage: npm run db:setup
 * 
 * Automatically connects to MySQL, creates the database 'sharanya_parking',
 * applies table schemas, indexes, foreign keys, and seeds verified sample data.
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
    console.log('========================================================');
    console.log('  SHARANYA PARKING - AUTOMATED DATABASE INITIALIZER');
    console.log('========================================================\n');

    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'mee_mysql_password',
        multipleStatements: true
    };

    console.log(`Connecting to MySQL host: ${config.host} as user: ${config.user}...`);

    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('✓ Connected to MySQL server successfully.');

        // Read schema.sql
        const schemaPath = path.join(__dirname, 'schema.sql');
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`schema.sql not found at: ${schemaPath}`);
        }

        const sql = fs.readFileSync(schemaPath, 'utf8');
        console.log('Executing schema.sql DDL & Seed scripts...');

        await connection.query(sql);
        console.log('✓ Database "sharanya_parking" created and configured.');

        // Verify counts
        await connection.query('USE sharanya_parking;');
        const [[u]] = await connection.query('SELECT COUNT(*) AS c FROM users');
        const [[s]] = await connection.query('SELECT COUNT(*) AS c FROM parking_slots');
        const [[v]] = await connection.query('SELECT COUNT(*) AS c FROM vehicles');
        const [[r]] = await connection.query('SELECT COUNT(*) AS c FROM parking_records');

        console.log('\n---------------- Verified Data Counts ----------------');
        console.log(`  Users Registered      : ${u.c}`);
        console.log(`  Parking Slots         : ${s.c}`);
        console.log(`  Vehicles Registered   : ${v.c}`);
        console.log(`  Parking Records       : ${r.c}`);
        console.log('------------------------------------------------------');
        console.log('\n✓ Database initialization completed successfully!');
        console.log('You can now start the application with: npm start\n');
    } catch (err) {
        console.error('\n✗ Error setting up database:', err.message);
        console.error('Please verify your MySQL server is running and password in .env is correct.\n');
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

setupDatabase();
