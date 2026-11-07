# SHARANYA PARKING
### Smart Parking Management System
**A B.Tech Computer Science and Engineering Capstone Mini-Project**

---

## 1. Project Overview

**SHARANYA PARKING** is a full-stack, enterprise-grade Smart Parking Management System designed to streamline parking slot allocation, vehicle tracking, automated hourly billing, and comprehensive audit history.

Built using **Node.js**, **Express.js**, **MySQL**, and **Vanilla JavaScript (HTML5/CSS3)**, the system enforces **ACID transactions** for critical operations such as vehicle check-in (parking entry) and check-out (parking exit and payment generation), preventing race conditions, overbooking, or data corruption.

---

## 2. Key Features

- **Executive Midnight Dashboard**:
  - Live animated statistics (Total Slots, Available Bays, Occupied Bays, Registered Vehicles, Registered Users, Active Sessions).
  - Visual parking slot grid with real-time status indicators (Available, Occupied, Maintenance).
  - Recent transactions table with instant exit/receipt actions.
  - Quick action launcher for high-frequency workflows.

- **Intelligent Parking Entry Flow**:
  - Automatic filtering of compatible parking bays based on vehicle classification.
  - Interactive bay visual picker.
  - Multi-check integrity: Prevents duplicate active parking for the same vehicle and disallows occupied or maintenance bays.
  - Transaction-backed commit in MySQL.

- **Automated Exit & Tariff Engine**:
  - Live elapsed duration tracking.
  - Configurable tariff tiers with automated hourly ceiling calculations:
    - **Two-wheelers**: ₹20.00 / hour
    - **Four-wheelers**: ₹40.00 / hour
    - **Heavy Vehicles**: ₹60.00 / hour
  - Minimum billing charge of 1 hour with `Math.ceil(hours)` logic.
  - Transaction-backed slot release and record closure.
  - Generates a thermal-style printable parking receipt with invoice number, duration, tax-ready summary, and barcode graphic.

- **Vehicle & User Registry**:
  - Full CRUD operations with foreign key integrity.
  - Search and filter by name, mobile number, email, or vehicle registration number.
  - Deletion safeguards preventing orphaned records or audit log destruction.

- **Historical Audit Log**:
  - Complete record of active and completed transactions.
  - Filters by session status, vehicle category, and specific date.
  - Live calculation of total filtered revenue collected.
  - Reprint receipts at any time.

---

## 3. Technology Stack

### Frontend
- **HTML5**: Semantic document structure with accessible components.
- **CSS3**: Custom design system styled in **Midnight Luxury + Electric Teal + Violet** theme (`#0B1020`, `#11182B`, `#171F35`, `#25D0C1`, `#8B7CFF`). Glassmorphic cards, responsive flex/grid layouts, CSS animations, and thermal print stylesheets (`@media print`).
- **Vanilla JavaScript (ES6+)**: SPA state management, Fetch API client, live ticker clocks, animated number rollups, and interactive modal dialogs.
- **Inline SVG Icons**: Crisp Lucide-style vector iconography.

### Backend
- **Node.js (v24+)**: Non-blocking runtime environment.
- **Express.js (v4.21+)**: High-performance REST API routing, static asset serving, and centralized error handling.
- **mysql2/promise**: Connection pooling with asynchronous SQL executions and transaction rollbacks.
- **dotenv & cors**: Environment variable encapsulation and cross-origin resource sharing.

### Database
- **MySQL (InnoDB engine)**: Exactly 4 normalized relational tables with foreign key constraints, unique indexes, and ACID transactions.

---

## 4. Database Architecture (Exactly 4 Tables)

Database Name: `sharanya_parking`

```
+-----------------------------------------------------------------------------------+
|                                 DATABASE SCHEMA                                   |
+-----------------------------------------------------------------------------------+

 [users]
   user_id (PK, AUTO_INCREMENT)
   name (VARCHAR 100)
   phone (VARCHAR 15, UNIQUE)
   email (VARCHAR 100, UNIQUE)
   role (VARCHAR 20, DEFAULT 'user')
      │
      │ 1:N
      ▼
 [vehicles]
   vehicle_id (PK, AUTO_INCREMENT)
   user_id (FK -> users.user_id, ON DELETE RESTRICT)
   vehicle_number (VARCHAR 30, UNIQUE)
   vehicle_type (VARCHAR 30)
   vehicle_model (VARCHAR 100)
      │
      │ 1:N
      ▼
 [parking_records] ◄──────── [parking_slots]
   record_id (PK, AUTO_INCREMENT)    slot_id (PK, AUTO_INCREMENT)
   vehicle_id (FK -> vehicles)       slot_number (VARCHAR 20, UNIQUE)
   slot_id (FK -> parking_slots)     vehicle_type (VARCHAR 30)
   entry_time (DATETIME)             location (VARCHAR 50)
   exit_time (DATETIME, NULL)        status (VARCHAR 20, DEFAULT 'Available')
   parking_fee (DECIMAL 10,2)
   status (VARCHAR 20, DEFAULT 'Active')
```

---

## 5. Project Directory Structure

