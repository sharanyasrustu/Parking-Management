# SHARANYA PARKING - Smart Parking Management System
## Academic Project Report & Comprehensive Viva-Voce Guide
**Department of Computer Science and Engineering | B.Tech Capstone Mini-Project**

---

## 1. Project Abstract & Problem Statement

Urban congestion and inefficient parking management cause unnecessary fuel consumption, delays, traffic bottlenecks, and financial discrepancies. Conventional manual parking management relies on paper slips, error-prone manual calculations, and lacks real-time slot visibility.

**SHARANYA PARKING** is an automated, full-stack Smart Parking Management System engineered to provide:
1. **Real-time Bay Visibility**: Instant status of available, occupied, and maintenance slots.
2. **Automated Tariff Computation**: Tiered hourly billing using a ceiling function (`Math.ceil`) with a minimum 1-hour charge.
3. **Transaction Integrity (ACID)**: Atomicity and row-level locking (`SELECT ... FOR UPDATE`) in MySQL preventing race conditions and overbooking.
4. **Auditability**: Complete digital trail of entries, exits, durations, fees, and computer-generated printable tax receipts.

---

## 2. Technology Stack Justification

| Layer | Technology | Engineering Rationale |
|---|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JS (ES6+) | Eliminates heavy framework dependencies (Virtual DOM overhead). Provides instant page loads, native DOM manipulation, and responsive glassmorphic styling using pure CSS variables and flexbox/grid. |
| **Backend** | Node.js & Express.js | Asynchronous, event-driven, non-blocking I/O ideal for concurrent check-in/checkout requests and fast REST API throughput. |
| **Database** | MySQL (InnoDB Engine) | Industry-standard relational DBMS providing ACID guarantees, foreign key cascade constraints, row-level locking, and transactional rollbacks. |
| **Driver** | `mysql2/promise` | Native connection pooling with async/await support, prepared statements for SQL injection prevention, and manual transaction control. |

---

## 3. Database Architecture & ER Modeling

Database Name: `sharanya_parking`  
Storage Engine: **InnoDB**  
Character Set: `utf8mb4` (Unicode Support)

### Exactly Four Relational Tables

```
+--------------------------------------------------------------------------------------------------+
|                                    ENTITY RELATIONSHIP DIAGRAM                                   |
+--------------------------------------------------------------------------------------------------+

       ┌────────────────────────┐                   ┌────────────────────────┐
       │         users          │                   │     parking_slots      │
       ├────────────────────────┤                   ├────────────────────────┤
       │ PK  user_id (INT)      │                   │ PK  slot_id (INT)      │
       │     name (VARCHAR 100) │                   │     slot_number (UNQ)  │
       │ UNQ phone (VARCHAR 15) │                   │     vehicle_type       │
       │ UNQ email (VARCHAR 100)│                   │     location           │
       │     role (VARCHAR 20)  │                   │     status             │
       └───────────┬────────────┘                   └───────────┬────────────┘
                   │ 1                                          │ 1
                   │                                            │
                   │ owns (1:N)                                 │ hosts (1:N)
                   │                                            │
                   ▼ N                                          │
       ┌────────────────────────┐                               │
       │        vehicles        │                               │
       ├────────────────────────┤                               │
       │ PK  vehicle_id (INT)   │                               │
       │ FK  user_id (INT)      │                               │
       │ UNQ vehicle_number     │                               │
       │     vehicle_type       │                               │
       │     vehicle_model      │                               │
       └───────────┬────────────┘                               │
                   │ 1                                          │
                   │                                            │
                   │ enters (1:N)                               │
                   │                                            │
                   ▼ N                                          ▼ N
       ┌─────────────────────────────────────────────────────────────┐
       │                       parking_records                       │
       ├─────────────────────────────────────────────────────────────┤
       │ PK  record_id (INT AUTO_INCREMENT)                          │
       │ FK  vehicle_id (INT -> vehicles.vehicle_id)                 │
       │ FK  slot_id (INT -> parking_slots.slot_id)                  │
       │     entry_time (DATETIME NOT NULL)                          │
       │     exit_time (DATETIME NULL)                               │
       │     parking_fee (DECIMAL 10,2 DEFAULT 0.00)                 │
       │     status (VARCHAR 20 DEFAULT 'Active')                    │
       └─────────────────────────────────────────────────────────────┘
```

