/**
 * SHARANYA PARKING - Smart Parking Management System
 * Frontend Application Engine (Multi-Page Architecture)
 * 
 * Vanilla JavaScript (ES6+), Fetch API, Reactive UI Controllers
 */

class SharanyaParkingApp {
    constructor() {
        // Current Page detection
        this.page = document.body.dataset.page || 'dashboard';

        // App State
        this.state = {
            currentPage: this.page,
            stats: null,
            users: [],
            vehicles: [],
            slots: [],
            activeRecords: [],
            historyRecords: [],
            rates: {
                'Two-wheeler': 20.00,
                'Four-wheeler': 40.00,
                'Heavy Vehicle': 60.00
            },
            dashboardSlotFilter: 'All',
            dashboardSlotType: 'All',
            slotsViewFilter: 'All',
            slotsViewType: 'All',
            selectedEntryVehicle: null,
            selectedEntrySlot: null
        };

        // Cache Common DOM Elements
        this.dom = {
            sidebar: document.getElementById('sidebar'),
            mobileMenuBtn: document.getElementById('mobileMenuBtn'),
            mobileCloseBtn: document.getElementById('mobileCloseBtn'),
            currentTimeDisplay: document.getElementById('currentTimeDisplay'),
            globalSearchInput: document.getElementById('globalSearchInput'),
            toastContainer: document.getElementById('toastContainer'),
            sidebarActiveCount: document.getElementById('sidebarActiveCount')
        };

        this.init();
    }

    /**
     * Initialize Application for the Current Page
     */
    async init() {
        this.setupClock();
        this.setupEventListeners();
        this.setupForms();

        // 1. Load Tariff Rates and Active Session Count
        await Promise.all([
            this.loadTariffRates(),
            this.loadActiveBadge()
        ]);

        // 2. Initialize Page-Specific Data
        const urlParams = new URLSearchParams(window.location.search);

        if (this.page === 'dashboard') {
            await Promise.all([
                this.loadDashboardStats(),
                this.loadSlots(),
                this.loadRecentActivity()
            ]);
        } else if (this.page === 'entry') {
            await Promise.all([
                this.loadVehicles(),
                this.loadSlots()
            ]);
            const preVehicleId = urlParams.get('vehicleId');
            const preSlotId = urlParams.get('slotId');
            this.prepareEntryView(preVehicleId, preSlotId);
        } else if (this.page === 'exit') {
            await this.loadActiveRecords();
            const recordId = urlParams.get('recordId');
            if (recordId) {
                this.openExitModal(parseInt(recordId, 10));
            }
        } else if (this.page === 'slots') {
            await this.loadSlots();
        } else if (this.page === 'vehicles') {
            await this.loadVehicles();
        } else if (this.page === 'users') {
            await this.loadUsers();
        } else if (this.page === 'history') {
            await this.loadHistory();
        }

        console.log(`✓ Sharanya Parking [${this.page.toUpperCase()}] Initialized.`);
    }

    /**
     * Setup Real-time Clock
     */
    setupClock() {
        const update = () => {
            const now = new Date();
            const options = { 
                weekday: 'short', 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: true 
            };
            if (this.dom.currentTimeDisplay) {
                this.dom.currentTimeDisplay.textContent = now.toLocaleDateString('en-US', options);
            }
        };
        update();
        setInterval(update, 1000);
    }