```
sharanya-parking/
│
├── public/
│   ├── index.html        # Dashboard: KPIs, slot overview, recent activity
│   ├── entry.html        # Parking Entry: Vehicle selection, bay allocation
│   ├── exit.html         # Parking Exit: Duration tracking, billing & payment
│   ├── slots.html        # Parking Slots: Bay inventory and status management
│   ├── vehicles.html     # Vehicles: Registered vehicle list, owner mapping
│   ├── users.html        # Users: Customer & staff accounts, roles
│   ├── history.html      # History: Audit logs, filtered revenue & receipts
│   ├── style.css         # Midnight Luxury design system & print styles
│   └── app.js            # Vanilla JS state, Fetch API controllers & multi-page engine
│
├── server.js             # Express.js REST API & MySQL transactions
├── schema.sql            # DDL definitions & verified seed dataset
├── package.json          # Project metadata, dependencies, and npm scripts
├── .env                  # Active database configuration
├── .env.example          # Sample environment configuration template
├── .gitignore            # Git exclusions (node_modules, .env, logs)
└── README.md             # Project documentation and B.Tech CSE guide
```

---

## 6. Installation & Setup Instructions

### Prerequisites
1. **Node.js** (v16.0.0 or higher)
2. **MySQL Server** (v8.0 or higher) running locally on port 3306

### Step 1: Clone or Navigate to Project Directory
```bash
cd "c:\Users\srust\OneDrive\Desktop\Parking Management System"
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: MySQL Database Setup
Import the provided `schema.sql` script into your MySQL database server:

**Using MySQL CLI:**
```bash
mysql -u root -p < schema.sql
```
*(Enter your MySQL root password when prompted)*

**Or using MySQL Workbench:**
1. Open MySQL Workbench and connect to your local MySQL instance.
2. Go to **File -> Open SQL Script...** and select `schema.sql`.
3. Click the lightning bolt icon (**Execute**) to run the script.

### Step 4: Environment Configuration
Check the `.env` file in the root folder:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=mee_mysql_password
DB_NAME=sharanya_parking
```
*Modify `DB_PASSWORD` if your local MySQL root password differs.*

### Step 5: Start the Server
Run the production server:
```bash
npm start
```
Or run with auto-reload (development):
```bash
npm run dev
```

### Step 6: Access the Application
Open your web browser and navigate to:
```
http://localhost:3000
```

---

## 7. REST API Documentation

### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/stats` | Retrieves system KPIs (total/free/occupied slots, counts, revenue) |
| `GET` | `/api/dashboard/recent-activity` | Returns the 10 most recent parking transactions |

### Users
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users` | List all users (supports `?search=`) |
| `GET` | `/api/users/:id` | Get details and vehicles owned by a specific user |
| `POST` | `/api/users` | Register a new user (`name`, `phone`, `email`, `role`) |
| `PUT` | `/api/users/:id` | Update an existing user |
| `DELETE` | `/api/users/:id` | Remove a user (restricted if vehicles are attached) |

### Vehicles
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/vehicles` | List all vehicles (supports `?search=` and `?type=`) |
| `GET` | `/api/vehicles/:id` | Get details of a single vehicle with parking history |
| `POST` | `/api/vehicles` | Register a new vehicle mapped to an existing user |
| `PUT` | `/api/vehicles/:id` | Update vehicle information |
| `DELETE` | `/api/vehicles/:id` | Delete vehicle (restricted if parking history exists) |

### Parking Slots
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/slots` | List all bays with status and occupant details |
| `GET` | `/api/slots/:id` | Single slot details |
| `POST` | `/api/slots` | Create a new parking bay (`slot_number`, `vehicle_type`, `location`) |
| `PUT` | `/api/slots/:id` | Update slot details (status lock if currently occupied) |
| `DELETE` | `/api/slots/:id` | Delete an unused slot |

### Parking Operations (ACID Transactions)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/parking/rates` | Returns hourly rates for Two-wheelers, Four-wheelers, Heavy Vehicles |
| `POST` | `/api/parking/entry` | Atomic vehicle entry (`vehicle_id`, `slot_id`); marks slot `Occupied` |
| `GET` | `/api/parking/active` | List all currently active in-premises sessions with live fees |
| `POST` | `/api/parking/exit/:recordId` | Atomic vehicle exit; computes fee, releases slot, returns receipt |
| `GET` | `/api/parking/history` | Audit log with filters (`?status=`, `?date=`, `?search=`, `?vehicle_type=`) |
| `GET` | `/api/parking/:recordId` | Full transaction details for receipt re-printing |

---

## 8. Verification & Demonstration Steps

To demonstrate this project for examiners or evaluators:
1. **Dashboard Verification**:
   - Observe live counters for slots, vehicles, and active sessions.
   - Note the visual parking grid showing slots `A-02` and `B-02` in Red (Occupied) and `A-04` in Amber (Maintenance).
2. **Vehicle Entry**:
   - Click **Park a Vehicle** or go to **Parking Entry**.
   - Select vehicle `KA-01-MJ-5050` (Creta). Observe that only available Four-wheeler bays (like `A-01` and `A-03`) are displayed.
   - Click `A-01` and confirm check-in.
   - Verify that slot `A-01` turns Red (Occupied) and an active session is logged.
3. **Vehicle Exit & Receipt**:
   - Go to **Parking Exit**.
   - Select the newly parked vehicle or existing active vehicles.
   - Click **Process Exit**.
   - Review calculated billable hours and fee.
   - Click **Process Exit & Generate Receipt**.
   - Review the generated printable receipt and verify the slot is restored to **Available**.
4. **History & Audit**:
   - Go to **Parking History**.
   - Filter by `Completed` status or vehicle registration number.
   - Check the total collected fee calculation.

---

## 9. Academic Project Credits

- **Project Title**: Sharanya Parking - Smart Parking Management System
- **Discipline**: B.Tech Computer Science and Engineering
- **Architecture**: Decoupled RESTful Full-Stack System with ACID MySQL Transactions
- **Developed by**: Sharanya & Engineering Project Team