### Cardinality Breakdown:
- **`users` to `vehicles` (1 : N)**: One user can register multiple vehicles; each vehicle belongs to exactly one user.
- **`vehicles` to `parking_records` (1 : N)**: One vehicle can have multiple historical parking records; each record belongs to exactly one vehicle.
- **`parking_slots` to `parking_records` (1 : N)**: One parking slot can have multiple historical parking sessions; each record maps to exactly one slot.

---

## 4. Database Normalization Proof

### First Normal Form (1NF)
- All attributes contain **atomic values** (no repeating groups or comma-separated lists).
- Every table has an explicit **Primary Key** (`user_id`, `slot_id`, `vehicle_id`, `record_id`).
- All records in each table are distinct.

### Second Normal Form (2NF)
- The database is in 1NF.
- All non-key attributes are **fully functionally dependent** on the primary key. Since all tables use single-attribute surrogate keys (AUTO_INCREMENT INT), **no partial dependencies exist**.

### Third Normal Form (3NF)
- The database is in 2NF.
- **No transitive dependencies** exist ($X \to Y$ where $Y \to Z$ and $Z$ is not a candidate key).
  - In `vehicles`: Owner phone or email is not duplicated; it references `user_id`.
  - In `parking_records`: Vehicle model or owner name is not stored; it references `vehicle_id`.
  - In `parking_records`: Slot location or category is not stored; it references `slot_id`.

---

## 5. ACID Properties in Transaction Processing

### A. Parking Entry Operation (`POST /api/parking/entry`)
```sql
START TRANSACTION;

-- 1. Lock vehicle record to avoid race conditions
SELECT * FROM vehicles WHERE vehicle_id = ? FOR UPDATE;

-- 2. Verify vehicle has NO active parking session
SELECT record_id FROM parking_records WHERE vehicle_id = ? AND status = 'Active' FOR UPDATE;

-- 3. Lock slot record and verify 'Available'
SELECT * FROM parking_slots WHERE slot_id = ? FOR UPDATE;

-- 4. Insert entry record
INSERT INTO parking_records (vehicle_id, slot_id, entry_time, status) 
VALUES (?, ?, NOW(), 'Active');

-- 5. Atomically update slot to 'Occupied'
UPDATE parking_slots SET status = 'Occupied' WHERE slot_id = ?;

COMMIT;
```
**Failure Scenario**: If another operator assigns the same bay at the identical millisecond, `FOR UPDATE` serializes the transaction; the second request sees `status = 'Occupied'` and triggers an automatic `ROLLBACK`, returning HTTP 400.

### B. Parking Exit Operation (`POST /api/parking/exit/:recordId`)
```sql
START TRANSACTION;

-- 1. Fetch record and lock row
SELECT * FROM parking_records WHERE record_id = ? FOR UPDATE;

-- 2. Compute duration and billing fee
-- e.g. BillableHours = CEIL(TIMESTAMPDIFF(MINUTE, entry_time, NOW()) / 60)

-- 3. Close record
UPDATE parking_records 
SET exit_time = NOW(), parking_fee = ?, status = 'Completed' 
WHERE record_id = ?;

-- 4. Restore slot availability
UPDATE parking_slots SET status = 'Available' WHERE slot_id = ?;

COMMIT;
```

---

## 6. Tariff Calculation Formula

$$\text{Duration in Hours} = \frac{\text{Exit Time (ms)} - \text{Entry Time (ms)}}{1000 \times 60 \times 60}$$

$$\text{Billable Hours} = \max(1, \lceil \text{Duration in Hours} \rceil)$$

$$\text{Total Parking Fee} = \text{Billable Hours} \times \text{Hourly Rate}$$

