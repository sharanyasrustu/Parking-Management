-- =====================================================================
-- SHARANYA PARKING - Smart Parking Management System
-- Database Schema Definition & Initial Seed Data
-- =====================================================================

-- Drop database if exists and create afresh
DROP DATABASE IF EXISTS sharanya_parking;
CREATE DATABASE sharanya_parking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sharanya_parking;

-- =====================================================================
-- TABLE 1: users
-- =====================================================================
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    role VARCHAR(20) DEFAULT 'user',
    INDEX idx_user_phone (phone),
    INDEX idx_user_email (email),
    INDEX idx_user_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- TABLE 2: parking_slots
-- =====================================================================
CREATE TABLE parking_slots (
    slot_id INT PRIMARY KEY AUTO_INCREMENT,
    slot_number VARCHAR(20) NOT NULL UNIQUE,
    vehicle_type VARCHAR(30) NOT NULL,
    location VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'Available',
    INDEX idx_slot_status (status),
    INDEX idx_slot_type (vehicle_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- TABLE 3: vehicles
-- =====================================================================
CREATE TABLE vehicles (
    vehicle_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    vehicle_number VARCHAR(30) NOT NULL UNIQUE,
    vehicle_type VARCHAR(30) NOT NULL,
    vehicle_model VARCHAR(100) NOT NULL,
    INDEX idx_vehicle_user (user_id),
    INDEX idx_vehicle_number (vehicle_number),
    INDEX idx_vehicle_type (vehicle_type),
    CONSTRAINT fk_vehicles_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- TABLE 4: parking_records
-- =====================================================================
CREATE TABLE parking_records (
    record_id INT PRIMARY KEY AUTO_INCREMENT,
    vehicle_id INT NOT NULL,
    slot_id INT NOT NULL,
    entry_time DATETIME NOT NULL,
    exit_time DATETIME NULL,
    parking_fee DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'Active',
    INDEX idx_record_vehicle (vehicle_id),
    INDEX idx_record_slot (slot_id),
    INDEX idx_record_status (status),
    INDEX idx_record_entry (entry_time),
    CONSTRAINT fk_records_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_records_slot
        FOREIGN KEY (slot_id) REFERENCES parking_slots(slot_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- SEED DATA
-- =====================================================================

-- 1. Insert Users (At least 5 users)
INSERT INTO users (user_id, name, phone, email, role) VALUES
(1, 'Sharanya Rao', '9876543210', 'sharanya.rao@example.com', 'admin'),
(2, 'Aditya Varma', '9845123456', 'aditya.varma@example.com', 'user'),
(3, 'Priya Kulkarni', '9731234567', 'priya.kulkarni@example.com', 'user'),
(4, 'Vikram Malhotra', '9900112233', 'vikram.m@example.com', 'user'),
(5, 'Ananya Deshmukh', '9880055443', 'ananya.d@example.com', 'user'),
(6, 'Rohan Mehta', '9822334455', 'rohan.mehta@example.com', 'user');

-- 2. Insert Parking Slots (10 slots across different zones and types)
-- Slot 2 (A-02) and Slot 6 (B-02) will be Occupied by active records below.
-- Slot 4 (A-04) will be under Maintenance.
-- Others will be Available.
INSERT INTO parking_slots (slot_id, slot_number, vehicle_type, location, status) VALUES
(1, 'A-01', 'Four-wheeler', 'Ground Floor - Zone A', 'Available'),
(2, 'A-02', 'Four-wheeler', 'Ground Floor - Zone A', 'Occupied'),
(3, 'A-03', 'Four-wheeler', 'Ground Floor - Zone A', 'Available'),
(4, 'A-04', 'Four-wheeler', 'Ground Floor - Zone A', 'Maintenance'),
(5, 'B-01', 'Two-wheeler',  'Basement 1 - Zone B',  'Available'),
(6, 'B-02', 'Two-wheeler',  'Basement 1 - Zone B',  'Occupied'),
(7, 'B-03', 'Two-wheeler',  'Basement 1 - Zone B',  'Available'),
(8, 'B-04', 'Two-wheeler',  'Basement 1 - Zone B',  'Available'),
(9, 'C-01', 'Heavy Vehicle', 'Surface Lot - Zone C', 'Available'),
(10, 'C-02', 'Heavy Vehicle', 'Surface Lot - Zone C', 'Available');

-- 3. Insert Vehicles (6 vehicles associated with users)
INSERT INTO vehicles (vehicle_id, user_id, vehicle_number, vehicle_type, vehicle_model) VALUES
(1, 1, 'KA-01-MJ-5050', 'Four-wheeler', 'Hyundai Creta SX (O)'),
(2, 2, 'KA-03-HA-1234', 'Four-wheeler', 'Tata Nexon EV Max'),
(3, 3, 'KA-05-EX-7890', 'Two-wheeler',  'Royal Enfield Classic 350'),
(4, 4, 'MH-12-PQ-9988', 'Two-wheeler',  'Ather 450X Gen 3'),
(5, 5, 'KA-04-TR-4422', 'Heavy Vehicle', 'BharatBenz 1617R Logistics'),
(6, 6, 'DL-01-AB-2024', 'Four-wheeler', 'Mahindra XUV700 AX7');

-- 4. Insert Parking Records (Active & Completed records)
-- Record 1: Completed parking for Vehicle 1 (Four-wheeler) at Slot 1 (Duration ~ 3 hours -> 3 * 40 = 120.00)
-- Record 2: Completed parking for Vehicle 4 (Two-wheeler) at Slot 5 (Duration ~ 2 hours -> 2 * 20 = 40.00)
-- Record 3: Active parking for Vehicle 2 (Four-wheeler) in Slot 2 (A-02) -> Slot 2 status is 'Occupied'
-- Record 4: Active parking for Vehicle 3 (Two-wheeler) in Slot 6 (B-02) -> Slot 6 status is 'Occupied'
INSERT INTO parking_records (record_id, vehicle_id, slot_id, entry_time, exit_time, parking_fee, status) VALUES
(1, 1, 1, DATE_SUB(NOW(), INTERVAL 5 HOUR), DATE_SUB(NOW(), INTERVAL 2 HOUR), 120.00, 'Completed'),
(2, 4, 5, DATE_SUB(NOW(), INTERVAL 4 HOUR), DATE_SUB(NOW(), INTERVAL 2 HOUR), 40.00, 'Completed'),
(3, 2, 2, DATE_SUB(NOW(), INTERVAL 1 HOUR), NULL, 0.00, 'Active'),
(4, 3, 6, DATE_SUB(NOW(), INTERVAL 2 HOUR), NULL, 0.00, 'Active');

-- Set AUTO_INCREMENT values properly after seed data
ALTER TABLE users AUTO_INCREMENT = 7;
ALTER TABLE parking_slots AUTO_INCREMENT = 11;
ALTER TABLE vehicles AUTO_INCREMENT = 7;
ALTER TABLE parking_records AUTO_INCREMENT = 5;

