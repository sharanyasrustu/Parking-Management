/**
 * SHARANYA PARKING - Smart Parking Management System
 * Backend Server Application
 * 
 * Tech Stack: Node.js, Express.js, mysql2/promise, dotenv, cors
 * Architecture: REST API connected to MySQL database (sharanya_parking)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurable Hourly Rates (₹ per hour)
const HOURLY_RATES = {
    'Two-wheeler': 20.00,
    'Four-wheeler': 40.00,
    'Heavy Vehicle': 60.00
};

// Database Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'mee_mysql_password',
    database: process.env.DB_NAME || 'sharanya_parking',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Calculate parking duration and fee
function calculateParkingFee(vehicleType, entryTime, exitTime = new Date()) {
    const entryDate = new Date(entryTime);
    const exitDate = new Date(exitTime);
    // Guard against negative duration from clock differences
    const diffMs = Math.max(0, exitDate.getTime() - entryDate.getTime());

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    // Ceiling of parking duration in hours, with minimum of 1 hour
    const durationHours = diffMs / (1000 * 60 * 60);
    const billableHours = Math.max(1, Math.ceil(durationHours));
    const rate = HOURLY_RATES[vehicleType] || 40.00;
    const fee = billableHours * rate;

    return {
        totalMinutes,
        durationFormatted: `${hours}h ${minutes}m`,
        billableHours,
        hourlyRate: rate,
        parkingFee: Number(fee.toFixed(2))
    };
}

// =====================================================================
// DASHBOARD ENDPOINTS
// =====================================================================

// GET /api/dashboard/stats - Overview statistics
app.get('/api/dashboard/stats', async (req, res, next) => {
    try {
        const [[slotsTotal]] = await pool.query('SELECT COUNT(*) AS count FROM parking_slots');
        const [[slotsAvail]] = await pool.query("SELECT COUNT(*) AS count FROM parking_slots WHERE status = 'Available'");
        const [[slotsOccupied]] = await pool.query("SELECT COUNT(*) AS count FROM parking_slots WHERE status = 'Occupied'");
        const [[slotsMaint]] = await pool.query("SELECT COUNT(*) AS count FROM parking_slots WHERE status = 'Maintenance'");
        const [[vehiclesTotal]] = await pool.query('SELECT COUNT(*) AS count FROM vehicles');
        const [[usersTotal]] = await pool.query('SELECT COUNT(*) AS count FROM users');
        const [[activeRecords]] = await pool.query("SELECT COUNT(*) AS count FROM parking_records WHERE status = 'Active'");
        const [[totalRevenue]] = await pool.query("SELECT COALESCE(SUM(parking_fee), 0) AS total FROM parking_records WHERE status = 'Completed'");
        const [[todayRevenue]] = await pool.query("SELECT COALESCE(SUM(parking_fee), 0) AS total FROM parking_records WHERE status = 'Completed' AND DATE(exit_time) = CURDATE()");

        res.json({
            success: true,
            data: {
                totalSlots: slotsTotal.count,
                availableSlots: slotsAvail.count,
                occupiedSlots: slotsOccupied.count,
                maintenanceSlots: slotsMaint.count,
                registeredVehicles: vehiclesTotal.count,
                registeredUsers: usersTotal.count,
                activeRecords: activeRecords.count,
                totalRevenue: parseFloat(totalRevenue.total),
                todayRevenue: parseFloat(todayRevenue.total),
                occupancyRate: slotsTotal.count > 0 ? Math.round((slotsOccupied.count / slotsTotal.count) * 100) : 0
            }
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/dashboard/recent-activity - Recent 10 parking transactions
app.get('/api/dashboard/recent-activity', async (req, res, next) => {
    try {
        const query = `
            SELECT 
                pr.record_id,
                pr.entry_time,
                pr.exit_time,
                pr.parking_fee,
                pr.status,
                v.vehicle_number,
                v.vehicle_type,
                v.vehicle_model,
                u.name AS owner_name,
                ps.slot_number,
                ps.location
            FROM parking_records pr
            JOIN vehicles v ON pr.vehicle_id = v.vehicle_id
            JOIN users u ON v.user_id = u.user_id
            JOIN parking_slots ps ON pr.slot_id = ps.slot_id
            ORDER BY pr.entry_time DESC
            LIMIT 10
        `;
        const [rows] = await pool.query(query);
        res.json({ success: true, data: rows });
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// USER MANAGEMENT ENDPOINTS
// =====================================================================

// GET /api/users - List users with optional search
app.get('/api/users', async (req, res, next) => {
    try {
        const search = req.query.search ? `%${req.query.search.trim()}%` : null;
        let query = `
            SELECT 
                u.user_id,
                u.name,
                u.phone,
                u.email,
                u.role,
                COUNT(v.vehicle_id) AS vehicle_count
            FROM users u
            LEFT JOIN vehicles v ON u.user_id = v.user_id
        `;
        const params = [];

        if (search) {
            query += ` WHERE u.name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?`;
            params.push(search, search, search);
        }

        query += ` GROUP BY u.user_id ORDER BY u.user_id DESC`;

        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows, count: rows.length });
    } catch (err) {
        next(err);
    }
});

// GET /api/users/:id - Single user details
app.get('/api/users/:id', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [userId]);

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const [vehicles] = await pool.query('SELECT * FROM vehicles WHERE user_id = ?', [userId]);

        res.json({
            success: true,
            data: {
                ...users[0],
                vehicles
            }
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/users - Create new user
app.post('/api/users', async (req, res, next) => {
    try {
        const { name, phone, email, role } = req.body;

        if (!name || !phone || !email) {
            return res.status(400).json({ success: false, message: 'Name, phone, and email are required fields.' });
        }

        // Basic validations
        const phoneClean = phone.trim();
        const emailClean = email.trim().toLowerCase();

        // Check unique phone / email
        const [existing] = await pool.query(
            'SELECT user_id, phone, email FROM users WHERE phone = ? OR email = ?',
            [phoneClean, emailClean]
        );

        if (existing.length > 0) {
            if (existing[0].phone === phoneClean) {
                return res.status(409).json({ success: false, message: 'Phone number already registered to another user.' });
            }
            return res.status(409).json({ success: false, message: 'Email address already registered to another user.' });
        }

        const userRole = role && ['admin', 'user', 'staff', 'vip'].includes(role.toLowerCase()) ? role.toLowerCase() : 'user';

        const [result] = await pool.query(
            'INSERT INTO users (name, phone, email, role) VALUES (?, ?, ?, ?)',
            [name.trim(), phoneClean, emailClean, userRole]
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user_id: result.insertId,
                name: name.trim(),
                phone: phoneClean,
                email: emailClean,
                role: userRole
            }
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/users/:id - Update user
app.put('/api/users/:id', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const { name, phone, email, role } = req.body;

        if (!name || !phone || !email) {
            return res.status(400).json({ success: false, message: 'Name, phone, and email are required fields.' });
        }

        const phoneClean = phone.trim();
        const emailClean = email.trim().toLowerCase();

        // Check if user exists
        const [existingUser] = await pool.query('SELECT user_id FROM users WHERE user_id = ?', [userId]);
        if (existingUser.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check uniqueness excluding current user
        const [conflicts] = await pool.query(
            'SELECT user_id, phone, email FROM users WHERE (phone = ? OR email = ?) AND user_id != ?',
            [phoneClean, emailClean, userId]
        );

        if (conflicts.length > 0) {
            if (conflicts[0].phone === phoneClean) {
                return res.status(409).json({ success: false, message: 'Phone number is already in use by another user.' });
            }
            return res.status(409).json({ success: false, message: 'Email address is already in use by another user.' });
        }

        const userRole = role ? role.toLowerCase() : 'user';

        await pool.query(
            'UPDATE users SET name = ?, phone = ?, email = ?, role = ? WHERE user_id = ?',
            [name.trim(), phoneClean, emailClean, userRole, userId]
        );

        res.json({
            success: true,
            message: 'User updated successfully',
            data: { user_id: userId, name: name.trim(), phone: phoneClean, email: emailClean, role: userRole }
        });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/users/:id - Delete user (only if no dependent records)
app.delete('/api/users/:id', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id, 10);

        // Check dependent vehicles
        const [[{ vehicleCount }]] = await pool.query(
            'SELECT COUNT(*) AS vehicleCount FROM vehicles WHERE user_id = ?',
            [userId]
        );

        if (vehicleCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete user: ${vehicleCount} vehicle(s) are registered to this user. Delete or reassign their vehicles first.`
            });
        }

        const [result] = await pool.query('DELETE FROM users WHERE user_id = ?', [userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// VEHICLE MANAGEMENT ENDPOINTS
// =====================================================================

// GET /api/vehicles - List all vehicles
app.get('/api/vehicles', async (req, res, next) => {
    try {
        const search = req.query.search ? `%${req.query.search.trim()}%` : null;
        const type = req.query.type ? req.query.type.trim() : null;

        let query = `
            SELECT 
                v.vehicle_id,
                v.user_id,
                v.vehicle_number,
                v.vehicle_type,
                v.vehicle_model,
                u.name AS owner_name,
                u.phone AS owner_phone,
                u.email AS owner_email,
                (SELECT pr.record_id FROM parking_records pr WHERE pr.vehicle_id = v.vehicle_id AND pr.status = 'Active' LIMIT 1) AS active_record_id,
                (SELECT ps.slot_number FROM parking_records pr JOIN parking_slots ps ON pr.slot_id = ps.slot_id WHERE pr.vehicle_id = v.vehicle_id AND pr.status = 'Active' LIMIT 1) AS active_slot_number
            FROM vehicles v
            JOIN users u ON v.user_id = u.user_id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (v.vehicle_number LIKE ? OR v.vehicle_model LIKE ? OR u.name LIKE ? OR u.phone LIKE ?)`;
            params.push(search, search, search, search);
        }

        if (type && type !== 'All') {
            query += ` AND v.vehicle_type = ?`;
            params.push(type);
        }

        query += ` ORDER BY v.vehicle_id DESC`;

        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows, count: rows.length });
    } catch (err) {
        next(err);
    }
});

// GET /api/vehicles/:id - Vehicle details
app.get('/api/vehicles/:id', async (req, res, next) => {
    try {
        const vehicleId = parseInt(req.params.id, 10);
        const query = `
            SELECT 
                v.*,
                u.name AS owner_name,
                u.phone AS owner_phone,
                u.email AS owner_email
            FROM vehicles v
            JOIN users u ON v.user_id = u.user_id
            WHERE v.vehicle_id = ?
        `;
        const [vehicles] = await pool.query(query, [vehicleId]);

        if (vehicles.length === 0) {
            return res.status(404).json({ success: false, message: 'Vehicle not found' });
        }

        // Fetch parking history for vehicle
        const [history] = await pool.query(`
            SELECT pr.*, ps.slot_number, ps.location 
            FROM parking_records pr 
            JOIN parking_slots ps ON pr.slot_id = ps.slot_id 
            WHERE pr.vehicle_id = ? 
            ORDER BY pr.entry_time DESC 
            LIMIT 10
        `, [vehicleId]);

        res.json({
            success: true,
            data: {
                ...vehicles[0],
                history
            }
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/vehicles - Register new vehicle
app.post('/api/vehicles', async (req, res, next) => {
    try {
        const { user_id, vehicle_number, vehicle_type, vehicle_model } = req.body;

        if (!user_id || !vehicle_number || !vehicle_type || !vehicle_model) {
            return res.status(400).json({ success: false, message: 'All vehicle fields are required.' });
        }

        const validTypes = ['Two-wheeler', 'Four-wheeler', 'Heavy Vehicle'];
        if (!validTypes.includes(vehicle_type)) {
            return res.status(400).json({
                success: false,
                message: `Invalid vehicle type. Allowed types: ${validTypes.join(', ')}`
            });
        }

        const vNumClean = vehicle_number.trim().toUpperCase();

        // Check if owner exists
        const [userCheck] = await pool.query('SELECT user_id, name FROM users WHERE user_id = ?', [user_id]);
        if (userCheck.length === 0) {
            return res.status(404).json({ success: false, message: 'Specified owner (user) not found.' });
        }

        // Prevent duplicate vehicle registration
        const [existing] = await pool.query('SELECT vehicle_id FROM vehicles WHERE vehicle_number = ?', [vNumClean]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: `Vehicle number ${vNumClean} is already registered in the system.` });
        }

        const [result] = await pool.query(
            'INSERT INTO vehicles (user_id, vehicle_number, vehicle_type, vehicle_model) VALUES (?, ?, ?, ?)',
            [user_id, vNumClean, vehicle_type, vehicle_model.trim()]
        );

        res.status(201).json({
            success: true,
            message: 'Vehicle registered successfully',
            data: {
                vehicle_id: result.insertId,
                user_id,
                vehicle_number: vNumClean,
                vehicle_type,
                vehicle_model: vehicle_model.trim(),
                owner_name: userCheck[0].name
            }
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/vehicles/:id - Update vehicle
app.put('/api/vehicles/:id', async (req, res, next) => {
    try {
        const vehicleId = parseInt(req.params.id, 10);
        const { user_id, vehicle_number, vehicle_type, vehicle_model } = req.body;

        if (!user_id || !vehicle_number || !vehicle_type || !vehicle_model) {
            return res.status(400).json({ success: false, message: 'All vehicle fields are required.' });
        }

        const validTypes = ['Two-wheeler', 'Four-wheeler', 'Heavy Vehicle'];
        if (!validTypes.includes(vehicle_type)) {
            return res.status(400).json({
                success: false,
                message: `Invalid vehicle type. Allowed types: ${validTypes.join(', ')}`
            });
        }

        const vNumClean = vehicle_number.trim().toUpperCase();

        // Check conflict with other vehicle numbers
        const [conflicts] = await pool.query(
            'SELECT vehicle_id FROM vehicles WHERE vehicle_number = ? AND vehicle_id != ?',
            [vNumClean, vehicleId]
        );
        if (conflicts.length > 0) {
            return res.status(409).json({ success: false, message: `Vehicle number ${vNumClean} is already taken by another vehicle.` });
        }

        // Ensure user exists
        const [userCheck] = await pool.query('SELECT user_id FROM users WHERE user_id = ?', [user_id]);
        if (userCheck.length === 0) {
            return res.status(404).json({ success: false, message: 'Specified owner not found.' });
        }

        const [result] = await pool.query(
            'UPDATE vehicles SET user_id = ?, vehicle_number = ?, vehicle_type = ?, vehicle_model = ? WHERE vehicle_id = ?',
            [user_id, vNumClean, vehicle_type, vehicle_model.trim(), vehicleId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Vehicle not found' });
        }

        res.json({
            success: true,
            message: 'Vehicle updated successfully',
            data: { vehicle_id: vehicleId, user_id, vehicle_number: vNumClean, vehicle_type, vehicle_model: vehicle_model.trim() }
        });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/vehicles/:id - Delete vehicle (only if no parking history)
app.delete('/api/vehicles/:id', async (req, res, next) => {
    try {
        const vehicleId = parseInt(req.params.id, 10);

        // Check parking records
        const [[{ recordCount }]] = await pool.query(
            'SELECT COUNT(*) AS recordCount FROM parking_records WHERE vehicle_id = ?',
            [vehicleId]
        );

        if (recordCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete vehicle: It has ${recordCount} associated parking record(s). Deletion restricted to preserve audit integrity.`
            });
        }

        const [result] = await pool.query('DELETE FROM vehicles WHERE vehicle_id = ?', [vehicleId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Vehicle not found' });
        }

        res.json({ success: true, message: 'Vehicle deleted successfully' });
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// PARKING SLOTS ENDPOINTS
// =====================================================================

// GET /api/slots - List all parking slots with filters
app.get('/api/slots', async (req, res, next) => {
    try {
        const { status, type, location } = req.query;
        let query = `
            SELECT 
                ps.slot_id,
                ps.slot_number,
                ps.vehicle_type,
                ps.location,
                ps.status,
                pr.record_id AS current_record_id,
                pr.entry_time AS current_entry_time,
                v.vehicle_number AS current_vehicle_number,
                v.vehicle_model AS current_vehicle_model,
                u.name AS current_driver_name
            FROM parking_slots ps
            LEFT JOIN parking_records pr ON ps.slot_id = pr.slot_id AND pr.status = 'Active'
            LEFT JOIN vehicles v ON pr.vehicle_id = v.vehicle_id
            LEFT JOIN users u ON v.user_id = u.user_id
            WHERE 1=1
        `;
        const params = [];

        if (status && status !== 'All') {
            query += ` AND ps.status = ?`;
            params.push(status);
        }

        if (type && type !== 'All') {
            query += ` AND ps.vehicle_type = ?`;
            params.push(type);
        }

        if (location) {
            query += ` AND ps.location LIKE ?`;
            params.push(`%${location.trim()}%`);
        }

        query += ` ORDER BY ps.slot_number ASC`;

        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows, count: rows.length });
    } catch (err) {
        next(err);
    }
});

// GET /api/slots/:id - Single slot details
app.get('/api/slots/:id', async (req, res, next) => {
    try {
        const slotId = parseInt(req.params.id, 10);
        const [rows] = await pool.query('SELECT * FROM parking_slots WHERE slot_id = ?', [slotId]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Slot not found' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        next(err);
    }
});

// POST /api/slots - Create new parking slot
app.post('/api/slots', async (req, res, next) => {
    try {
        const { slot_number, vehicle_type, location, status } = req.body;

        if (!slot_number || !vehicle_type || !location) {
            return res.status(400).json({ success: false, message: 'Slot number, vehicle type, and location are required.' });
        }

        const validTypes = ['Two-wheeler', 'Four-wheeler', 'Heavy Vehicle'];
        if (!validTypes.includes(vehicle_type)) {
            return res.status(400).json({ success: false, message: `Invalid vehicle type. Allowed: ${validTypes.join(', ')}` });
        }

        const validStatuses = ['Available', 'Occupied', 'Maintenance'];
        const slotStatus = status && validStatuses.includes(status) ? status : 'Available';
        const slotNumClean = slot_number.trim().toUpperCase();

        // Check unique slot number
        const [existing] = await pool.query('SELECT slot_id FROM parking_slots WHERE slot_number = ?', [slotNumClean]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: `Slot ${slotNumClean} already exists.` });
        }

        const [result] = await pool.query(
            'INSERT INTO parking_slots (slot_number, vehicle_type, location, status) VALUES (?, ?, ?, ?)',
            [slotNumClean, vehicle_type, location.trim(), slotStatus]
        );

        res.status(201).json({
            success: true,
            message: 'Parking slot added successfully',
            data: {
                slot_id: result.insertId,
                slot_number: slotNumClean,
                vehicle_type,
                location: location.trim(),
                status: slotStatus
            }
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/slots/:id - Update parking slot
app.put('/api/slots/:id', async (req, res, next) => {
    try {
        const slotId = parseInt(req.params.id, 10);
        const { slot_number, vehicle_type, location, status } = req.body;

        if (!slot_number || !vehicle_type || !location) {
            return res.status(400).json({ success: false, message: 'All slot fields are required.' });
        }

        const validStatuses = ['Available', 'Occupied', 'Maintenance'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid slot status' });
        }

        const slotNumClean = slot_number.trim().toUpperCase();

        // Check if slot exists
        const [currentSlot] = await pool.query('SELECT * FROM parking_slots WHERE slot_id = ?', [slotId]);
        if (currentSlot.length === 0) {
            return res.status(404).json({ success: false, message: 'Parking slot not found' });
        }

        // If slot currently has an active parking record, prevent manual change to Available or Maintenance
        const [[activeRecord]] = await pool.query(
            "SELECT record_id FROM parking_records WHERE slot_id = ? AND status = 'Active' LIMIT 1",
            [slotId]
        );

        if (activeRecord && status && status !== 'Occupied') {
            return res.status(400).json({
                success: false,
                message: `Cannot change status to '${status}': Slot is currently occupied by an active vehicle (Record #${activeRecord.record_id}). Process vehicle exit first.`
            });
        }

        // Check uniqueness of slot number
        const [conflict] = await pool.query(
            'SELECT slot_id FROM parking_slots WHERE slot_number = ? AND slot_id != ?',
            [slotNumClean, slotId]
        );
        if (conflict.length > 0) {
            return res.status(409).json({ success: false, message: `Slot number ${slotNumClean} is already assigned to another slot.` });
        }

        await pool.query(
            'UPDATE parking_slots SET slot_number = ?, vehicle_type = ?, location = ?, status = ? WHERE slot_id = ?',
            [slotNumClean, vehicle_type, location.trim(), status || currentSlot[0].status, slotId]
        );

        res.json({
            success: true,
            message: 'Parking slot updated successfully',
            data: { slot_id: slotId, slot_number: slotNumClean, vehicle_type, location: location.trim(), status: status || currentSlot[0].status }
        });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/slots/:id - Delete unused slot
app.delete('/api/slots/:id', async (req, res, next) => {
    try {
        const slotId = parseInt(req.params.id, 10);

        // Check if slot is occupied or has records
        const [[activeRecord]] = await pool.query(
            "SELECT record_id FROM parking_records WHERE slot_id = ? AND status = 'Active'",
            [slotId]
        );
        if (activeRecord) {
            return res.status(400).json({ success: false, message: 'Cannot delete an occupied slot. Process vehicle exit first.' });
        }

        const [[{ recordCount }]] = await pool.query(
            'SELECT COUNT(*) AS recordCount FROM parking_records WHERE slot_id = ?',
            [slotId]
        );
        if (recordCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete slot: It has ${recordCount} associated historical parking record(s).`
            });
        }

        const [result] = await pool.query('DELETE FROM parking_slots WHERE slot_id = ?', [slotId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Slot not found' });
        }

        res.json({ success: true, message: 'Parking slot deleted successfully' });
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// PARKING OPERATIONS (ENTRY, EXIT, ACTIVE, HISTORY) - WITH TRANSACTIONS
// =====================================================================

// GET /api/parking/rates - Configured hourly tariffs
app.get('/api/parking/rates', (req, res) => {
    res.json({
        success: true,
        data: HOURLY_RATES
    });
});

// POST /api/parking/entry - Park a vehicle (Transaction-based)
app.post('/api/parking/entry', async (req, res, next) => {
    let conn;
    try {
        const { vehicle_id, slot_id } = req.body;

        if (!vehicle_id || !slot_id) {
            return res.status(400).json({ success: false, message: 'Both vehicle_id and slot_id are required.' });
        }

        conn = await pool.getConnection();
        await conn.beginTransaction();

        // 1. Fetch and lock vehicle info
        const [vehicles] = await conn.query(
            'SELECT v.*, u.name AS owner_name FROM vehicles v JOIN users u ON v.user_id = u.user_id WHERE v.vehicle_id = ? FOR UPDATE',
            [vehicle_id]
        );

        if (vehicles.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Vehicle not found.' });
        }
        const vehicle = vehicles[0];

        // 2. Prevent duplicate active parking for this vehicle
        const [activeVehicleRecords] = await conn.query(
            "SELECT record_id, slot_id FROM parking_records WHERE vehicle_id = ? AND status = 'Active' FOR UPDATE",
            [vehicle_id]
        );

        if (activeVehicleRecords.length > 0) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: `Vehicle ${vehicle.vehicle_number} is already parked in slot ID ${activeVehicleRecords[0].slot_id}. Duplicate active entries are not allowed.`
            });
        }

        // 3. Fetch and lock slot info
        const [slots] = await conn.query(
            'SELECT * FROM parking_slots WHERE slot_id = ? FOR UPDATE',
            [slot_id]
        );

        if (slots.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Parking slot not found.' });
        }
        const slot = slots[0];

        // 4. Validate slot availability
        if (slot.status !== 'Available') {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: `Slot ${slot.slot_number} cannot be assigned: Current status is '${slot.status}'. Only 'Available' slots may be assigned.`
            });
        }

        // 5. Validate vehicle type compatibility
        if (slot.vehicle_type !== vehicle.vehicle_type) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: `Vehicle type mismatch: Slot ${slot.slot_number} is reserved for '${slot.vehicle_type}', but vehicle is '${vehicle.vehicle_type}'.`
            });
        }

        // 6. Insert new parking record with NOW()
        const [insertRecord] = await conn.query(
            "INSERT INTO parking_records (vehicle_id, slot_id, entry_time, exit_time, parking_fee, status) VALUES (?, ?, NOW(), NULL, 0.00, 'Active')",
            [vehicle_id, slot_id]
        );

        // 7. Update parking slot status to 'Occupied'
        await conn.query(
            "UPDATE parking_slots SET status = 'Occupied' WHERE slot_id = ?",
            [slot_id]
        );

        // Commit transaction
        await conn.commit();

        // Fetch the freshly created record details
        const [[createdRecord]] = await pool.query(`
            SELECT 
                pr.record_id,
                pr.entry_time,
                pr.status,
                v.vehicle_number,
                v.vehicle_type,
                v.vehicle_model,
                u.name AS owner_name,
                ps.slot_number,
                ps.location
            FROM parking_records pr
            JOIN vehicles v ON pr.vehicle_id = v.vehicle_id
            JOIN users u ON v.user_id = u.user_id
            JOIN parking_slots ps ON pr.slot_id = ps.slot_id
            WHERE pr.record_id = ?
        `, [insertRecord.insertId]);

        res.status(201).json({
            success: true,
            message: `Vehicle ${vehicle.vehicle_number} successfully parked in slot ${slot.slot_number}.`,
            data: createdRecord
        });
    } catch (err) {
        if (conn) await conn.rollback();
        next(err);
    } finally {
        if (conn) conn.release();
    }
});

// GET /api/parking/active - Retrieve all active parking sessions
app.get('/api/parking/active', async (req, res, next) => {
    try {
        const query = `
            SELECT 
                pr.record_id,
                pr.vehicle_id,
                pr.slot_id,
                pr.entry_time,
                pr.status,
                v.vehicle_number,
                v.vehicle_type,
                v.vehicle_model,
                u.name AS owner_name,
                u.phone AS owner_phone,
                ps.slot_number,
                ps.location
            FROM parking_records pr
            JOIN vehicles v ON pr.vehicle_id = v.vehicle_id
            JOIN users u ON v.user_id = u.user_id
            JOIN parking_slots ps ON pr.slot_id = ps.slot_id
            WHERE pr.status = 'Active'
            ORDER BY pr.entry_time ASC
        `;
        const [rows] = await pool.query(query);

        // Calculate live duration and current estimated fee for each active vehicle
        const enriched = rows.map(r => {
            const feeCalc = calculateParkingFee(r.vehicle_type, r.entry_time);
            return {
                ...r,
                currentDuration: feeCalc.durationFormatted,
                billableHours: feeCalc.billableHours,
                hourlyRate: feeCalc.hourlyRate,
                estimatedFee: feeCalc.parkingFee
            };
        });

        res.json({ success: true, data: enriched, count: enriched.length });
    } catch (err) {
        next(err);
    }
});

// POST /api/parking/exit/:recordId - Process vehicle exit and generate receipt (Transaction-based)
app.post('/api/parking/exit/:recordId', async (req, res, next) => {
    let conn;
    try {
        const recordId = parseInt(req.params.recordId, 10);

        conn = await pool.getConnection();
        await conn.beginTransaction();

        // 1. Fetch and lock record
        const [records] = await conn.query(`
            SELECT 
                pr.record_id,
                pr.vehicle_id,
                pr.slot_id,
                pr.entry_time,
                pr.exit_time,
                pr.status,
                v.vehicle_number,
                v.vehicle_type,
                v.vehicle_model,
                u.name AS owner_name,
                u.phone AS owner_phone,
                u.email AS owner_email,
                ps.slot_number,
                ps.location
            FROM parking_records pr
            JOIN vehicles v ON pr.vehicle_id = v.vehicle_id
            JOIN users u ON v.user_id = u.user_id
            JOIN parking_slots ps ON pr.slot_id = ps.slot_id
            WHERE pr.record_id = ?
            FOR UPDATE
        `, [recordId]);

        if (records.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Parking record not found.' });
        }

        const record = records[0];

        // 2. Prevent duplicate exit
        if (record.status === 'Completed') {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: `Parking record #${recordId} is already completed. Exit was previously processed at ${record.exit_time}.`
            });
        }

        // 3. Calculate duration and fee
        const exitDate = new Date();
        const feeCalc = calculateParkingFee(record.vehicle_type, record.entry_time, exitDate);

        // 4. Update parking_record: exit_time, parking_fee, status = 'Completed'
        await conn.query(
            "UPDATE parking_records SET exit_time = NOW(), parking_fee = ?, status = 'Completed' WHERE record_id = ?",
            [feeCalc.parkingFee, recordId]
        );

        // 5. Update parking_slots: set status to 'Available'
        await conn.query(
            "UPDATE parking_slots SET status = 'Available' WHERE slot_id = ?",
            [record.slot_id]
        );

        // Commit transaction
        await conn.commit();

        // 6. Return comprehensive receipt data
        const receipt = {
            receiptNumber: `SP-REC-${String(recordId).padStart(6, '0')}`,
            recordId: record.record_id,
            vehicleNumber: record.vehicle_number,
            vehicleType: record.vehicle_type,
            vehicleModel: record.vehicle_model,
            ownerName: record.owner_name,
            ownerPhone: record.owner_phone,
            slotNumber: record.slot_number,
            slotLocation: record.location,
            entryTime: record.entry_time,
            exitTime: exitDate.toISOString(),
            durationFormatted: feeCalc.durationFormatted,
            totalMinutes: feeCalc.totalMinutes,
            billableHours: feeCalc.billableHours,
            hourlyRate: feeCalc.hourlyRate,
            parkingFee: feeCalc.parkingFee,
            paymentStatus: 'Paid',
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            message: `Exit processed for ${record.vehicle_number}. Fee: ₹${feeCalc.parkingFee.toFixed(2)}`,
            receipt
        });
    } catch (err) {
        if (conn) await conn.rollback();
        next(err);
    } finally {
        if (conn) conn.release();
    }
});

// GET /api/parking/history - Complete history with filters
app.get('/api/parking/history', async (req, res, next) => {
    try {
        const { status, date, search, vehicle_type } = req.query;

        let query = `
            SELECT 
                pr.record_id,
                pr.vehicle_id,
                pr.slot_id,
                pr.entry_time,
                pr.exit_time,
                pr.parking_fee,
                pr.status,
                v.vehicle_number,
                v.vehicle_type,
                v.vehicle_model,
                u.name AS owner_name,
                u.phone AS owner_phone,
                ps.slot_number,
                ps.location
            FROM parking_records pr
            JOIN vehicles v ON pr.vehicle_id = v.vehicle_id
            JOIN users u ON v.user_id = u.user_id
            JOIN parking_slots ps ON pr.slot_id = ps.slot_id
            WHERE 1=1
        `;
        const params = [];

        if (status && status !== 'All') {
            query += ` AND pr.status = ?`;
            params.push(status);
        }

        if (vehicle_type && vehicle_type !== 'All') {
            query += ` AND v.vehicle_type = ?`;
            params.push(vehicle_type);
        }

        if (date) {
            query += ` AND (DATE(pr.entry_time) = ? OR DATE(pr.exit_time) = ?)`;
            params.push(date, date);
        }

        if (search) {
            query += ` AND (v.vehicle_number LIKE ? OR u.name LIKE ? OR ps.slot_number LIKE ?)`;
            params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
        }

        query += ` ORDER BY pr.entry_time DESC`;

        const [rows] = await pool.query(query, params);

        // Calculate summary
        const totalFees = rows
            .filter(r => r.status === 'Completed')
            .reduce((sum, r) => sum + parseFloat(r.parking_fee || 0), 0);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            totalCollectedFee: Number(totalFees.toFixed(2))
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/parking/:recordId - Single record details
app.get('/api/parking/:recordId', async (req, res, next) => {
    try {
        const recordId = parseInt(req.params.recordId, 10);
        const query = `
            SELECT 
                pr.*,
                v.vehicle_number,
                v.vehicle_type,
                v.vehicle_model,
                u.name AS owner_name,
                u.phone AS owner_phone,
                u.email AS owner_email,
                ps.slot_number,
                ps.location
            FROM parking_records pr
            JOIN vehicles v ON pr.vehicle_id = v.vehicle_id
            JOIN users u ON v.user_id = u.user_id
            JOIN parking_slots ps ON pr.slot_id = ps.slot_id
            WHERE pr.record_id = ?
        `;
        const [rows] = await pool.query(query, [recordId]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Parking record not found' });
        }

        const record = rows[0];
        let durationInfo = null;
        if (record.status === 'Completed' && record.exit_time) {
            durationInfo = calculateParkingFee(record.vehicle_type, record.entry_time, record.exit_time);
        } else if (record.status === 'Active') {
            durationInfo = calculateParkingFee(record.vehicle_type, record.entry_time, new Date());
        }

        res.json({
            success: true,
            data: {
                ...record,
                durationInfo
            }
        });
    } catch (err) {
        next(err);
    }
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

// Route aliases for multi-page navigation
app.get(['/', '/dashboard'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/entry', (req, res) => res.sendFile(path.join(__dirname, 'public', 'entry.html')));
app.get('/exit', (req, res) => res.sendFile(path.join(__dirname, 'public', 'exit.html')));
app.get('/slots-view', (req, res) => res.sendFile(path.join(__dirname, 'public', 'slots.html')));
app.get('/vehicles-view', (req, res) => res.sendFile(path.join(__dirname, 'public', 'vehicles.html')));
app.get('/users-view', (req, res) => res.sendFile(path.join(__dirname, 'public', 'users.html')));
app.get('/history-view', (req, res) => res.sendFile(path.join(__dirname, 'public', 'history.html')));

// Fallback routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Verify MySQL connection and start server
async function startServer() {
    try {
        const connection = await pool.getConnection();
        console.log('✓ Successfully connected to MySQL database: sharanya_parking');
        connection.release();

        app.listen(PORT, () => {
            console.log(`=======================================================`);
            console.log(`  SHARANYA PARKING - Smart Parking Management System`);
            console.log(`  Server running at: http://localhost:${PORT}`);
            console.log(`  Ready for B.Tech CSE Mini-Project Demonstration`);
            console.log(`=======================================================`);
        });
    } catch (err) {
        console.error('✗ Failed to connect to MySQL database:', err.message);
        console.error('Please verify MySQL service is running and credentials in .env are correct.');
        process.exit(1);
    }
}

startServer();