| Vehicle Classification | Hourly Rate | Minimum Charge (1 Hour) |
|---|---|---|
| **Two-wheeler** | ₹20.00 / hr | ₹20.00 |
| **Four-wheeler** | ₹40.00 / hr | ₹40.00 |
| **Heavy Vehicle** | ₹60.00 / hr | ₹60.00 |

*Example*: A Four-wheeler parked for 1 hour and 12 minutes is billed for $\lceil 1.2 \rceil = 2$ billable hours $\to 2 \times ₹40 = ₹80.00$.

---

## 7. Common Viva-Voce Questions & Model Answers

### Q1: Why did you use `mysql2/promise` instead of the legacy `mysql` package?
> **Answer**: `mysql2` is written in modern JavaScript and supports native ES6 Promises (`async/await`), parameterized prepared statements, and connection pooling. It avoids callback hell, simplifies transaction rollbacks via `try...catch`, and provides higher execution speed.

### Q2: How do you prevent SQL Injection attacks in your application?
> **Answer**: We use parameterized queries with placeholder markers (`?`) across all SQL statements in `server.js`. The database driver treats incoming values strictly as literal data rather than executable SQL syntax, neutralizing injection vectors.

### Q3: What is the purpose of `FOR UPDATE` in your transaction queries?
> **Answer**: `FOR UPDATE` applies an **exclusive row-level write lock** in MySQL InnoDB. It ensures that while one request is verifying and allocating a slot or processing an exit, no concurrent request can read or modify the same row until the first transaction commits or rolls back, completely preventing double-booking race conditions.

### Q4: Why are foreign key constraints configured with `ON DELETE RESTRICT`?
> **Answer**: `ON DELETE RESTRICT` enforces strict referential integrity. If an admin tries to delete a user who has registered vehicles, or a vehicle that has historical parking records, MySQL blocks the deletion. This preserves audit history, preventing orphaned records and ensuring financial audit compliance.

### Q5: Why did you structure the frontend as separate HTML files instead of a Single Page Application (SPA)?
> **Answer**: Separate HTML files (`index.html`, `entry.html`, `exit.html`, etc.) align with traditional multi-page architecture (MPA). Each page has an independent document lifecycle, native browser bookmarking, distinct URLs, and lower memory footprint on low-powered client devices, while still sharing a unified responsive CSS design system and modular JavaScript logic.

### Q6: How does the system handle negative durations or clock desynchronization?
> **Answer**: In `calculateParkingFee()`, we check `if (diffMs < 0) throw new Error(...)`. Both entry and exit timestamps are generated server-side using MySQL's `NOW()`, eliminating reliance on untrusted client machine clocks.

---

## 8. Examiner Demonstration Script

1. **Step 1 - System Overview**: Open `http://localhost:3000/`. Show the live dashboard with animated counter rollups and the visual parking bay overview showing slot statuses (Green = Available, Red = Occupied, Amber = Maintenance).
2. **Step 2 - New Vehicle Check-in**: Click **Parking Entry** (`entry.html`). Select vehicle `KA-01-MJ-5050`. Observe how the system automatically filters and displays only compatible Four-wheeler bays. Click Bay `A-01` and submit. Show the instant redirect and observe `A-01` turned Red (Occupied).
3. **Step 3 - Integrity Check**: Attempt to park the same vehicle again. Show the error toast: *"Vehicle is already parked. Duplicate active entries are not allowed."*
4. **Step 4 - Checkout & Receipt**: Go to **Parking Exit** (`exit.html`). Click **Process Exit** on vehicle `KA-01-MJ-5050`. Review the duration and fee calculation. Click **Process Exit & Generate Receipt**. Show the printable thermal receipt with simulated barcode and verify Bay `A-01` is now restored to Green (Available).
5. **Step 5 - Audit History**: Go to **Parking History** (`history.html`). Filter by status or date, show the live calculated revenue sum, and click **Receipt** to reprint any past invoice.