    /**
     * Setup Global Event Listeners
     */
    setupEventListeners() {
        // Mobile Sidebar Toggle
        if (this.dom.mobileMenuBtn) {
            this.dom.mobileMenuBtn.addEventListener('click', () => {
                this.dom.sidebar.classList.add('open');
            });
        }
        if (this.dom.mobileCloseBtn) {
            this.dom.mobileCloseBtn.addEventListener('click', () => {
                this.dom.sidebar.classList.remove('open');
            });
        }

        // Tariff Modal Open
        const openTariffBtn = document.getElementById('openTariffModalBtn');
        if (openTariffBtn) {
            openTariffBtn.addEventListener('click', () => {
                this.showModal('tariffModal');
            });
        }

        // Global Search Hotkey '/'
        window.addEventListener('keydown', (e) => {
            if (e.key === '/' && document.activeElement !== this.dom.globalSearchInput && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                if (this.dom.globalSearchInput) this.dom.globalSearchInput.focus();
            }
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });

        // Global Search Input Across Pages
        if (this.dom.globalSearchInput) {
            this.dom.globalSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const term = e.target.value.toLowerCase().trim();
                    if (!term) return;

                    // If pattern looks like vehicle plate number
                    if (term.includes('ka') || term.includes('dl') || term.includes('mh') || term.includes('-') || /\d/.test(term)) {
                        window.location.href = `vehicles.html?search=${encodeURIComponent(term)}`;
                    } else {
                        window.location.href = `users.html?search=${encodeURIComponent(term)}`;
                    }
                }
            });
        }

        // Dashboard Slot Filter Buttons
        const dashFilterGroup = document.getElementById('dashboardSlotStatusFilter');
        if (dashFilterGroup) {
            dashFilterGroup.addEventListener('click', (e) => {
                const btn = e.target.closest('.pill-btn');
                if (!btn) return;
                dashFilterGroup.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.dashboardSlotFilter = btn.dataset.filter;
                this.renderDashboardSlots();
            });
        }

        const dashTypeSelect = document.getElementById('dashboardSlotTypeFilter');
        if (dashTypeSelect) {
            dashTypeSelect.addEventListener('change', (e) => {
                this.state.dashboardSlotType = e.target.value;
                this.renderDashboardSlots();
            });
        }

        // Slots View Filters (on slots.html)
        const slotsFilterGroup = document.getElementById('slotsViewStatusFilter');
        if (slotsFilterGroup) {
            slotsFilterGroup.addEventListener('click', (e) => {
                const btn = e.target.closest('.pill-btn');
                if (!btn) return;
                slotsFilterGroup.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.slotsViewFilter = btn.dataset.filter;
                this.renderSlotsView();
            });
        }

        const slotsTypeSelect = document.getElementById('slotsViewTypeFilter');
        if (slotsTypeSelect) {
            slotsTypeSelect.addEventListener('change', (e) => {
                this.state.slotsViewType = e.target.value;
                this.renderSlotsView();
            });
        }

        const slotsSearch = document.getElementById('slotsSearchInput');
        if (slotsSearch) {
            slotsSearch.addEventListener('input', () => this.renderSlotsView());
        }

        // User Search (on users.html)
        const usersSearch = document.getElementById('usersSearchInput');
        if (usersSearch) {
            // Check URL search parameter
            const params = new URLSearchParams(window.location.search);
            if (params.get('search')) {
                usersSearch.value = params.get('search');
            }
            let timeout;
            usersSearch.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.loadUsers(), 300);
            });
        }

        // Vehicle Search & Filters (on vehicles.html)
        const vehiclesSearch = document.getElementById('vehiclesSearchInput');
        if (vehiclesSearch) {
            const params = new URLSearchParams(window.location.search);
            if (params.get('search')) {
                vehiclesSearch.value = params.get('search');
            }
            let timeout;
            vehiclesSearch.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.loadVehicles(), 300);
            });
        }
        const vehiclesType = document.getElementById('vehiclesTypeFilter');
        if (vehiclesType) {
            vehiclesType.addEventListener('change', () => this.loadVehicles());
        }

        // Exit Search (on exit.html)
        const exitSearch = document.getElementById('exitSearchInput');
        if (exitSearch) {
            exitSearch.addEventListener('input', () => this.renderActiveSessions());
        }

        // History Filters (on history.html)
        const histStatusGroup = document.getElementById('historyStatusFilter');
        if (histStatusGroup) {
            histStatusGroup.addEventListener('click', (e) => {
                const btn = e.target.closest('.pill-btn');
                if (!btn) return;
                histStatusGroup.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.loadHistory();
            });
        }

        const histType = document.getElementById('historyTypeFilter');
        if (histType) {
            histType.addEventListener('change', () => this.loadHistory());
        }

        const histDate = document.getElementById('historyDateFilter');
        if (histDate) {
            histDate.addEventListener('change', () => this.loadHistory());
        }

        const histSearch = document.getElementById('historySearchInput');
        if (histSearch) {
            let timeout;
            histSearch.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.loadHistory(), 300);
            });
        }

        const clearHistBtn = document.getElementById('clearHistoryFiltersBtn');
        if (clearHistBtn) {
            clearHistBtn.addEventListener('click', () => {
                if (histDate) histDate.value = '';
                if (histSearch) histSearch.value = '';
                if (histType) histType.value = 'All';
                if (histStatusGroup) {
                    histStatusGroup.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
                    histStatusGroup.querySelector('[data-filter="All"]').classList.add('active');
                }
                this.loadHistory();
            });
        }
    }

    /**
     * Setup Form Event Handlers
     */
    setupForms() {
        // User Form (Create / Edit)
        const userForm = document.getElementById('userForm');
        if (userForm) {
            userForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleUserFormSubmit();
            });
        }

        // Vehicle Form (Create / Edit)
        const vehicleForm = document.getElementById('vehicleForm');
        if (vehicleForm) {
            vehicleForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleVehicleFormSubmit();
            });
        }

        // Parking Slot Form (Create / Edit)
        const slotForm = document.getElementById('slotForm');
        if (slotForm) {
            slotForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleSlotFormSubmit();
            });
        }

        // Direct Entry Form (entry.html)
        const directEntryForm = document.getElementById('directEntryForm');
        if (directEntryForm) {
            directEntryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleDirectEntrySubmit();
            });
        }

        // Vehicle Select in Direct Entry Page
        const entryVehicleSelect = document.getElementById('entryVehicleSelect');
        if (entryVehicleSelect) {
            entryVehicleSelect.addEventListener('change', (e) => {
                this.onEntryVehicleSelected(e.target.value);
            });
        }

        // Slot Select in Direct Entry Page
        const entrySlotSelect = document.getElementById('entrySlotSelect');
        if (entrySlotSelect) {
            entrySlotSelect.addEventListener('change', (e) => {
                this.onEntrySlotSelected(e.target.value);
            });
        }
    }

    // =====================================================================
    // NAVIGATION & INTER-PAGE ACTIONS
    // =====================================================================

    navigateTo(target) {
        const pages = {
            'dashboard': 'index.html',
            'entry': 'entry.html',
            'exit': 'exit.html',
            'slots': 'slots.html',
            'vehicles': 'vehicles.html',
            'users': 'users.html',
            'history': 'history.html'
        };
        const targetUrl = pages[target] || `${target}.html`;
        window.location.href = targetUrl;
    }

    quickParkInSlot(slotId) {
        if (this.page === 'entry') {
            this.selectEntrySlot(slotId);
        } else {
            window.location.href = `entry.html?slotId=${slotId}`;
        }
    }

    quickParkVehicle(vehicleId) {
        if (this.page === 'entry') {
            this.prepareEntryView(vehicleId);
        } else {
            window.location.href = `entry.html?vehicleId=${vehicleId}`;
        }
    }

    quickExitSlot(recordId) {
        if (this.page === 'exit') {
            this.openExitModal(recordId);
        } else {
            window.location.href = `exit.html?recordId=${recordId}`;
        }
    }

    // =====================================================================
    // DATA FETCHING & API SERVICES
    // =====================================================================

    async api(endpoint, options = {}) {
        try {
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    ...(options.headers || {})
                },
                ...options
            };
            const response = await fetch(endpoint, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Request failed with status ${response.status}`);
            }
            return data;
        } catch (err) {
            console.error(`[API Error] ${endpoint}:`, err);
            throw err;
        }
    }

    async loadTariffRates() {
        try {
            const res = await this.api('/api/parking/rates');
            if (res.success && res.data) {
                this.state.rates = res.data;
            }
        } catch (err) {
            console.warn('Could not fetch custom rates, using defaults.');
        }
    }

    async loadActiveBadge() {
        try {
            const res = await this.api('/api/parking/active');
            if (res.success) {
                this.state.activeRecords = res.data;
                if (this.dom.sidebarActiveCount) {
                    this.dom.sidebarActiveCount.textContent = res.data.length;
                }
                const activeCountBadge = document.getElementById('activeSessionsCountBadge');
                if (activeCountBadge) {
                    activeCountBadge.textContent = `${res.data.length} Active`;
                }
            }
        } catch (err) {
            console.error('Error loading active badge:', err);
        }
    }

    async loadDashboardStats() {
        try {
            const res = await this.api('/api/dashboard/stats');
            if (res.success && res.data) {
                this.state.stats = res.data;
                this.renderDashboardStats(res.data);
            }
        } catch (err) {
            console.error('Error loading stats:', err);
        }
    }

    async loadRecentActivity() {
        try {
            const res = await this.api('/api/dashboard/recent-activity');
            if (res.success) {
                this.renderRecentActivity(res.data);
            }
        } catch (err) {
            console.error('Error loading recent activity:', err);
        }
    }

    async loadSlots() {
        try {
            const res = await this.api('/api/slots');
            if (res.success) {
                this.state.slots = res.data;
                if (this.page === 'dashboard') {
                    this.renderDashboardSlots();
                    this.updateSlotPillCounts();
                } else if (this.page === 'slots') {
                    this.renderSlotsView();
                }
            }
        } catch (err) {
            console.error('Error loading slots:', err);
        }
    }

    async loadVehicles() {
        try {
            const searchInput = document.getElementById('vehiclesSearchInput');
            const typeFilter = document.getElementById('vehiclesTypeFilter');
            const search = searchInput ? searchInput.value.trim() : '';
            const type = typeFilter ? typeFilter.value : 'All';

            let url = `/api/vehicles?search=${encodeURIComponent(search)}`;
            if (type !== 'All') url += `&type=${encodeURIComponent(type)}`;

            const res = await this.api(url);
            if (res.success) {
                this.state.vehicles = res.data;
                if (this.page === 'vehicles') {
                    this.renderVehiclesTable(res.data);
                }
            }
        } catch (err) {
            console.error('Error loading vehicles:', err);
        }
    }

    async loadUsers() {
        try {
            const searchInput = document.getElementById('usersSearchInput');
            const search = searchInput ? searchInput.value.trim() : '';
            const url = `/api/users?search=${encodeURIComponent(search)}`;

            const res = await this.api(url);
            if (res.success) {
                this.state.users = res.data;
                if (this.page === 'users') {
                    this.renderUsersTable(res.data);
                    const countDisplay = document.getElementById('usersTotalDisplay');
                    if (countDisplay) countDisplay.textContent = res.data.length;
                }
            }
        } catch (err) {
            console.error('Error loading users:', err);
        }
    }

    async loadActiveRecords() {
        try {
            const res = await this.api('/api/parking/active');
            if (res.success) {
                this.state.activeRecords = res.data;
                this.renderActiveSessions();
                if (this.dom.sidebarActiveCount) {
                    this.dom.sidebarActiveCount.textContent = res.data.length;
                }
                const activeCountBadge = document.getElementById('activeSessionsCountBadge');
                if (activeCountBadge) {
                    activeCountBadge.textContent = `${res.data.length} Active`;
                }
            }
        } catch (err) {
            console.error('Error loading active records:', err);
        }
    }

    async loadHistory() {
        try {
            const statusBtn = document.querySelector('#historyStatusFilter .pill-btn.active');
            const status = statusBtn ? statusBtn.dataset.filter : 'All';
            const type = document.getElementById('historyTypeFilter')?.value || 'All';
            const date = document.getElementById('historyDateFilter')?.value || '';
            const search = document.getElementById('historySearchInput')?.value.trim() || '';

            let url = `/api/parking/history?status=${encodeURIComponent(status)}&vehicle_type=${encodeURIComponent(type)}`;
            if (date) url += `&date=${encodeURIComponent(date)}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;

            const res = await this.api(url);
            if (res.success) {
                this.state.historyRecords = res.data;
                this.renderHistoryTable(res.data, res.totalCollectedFee);
            }
        } catch (err) {
            console.error('Error loading history:', err);
        }
    }

    // =====================================================================
    // RENDER FUNCTIONS
    // =====================================================================

    animateValue(id, start, end, duration = 800) {
        const obj = document.getElementById(id);
        if (!obj) return;
        const range = end - start;
        let current = start;
        const increment = end > start ? 1 : -1;
        const stepTime = Math.abs(Math.floor(duration / (range || 1)));
        
        if (range === 0) {
            obj.textContent = end;
            return;
        }

        const timer = setInterval(() => {
            current += increment;
            obj.textContent = current;
            if (current === end) {
                clearInterval(timer);
            }
        }, Math.min(stepTime, 50));
    }

    renderDashboardStats(stats) {
        this.animateValue('statTotalSlots', 0, stats.totalSlots);
        this.animateValue('statAvailableSlots', 0, stats.availableSlots);
        this.animateValue('statOccupiedSlots', 0, stats.occupiedSlots);
        this.animateValue('statRegisteredVehicles', 0, stats.registeredVehicles);
        this.animateValue('statRegisteredUsers', 0, stats.registeredUsers);
        this.animateValue('statActiveRecords', 0, stats.activeRecords);

        const occElem = document.getElementById('statOccupancyRate');
        if (occElem) {
            occElem.textContent = `${stats.occupancyRate}% Current Occupancy`;
        }
    }

    updateSlotPillCounts() {
        const slots = this.state.slots;
        const countAll = slots.length;
        const countAvail = slots.filter(s => s.status === 'Available').length;
        const countOcc = slots.filter(s => s.status === 'Occupied').length;
        const countMaint = slots.filter(s => s.status === 'Maintenance').length;

        const pAll = document.getElementById('pillCountAll');
        const pAvail = document.getElementById('pillCountAvail');
        const pOcc = document.getElementById('pillCountOcc');
        const pMaint = document.getElementById('pillCountMaint');

        if (pAll) pAll.textContent = countAll;
        if (pAvail) pAvail.textContent = countAvail;
        if (pOcc) pOcc.textContent = countOcc;
        if (pMaint) pMaint.textContent = countMaint;
    }

    renderDashboardSlots() {
        const container = document.getElementById('dashboardSlotsGrid');
        if (!container) return;

        let filtered = this.state.slots;

        if (this.state.dashboardSlotFilter !== 'All') {
            filtered = filtered.filter(s => s.status === this.state.dashboardSlotFilter);
        }

        if (this.state.dashboardSlotType !== 'All') {
            filtered = filtered.filter(s => s.vehicle_type === this.state.dashboardSlotType);
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state-card">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                    <h4>No Parking Bays Match Criteria</h4>
                    <p>Adjust your filter options above or expand bay capacity.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(slot => {
            const statusClass = slot.status.toLowerCase();
            return `
                <div class="slot-card status-${statusClass}">
                    <div class="slot-top-row">
                        <span class="slot-number-badge">${slot.slot_number}</span>
                        <span class="slot-status-pill ${statusClass}">${slot.status}</span>
                    </div>

                    <div class="slot-meta-row">
                        <span class="slot-type-tag">
                            ${this.getVehicleTypeIcon(slot.vehicle_type)}
                            ${slot.vehicle_type}
                        </span>
                        <span class="slot-location-tag" title="${slot.location}">${slot.location}</span>
                    </div>

                    ${slot.status === 'Occupied' && slot.current_vehicle_number ? `
                        <div class="slot-occupant-box">
                            <span class="occupant-plate">${slot.current_vehicle_number}</span>
                            <div class="occupant-details">
                                <span>${slot.current_driver_name || 'Driver'}</span>
                                <span class="text-teal">${slot.current_vehicle_model || ''}</span>
                            </div>
                        </div>
                    ` : ''}

                    <div class="slot-actions">
                        ${slot.status === 'Available' ? `
                            <button class="btn btn-primary btn-sm btn-block" onclick="app.quickParkInSlot(${slot.slot_id})">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>
                                <span>Park Here</span>
                            </button>
                        ` : slot.status === 'Occupied' ? `
                            <button class="btn btn-danger btn-sm btn-block" onclick="app.quickExitSlot(${slot.current_record_id})">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                                <span>Process Exit</span>
                            </button>
                        ` : `
                            <button class="btn btn-secondary btn-sm btn-block" onclick="app.openEditSlotModal(${slot.slot_id})">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                <span>Modify Bay</span>
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderSlotsView() {
        const container = document.getElementById('slotsViewGrid');
        if (!container) return;

        let filtered = this.state.slots;
        const search = document.getElementById('slotsSearchInput')?.value.toLowerCase().trim() || '';

        if (this.state.slotsViewFilter !== 'All') {
            filtered = filtered.filter(s => s.status === this.state.slotsViewFilter);
        }

        if (this.state.slotsViewType !== 'All') {
            filtered = filtered.filter(s => s.vehicle_type === this.state.slotsViewType);
        }

        if (search) {
            filtered = filtered.filter(s => 
                s.slot_number.toLowerCase().includes(search) || 
                s.location.toLowerCase().includes(search)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state-card">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                    <h4>No Parking Bays Found</h4>
                    <p>Try modifying your search or add a new bay.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(slot => {
            const statusClass = slot.status.toLowerCase();
            return `
                <div class="slot-card status-${statusClass}">
                    <div class="slot-top-row">
                        <span class="slot-number-badge">${slot.slot_number}</span>
                        <span class="slot-status-pill ${statusClass}">${slot.status}</span>
                    </div>

                    <div class="slot-meta-row">
                        <span class="slot-type-tag">
                            ${this.getVehicleTypeIcon(slot.vehicle_type)}
                            ${slot.vehicle_type}
                        </span>
                    </div>
                    <span class="slot-location-tag">📍 ${slot.location}</span>

                    ${slot.status === 'Occupied' && slot.current_vehicle_number ? `
                        <div class="slot-occupant-box">
                            <span class="occupant-plate">${slot.current_vehicle_number}</span>
                            <div class="occupant-details">
                                <span>${slot.current_driver_name || 'Driver'}</span>
                                <span class="text-teal">${slot.current_vehicle_model || ''}</span>
                            </div>
                        </div>
                    ` : ''}

                    <div class="slot-actions">
                        ${slot.status === 'Available' ? `
                            <button class="btn btn-primary btn-sm" onclick="app.quickParkInSlot(${slot.slot_id})">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>
                                <span>Park</span>
                            </button>
                        ` : slot.status === 'Occupied' ? `
                            <button class="btn btn-danger btn-sm" onclick="app.quickExitSlot(${slot.current_record_id})">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                                <span>Exit</span>
                            </button>
                        ` : ''}
                        <button class="btn btn-secondary btn-sm" onclick="app.openEditSlotModal(${slot.slot_id})">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            <span>Edit</span>
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="app.deleteSlot(${slot.slot_id}, '${slot.slot_number}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            <span>Delete</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderRecentActivity(records) {
        const tbody = document.getElementById('recentActivityTableBody');
        if (!tbody) return;

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="table-loading">No recent transactions recorded.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map(r => `
            <tr>
                <td><span class="plate-text">${r.vehicle_number}</span></td>
                <td>
                    <strong>${r.vehicle_type}</strong>
                    <div class="text-muted" style="font-size:0.75rem;">${r.vehicle_model}</div>
                </td>
                <td>${r.owner_name}</td>
                <td><strong class="text-teal">${r.slot_number}</strong></td>
                <td>${this.formatDateTime(r.entry_time)}</td>
                <td>${r.exit_time ? this.formatDateTime(r.exit_time) : '<span class="text-warning">In Premises</span>'}</td>
                <td><strong>₹${parseFloat(r.parking_fee || 0).toFixed(2)}</strong></td>
                <td>
                    <span class="badge ${r.status === 'Active' ? 'badge-active' : 'badge-completed'}">
                        ${r.status}
                    </span>
                </td>
                <td>
                    ${r.status === 'Active' ? `
                        <button class="btn btn-danger btn-sm" onclick="app.quickExitSlot(${r.record_id})">
                            <span>Exit</span>
                        </button>
                    ` : `
                        <button class="btn btn-secondary btn-sm" onclick="app.viewReceipt(${r.record_id})">
                            <span>Receipt</span>
                        </button>
                    `}
                </td>
            </tr>
        `).join('');
    }

    renderUsersTable(users) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="table-loading">No users found. Click "Add New User" to register one.</td></tr>`;
            return;
        }

        tbody.innerHTML = users.map(u => `
            <tr>
                <td>
                    <div class="table-user-cell">
                        <div class="user-avatar-sm">${u.name.substring(0, 2).toUpperCase()}</div>
                        <div>
                            <strong>${u.name}</strong>
                            <div class="text-muted" style="font-size:0.75rem;">ID: #${u.user_id}</div>
                        </div>
                    </div>
                </td>
                <td><span style="font-family:'JetBrains Mono', monospace;">${u.phone}</span></td>
                <td>${u.email}</td>
                <td>
                    <span class="badge badge-role">${u.role || 'user'}</span>
                </td>
                <td>
                    <strong>${u.vehicle_count}</strong> vehicle(s)
                </td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon-only edit-btn" onclick="app.openEditUserModal(${u.user_id})" title="Edit User">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </button>
                        <button class="btn-icon-only del-btn" onclick="app.deleteUser(${u.user_id}, '${u.name}')" title="Delete User">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderVehiclesTable(vehicles) {
        const tbody = document.getElementById('vehiclesTableBody');
        if (!tbody) return;

        if (vehicles.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="table-loading">No vehicles registered yet. Click "Register Vehicle" to add one.</td></tr>`;
            return;
        }

        tbody.innerHTML = vehicles.map(v => `
            <tr>
                <td><span class="plate-text">${v.vehicle_number}</span></td>
                <td><strong>${v.vehicle_model}</strong></td>
                <td>
                    <span class="slot-type-tag">
                        ${this.getVehicleTypeIcon(v.vehicle_type)}
                        ${v.vehicle_type}
                    </span>
                </td>
                <td>${v.owner_name}</td>
                <td><span style="font-family:'JetBrains Mono', monospace;">${v.owner_phone}</span></td>
                <td>
                    ${v.active_record_id ? `
                        <span class="badge badge-parked">Parked: Slot ${v.active_slot_number}</span>
                    ` : `
                        <span class="badge" style="background:rgba(255,255,255,0.06);color:var(--text-muted);">Not Parked</span>
                    `}
                </td>
                <td>
                    <div class="table-actions">
                        ${!v.active_record_id ? `
                            <button class="btn btn-primary btn-sm" onclick="app.quickParkVehicle(${v.vehicle_id})" title="Park Vehicle">
                                <span>Park</span>
                            </button>
                        ` : `
                            <button class="btn btn-danger btn-sm" onclick="app.quickExitSlot(${v.active_record_id})" title="Exit Vehicle">
                                <span>Exit</span>
                            </button>
                        `}
                        <button class="btn-icon-only edit-btn" onclick="app.openEditVehicleModal(${v.vehicle_id})" title="Edit Vehicle">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </button>
                        <button class="btn-icon-only del-btn" onclick="app.deleteVehicle(${v.vehicle_id}, '${v.vehicle_number}')" title="Delete Vehicle">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderActiveSessions() {
        const container = document.getElementById('activeRecordsGrid');
        if (!container) return;

        let records = this.state.activeRecords;
        const search = document.getElementById('exitSearchInput')?.value.toLowerCase().trim() || '';

        if (search) {
            records = records.filter(r => 
                r.vehicle_number.toLowerCase().includes(search) || 
                r.slot_number.toLowerCase().includes(search) ||
                r.owner_name.toLowerCase().includes(search)
            );
        }

        if (records.length === 0) {
            container.innerHTML = `
                <div class="empty-state-card">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                    <h4>No Active Parking Sessions</h4>
                    <p>All bays are currently unoccupied or no active sessions match your filter.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = records.map(r => `
            <div class="active-session-card">
                <div class="session-header">
                    <span class="session-plate-badge">${r.vehicle_number}</span>
                    <span class="session-slot-pill">Bay ${r.slot_number}</span>
                </div>

                <div class="session-info-grid">
                    <div class="session-info-item">
                        <span class="session-lbl">Vehicle Category</span>
                        <span class="session-val">${r.vehicle_type}</span>
                    </div>
                    <div class="session-info-item">
                        <span class="session-lbl">Owner / Driver</span>
                        <span class="session-val">${r.owner_name}</span>
                    </div>
                    <div class="session-info-item">
                        <span class="session-lbl">Entry Timestamp</span>
                        <span class="session-val">${this.formatDateTime(r.entry_time)}</span>
                    </div>
                    <div class="session-info-item">
                        <span class="session-lbl">Active Duration</span>
                        <span class="session-val text-warning live-timer" data-entry="${r.entry_time}" data-type="${r.vehicle_type}" data-record="${r.record_id}">${r.currentDuration}</span>
                    </div>
                </div>

                <div class="session-billing-row">
                    <div>
                        <span class="session-lbl">Estimated Tariff</span>
                        <div class="text-muted" style="font-size:0.7rem;">(${r.billableHours} hr(s) @ ₹${r.hourlyRate}/hr)</div>
                    </div>
                    <span class="session-fee" id="live-fee-${r.record_id}">₹${r.estimatedFee.toFixed(2)}</span>
                </div>

                <button class="btn btn-danger btn-block" onclick="app.openExitModal(${r.record_id})">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                    <span>Process Vehicle Exit</span>
                </button>
            </div>
        `).join('');

        // Start live ticking timers for all active cards
        this.startActiveSessionTimers();
    }

    renderHistoryTable(records, totalRevenue = 0) {
        const tbody = document.getElementById('historyTableBody');
        const revElem = document.getElementById('historyRevenueTotal');
        if (revElem) revElem.textContent = `₹${parseFloat(totalRevenue || 0).toFixed(2)}`;
        if (!tbody) return;

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="table-loading">No parking records match the selected filters.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map(r => `
            <tr>
                <td>#${r.record_id}</td>
                <td><span class="plate-text">${r.vehicle_number}</span></td>
                <td>${r.owner_name}</td>
                <td>${r.vehicle_type}</td>
                <td><strong class="text-teal">${r.slot_number}</strong></td>
                <td>${this.formatDateTime(r.entry_time)}</td>
                <td>${r.exit_time ? this.formatDateTime(r.exit_time) : '<span class="text-warning">In Premises</span>'}</td>
                <td><strong>₹${parseFloat(r.parking_fee || 0).toFixed(2)}</strong></td>
                <td>
                    <span class="badge ${r.status === 'Active' ? 'badge-active' : 'badge-completed'}">
                        ${r.status}
                    </span>
                </td>
                <td>
                    ${r.status === 'Completed' ? `
                        <button class="btn btn-secondary btn-sm" onclick="app.viewReceipt(${r.record_id})">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>
                            <span>Receipt</span>
                        </button>
                    ` : `
                        <span class="text-dim" style="font-size:0.75rem;">Ongoing</span>
                    `}
                </td>
            </tr>
        `).join('');
    }

    // =====================================================================
    // PARKING ENTRY FLOW (entry.html)
    // =====================================================================

    prepareEntryView(preselectedVehicleId = null, preselectedSlotId = null) {
        const vehicleSelect = document.getElementById('entryVehicleSelect');
        const slotSelect = document.getElementById('entrySlotSelect');
        const confirmBtn = document.getElementById('confirmEntryBtn');
        const previewBox = document.getElementById('entryVehiclePreview');
        const grid = document.getElementById('entryCompatibleSlotsGrid');

        if (!vehicleSelect) return;

        // Reset
        slotSelect.innerHTML = '<option value="">-- Select a vehicle first --</option>';
        slotSelect.disabled = true;
        confirmBtn.disabled = true;
        previewBox.style.display = 'none';

        // Populate Vehicles dropdown
        vehicleSelect.innerHTML = '<option value="">-- Choose a registered vehicle --</option>';
        this.state.vehicles.forEach(v => {
            const isParked = !!v.active_record_id;
            const option = document.createElement('option');
            option.value = v.vehicle_id;
            option.textContent = `${v.vehicle_number} (${v.vehicle_model} - ${v.owner_name})${isParked ? ' [ALREADY PARKED]' : ''}`;
            if (isParked) option.disabled = true;
            vehicleSelect.appendChild(option);
        });

        if (preselectedVehicleId) {
            vehicleSelect.value = preselectedVehicleId;
            this.onEntryVehicleSelected(preselectedVehicleId, preselectedSlotId);
        } else if (preselectedSlotId) {
            const slot = this.state.slots.find(s => s.slot_id === parseInt(preselectedSlotId, 10));
            if (slot) {
                const compatibleVehicle = this.state.vehicles.find(v => !v.active_record_id && v.vehicle_type === slot.vehicle_type);
                if (compatibleVehicle) {
                    vehicleSelect.value = compatibleVehicle.vehicle_id;
                    this.onEntryVehicleSelected(compatibleVehicle.vehicle_id, preselectedSlotId);
                    this.showToast(`Selected ${compatibleVehicle.vehicle_number} for Bay ${slot.slot_number}`, 'info');
                } else {
                    this.showToast(`Selected Bay ${slot.slot_number}. Please register an unparked ${slot.vehicle_type}.`, 'warning');
                }
            }
        } else {
            grid.innerHTML = `
                <div class="empty-state-card">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                    <h4>No Vehicle Selected</h4>
                    <p>Select a registered vehicle from the form on the left to display available matching slots.</p>
                </div>
            `;
        }
    }

    onEntryVehicleSelected(vehicleId, preselectedSlotId = null) {
        const slotSelect = document.getElementById('entrySlotSelect');
        const confirmBtn = document.getElementById('confirmEntryBtn');
        const previewBox = document.getElementById('entryVehiclePreview');
        const grid = document.getElementById('entryCompatibleSlotsGrid');

        if (!vehicleId) {
            slotSelect.disabled = true;
            confirmBtn.disabled = true;
            previewBox.style.display = 'none';
            grid.innerHTML = `<div class="empty-state-card"><h4>No Vehicle Selected</h4></div>`;
            return;
        }

        const vehicle = this.state.vehicles.find(v => v.vehicle_id === parseInt(vehicleId, 10));
        if (!vehicle) return;

        this.state.selectedEntryVehicle = vehicle;

        // Show Vehicle Preview
        previewBox.style.display = 'flex';
        document.getElementById('previewPlate').textContent = vehicle.vehicle_number;
        document.getElementById('previewModel').textContent = vehicle.vehicle_model;
        document.getElementById('previewType').textContent = vehicle.vehicle_type;
        document.getElementById('previewOwner').textContent = vehicle.owner_name;
        document.getElementById('previewRate').textContent = `₹${(this.state.rates[vehicle.vehicle_type] || 40).toFixed(2)} / hr`;

        // Filter compatible Available slots
        const compatibleSlots = this.state.slots.filter(s => 
            s.status === 'Available' && s.vehicle_type === vehicle.vehicle_type
        );

        if (compatibleSlots.length === 0) {
            slotSelect.innerHTML = `<option value="">-- No available ${vehicle.vehicle_type} slots --</option>`;
            slotSelect.disabled = true;
            confirmBtn.disabled = true;
            grid.innerHTML = `
                <div class="empty-state-card">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                    <h4>No Bays Available</h4>
                    <p>All bays reserved for <strong>${vehicle.vehicle_type}</strong> are currently occupied or in maintenance.</p>
                </div>
            `;
            return;
        }

        slotSelect.innerHTML = '<option value="">-- Choose a compatible slot --</option>';
        compatibleSlots.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.slot_id;
            opt.textContent = `${s.slot_number} - ${s.location}`;
            slotSelect.appendChild(opt);
        });

        slotSelect.disabled = false;

        // Render compatible slot visual tiles
        grid.innerHTML = compatibleSlots.map(s => `
            <div class="compatible-slot-card ${preselectedSlotId == s.slot_id ? 'selected' : ''}" data-slot-id="${s.slot_id}" onclick="app.selectEntrySlot(${s.slot_id})">
                <div class="slot-top-row">
                    <strong class="slot-number-badge">${s.slot_number}</strong>
                    <span class="slot-status-pill available">Free</span>
                </div>
                <span class="slot-location-tag">${s.location}</span>
                <span class="text-teal" style="font-size:0.75rem;font-weight:600;">Click to select</span>
            </div>
        `).join('');

        if (preselectedSlotId) {
            this.selectEntrySlot(preselectedSlotId);
        }
    }

    selectEntrySlot(slotId) {
        const slotSelect = document.getElementById('entrySlotSelect');
        const confirmBtn = document.getElementById('confirmEntryBtn');
        const grid = document.getElementById('entryCompatibleSlotsGrid');

        if (slotSelect) slotSelect.value = slotId;
        if (confirmBtn) confirmBtn.disabled = false;

        if (grid) {
            grid.querySelectorAll('.compatible-slot-card').forEach(card => {
                card.classList.toggle('selected', card.dataset.slotId == slotId);
            });
        }
    }

    onEntrySlotSelected(slotId) {
        if (!slotId) {
            document.getElementById('confirmEntryBtn').disabled = true;
            return;
        }
        this.selectEntrySlot(slotId);
    }

    async handleDirectEntrySubmit() {
        const vehicleId = document.getElementById('entryVehicleSelect').value;
        const slotId = document.getElementById('entrySlotSelect').value;

        if (!vehicleId || !slotId) {
            this.showToast('Please select both a vehicle and an available slot', 'warning');
            return;
        }

        try {
            const btn = document.getElementById('confirmEntryBtn');
            btn.disabled = true;
            btn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Committing Transaction...`;

            const res = await this.api('/api/parking/entry', {
                method: 'POST',
                body: JSON.stringify({
                    vehicle_id: parseInt(vehicleId, 10),
                    slot_id: parseInt(slotId, 10)
                })
            });

            this.showToast(res.message, 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1200);
        } catch (err) {
            this.showToast(err.message, 'error');
            const btn = document.getElementById('confirmEntryBtn');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg> <span>Confirm Check-In & Park Vehicle</span>`;
            }
        }
    }

    // =====================================================================
    // PARKING EXIT & RECEIPT FLOW (exit.html)
    // =====================================================================

    openExitModal(recordId) {
        const record = this.state.activeRecords.find(r => r.record_id === recordId);
        if (!record) {
            this.showToast('Active record not found or already completed', 'error');
            return;
        }

        document.getElementById('exitRecordIdInput').value = record.record_id;
        document.getElementById('exitVehicleNumber').textContent = record.vehicle_number;
        document.getElementById('exitVehicleModel').textContent = `${record.vehicle_type} • ${record.vehicle_model}`;
        document.getElementById('exitOwnerName').textContent = record.owner_name;
        document.getElementById('exitSlotNumber').textContent = record.slot_number;
        document.getElementById('exitEntryTime').textContent = this.formatDateTime(record.entry_time);
        document.getElementById('exitCurrentTime').textContent = this.formatDateTime(new Date());
        document.getElementById('exitDuration').textContent = record.currentDuration;
        document.getElementById('exitBillableHours').textContent = `${record.billableHours} hr(s) (@ ₹${record.hourlyRate}/hr)`;
        document.getElementById('exitEstimatedFee').textContent = `₹${record.estimatedFee.toFixed(2)}`;

        this.showModal('exitModal');
    }

    async executeVehicleExit() {
        const recordId = document.getElementById('exitRecordIdInput').value;
        if (!recordId) return;

        const btn = document.getElementById('confirmProcessExitBtn');
        try {
            btn.disabled = true;
            btn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Finalizing Transaction...`;

            const res = await this.api(`/api/parking/exit/${recordId}`, {
                method: 'POST'
            });

            this.showToast(res.message, 'success');
            this.closeModal('exitModal');

            // Show Printable Receipt
            this.renderReceiptModal(res.receipt);
            this.showModal('receiptModal');

            // Refresh Active sessions
            await this.loadActiveRecords();
        } catch (err) {
            this.showToast(err.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg> <span>Process Exit & Generate Receipt</span>`;
            }
        }
    }

    async viewReceipt(recordId) {
        try {
            const res = await this.api(`/api/parking/${recordId}`);
            if (res.success && res.data) {
                const r = res.data;
                const receipt = {
                    receiptNumber: `SP-REC-${String(r.record_id).padStart(6, '0')}`,
                    recordId: r.record_id,
                    vehicleNumber: r.vehicle_number,
                    vehicleType: r.vehicle_type,
                    vehicleModel: r.vehicle_model,
                    ownerName: r.owner_name,
                    slotNumber: r.slot_number,
                    entryTime: r.entry_time,
                    exitTime: r.exit_time,
                    durationFormatted: r.durationInfo?.durationFormatted || 'N/A',
                    billableHours: r.durationInfo?.billableHours || 1,
                    hourlyRate: r.durationInfo?.hourlyRate || 40,
                    parkingFee: parseFloat(r.parking_fee || 0),
                    timestamp: r.exit_time || r.entry_time
                };
                this.renderReceiptModal(receipt);
                this.showModal('receiptModal');
            }
        } catch (err) {
            this.showToast('Could not load receipt: ' + err.message, 'error');
        }
    }

    renderReceiptModal(rec) {
        document.getElementById('recNumber').textContent = rec.receiptNumber;
        document.getElementById('recDate').textContent = this.formatDateTime(rec.exitTime || rec.timestamp);
        document.getElementById('recPlate').textContent = rec.vehicleNumber;
        document.getElementById('recType').textContent = `${rec.vehicleType} (${rec.vehicleModel || ''})`;
        document.getElementById('recOwner').textContent = rec.ownerName;
        document.getElementById('recSlot').textContent = rec.slotNumber;
        document.getElementById('recEntry').textContent = this.formatDateTime(rec.entryTime);
        document.getElementById('recExit').textContent = this.formatDateTime(rec.exitTime);
        document.getElementById('recDuration').textContent = rec.durationFormatted;
        document.getElementById('recHours').textContent = `${rec.billableHours} hr(s)`;
        document.getElementById('recRate').textContent = `₹${parseFloat(rec.hourlyRate).toFixed(2)} / hr`;
        document.getElementById('recTotal').textContent = `₹${parseFloat(rec.parkingFee).toFixed(2)}`;
        document.getElementById('recBarcode').textContent = `*${rec.receiptNumber}*`;
    }

    // =====================================================================
    // USER MANAGEMENT CRUD
    // =====================================================================

    openEditUserModal(userId) {
        const user = this.state.users.find(u => u.user_id === userId);
        if (!user) return;

        document.getElementById('userModalTitle').textContent = 'Edit User Details';
        document.getElementById('userIdInput').value = user.user_id;
        document.getElementById('userNameInput').value = user.name;
        document.getElementById('userPhoneInput').value = user.phone;
        document.getElementById('userEmailInput').value = user.email;
        document.getElementById('userRoleInput').value = user.role || 'user';

        this.showModal('userModal');
    }

    async handleUserFormSubmit() {
        const userId = document.getElementById('userIdInput').value;
        const name = document.getElementById('userNameInput').value.trim();
        const phone = document.getElementById('userPhoneInput').value.trim();
        const email = document.getElementById('userEmailInput').value.trim();
        const role = document.getElementById('userRoleInput').value;

        const isEdit = !!userId;
        const url = isEdit ? `/api/users/${userId}` : '/api/users';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await this.api(url, {
                method,
                body: JSON.stringify({ name, phone, email, role })
            });

            this.showToast(res.message, 'success');
            this.closeModal('userModal');
            if (this.page === 'users') {
                await this.loadUsers();
            } else {
                await this.loadDashboardStats();
            }
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    async deleteUser(userId, userName) {
        if (!confirm(`Are you sure you want to delete user "${userName}"? This cannot be undone.`)) {
            return;
        }

        try {
            const res = await this.api(`/api/users/${userId}`, { method: 'DELETE' });
            this.showToast(res.message, 'success');
            await this.loadUsers();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    // =====================================================================
    // VEHICLE MANAGEMENT CRUD
    // =====================================================================

    populateVehicleOwnerSelect(selectedUserId = null) {
        const select = document.getElementById('vehicleOwnerSelect');
        if (!select) return;

        select.innerHTML = '<option value="">-- Select Owner --</option>';
        this.state.users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.user_id;
            opt.textContent = `${u.name} (${u.phone})`;
            select.appendChild(opt);
        });

        if (selectedUserId) select.value = selectedUserId;
    }

    openEditVehicleModal(vehicleId) {
        const vehicle = this.state.vehicles.find(v => v.vehicle_id === vehicleId);
        if (!vehicle) return;

        document.getElementById('vehicleModalTitle').textContent = 'Edit Vehicle Information';
        document.getElementById('vehicleIdInput').value = vehicle.vehicle_id;
        this.populateVehicleOwnerSelect(vehicle.user_id);
        document.getElementById('vehicleNumberInput').value = vehicle.vehicle_number;
        document.getElementById('vehicleTypeSelect').value = vehicle.vehicle_type;
        document.getElementById('vehicleModelInput').value = vehicle.vehicle_model;

        this.showModal('vehicleModal');
    }

    async handleVehicleFormSubmit() {
        const vehicleId = document.getElementById('vehicleIdInput').value;
        const userId = document.getElementById('vehicleOwnerSelect').value;
        const vehicleNumber = document.getElementById('vehicleNumberInput').value.trim();
        const vehicleType = document.getElementById('vehicleTypeSelect').value;
        const vehicleModel = document.getElementById('vehicleModelInput').value.trim();

        const isEdit = !!vehicleId;
        const url = isEdit ? `/api/vehicles/${vehicleId}` : '/api/vehicles';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await this.api(url, {
                method,
                body: JSON.stringify({
                    user_id: parseInt(userId, 10),
                    vehicle_number: vehicleNumber,
                    vehicle_type: vehicleType,
                    vehicle_model: vehicleModel
                })
            });

            this.showToast(res.message, 'success');
            this.closeModal('vehicleModal');
            if (this.page === 'vehicles') {
                await this.loadVehicles();
            } else if (this.page === 'entry') {
                await this.loadVehicles();
                this.prepareEntryView(res.data.vehicle_id);
            }
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    async deleteVehicle(vehicleId, vehicleNumber) {
        if (!confirm(`Are you sure you want to remove vehicle "${vehicleNumber}"?`)) {
            return;
        }

        try {
            const res = await this.api(`/api/vehicles/${vehicleId}`, { method: 'DELETE' });
            this.showToast(res.message, 'success');
            await this.loadVehicles();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    // =====================================================================
    // PARKING SLOT MANAGEMENT CRUD
    // =====================================================================

    openEditSlotModal(slotId) {
        const slot = this.state.slots.find(s => s.slot_id === slotId);
        if (!slot) return;

        document.getElementById('slotModalTitle').textContent = 'Edit Parking Bay';
        document.getElementById('slotIdInput').value = slot.slot_id;
        document.getElementById('slotNumberInput').value = slot.slot_number;
        document.getElementById('slotVehicleTypeSelect').value = slot.vehicle_type;
        document.getElementById('slotLocationInput').value = slot.location;
        document.getElementById('slotStatusSelect').value = slot.status;

        this.showModal('slotModal');
    }

    async handleSlotFormSubmit() {
        const slotId = document.getElementById('slotIdInput').value;
        const slotNumber = document.getElementById('slotNumberInput').value.trim();
        const vehicleType = document.getElementById('slotVehicleTypeSelect').value;
        const location = document.getElementById('slotLocationInput').value.trim();
        const status = document.getElementById('slotStatusSelect').value;

        const isEdit = !!slotId;
        const url = isEdit ? `/api/slots/${slotId}` : '/api/slots';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await this.api(url, {
                method,
                body: JSON.stringify({
                    slot_number: slotNumber,
                    vehicle_type: vehicleType,
                    location,
                    status
                })
            });

            this.showToast(res.message, 'success');
            this.closeModal('slotModal');
            await this.loadSlots();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    async deleteSlot(slotId, slotNumber) {
        if (!confirm(`Are you sure you want to delete parking slot "${slotNumber}"?`)) {
            return;
        }

        try {
            const res = await this.api(`/api/slots/${slotId}`, { method: 'DELETE' });
            this.showToast(res.message, 'success');
            await this.loadSlots();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    // =====================================================================
    // MODAL DIALOG CONTROLLER
    // =====================================================================

    async showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        if (modalId === 'vehicleModal') {
            document.getElementById('vehicleForm').reset();
            document.getElementById('vehicleIdInput').value = '';
            document.getElementById('vehicleModalTitle').textContent = 'Register New Vehicle';
            // Ensure users are loaded for owner select
            if (this.state.users.length === 0) {
                const res = await this.api('/api/users');
                if (res.success) this.state.users = res.data;
            }
            this.populateVehicleOwnerSelect();
        } else if (modalId === 'userModal') {
            document.getElementById('userForm').reset();
            document.getElementById('userIdInput').value = '';
            document.getElementById('userModalTitle').textContent = 'Register New User';
        } else if (modalId === 'slotModal') {
            document.getElementById('slotForm').reset();
            document.getElementById('slotIdInput').value = '';
            document.getElementById('slotModalTitle').textContent = 'Add Parking Slot';
        }

        modal.classList.add('open');
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('open');
    }

    closeAllModals() {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
    }

    // =====================================================================
    // NOTIFICATIONS & HELPERS
    // =====================================================================

    showToast(message, type = 'info', title = null) {
        const container = this.dom.toastContainer;
        if (!container) return;

        const titles = {
            success: 'Success',
            error: 'Action Failed',
            warning: 'Warning',
            info: 'Notice'
        };

        const icons = {
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
            error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>',
            warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>',
            info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                <div class="toast-title">${title || titles[type]}</div>
                <div class="toast-msg">${message}</div>
            </div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-hiding');
            setTimeout(() => toast.remove(), 250);
        }, 4000);
    }

    formatDateTime(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    getVehicleTypeIcon(type) {
        if (type === 'Two-wheeler') {
            return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-3.5L9 12h9.5L16 6h3"/><path d="M12 17.5V14l-3-4"/></svg>`;
        }
        if (type === 'Heavy Vehicle') {
            return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;
        }
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.5a1 1 0 0 0-.8.4L2 11v5h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>`;
    }
}

// Global App Instance
const app = new SharanyaParkingApp();
window.app = app;
