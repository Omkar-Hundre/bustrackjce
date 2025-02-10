import { auth, db } from './config/firebase-config.js';
import { 
    collection, 
    addDoc, 
    onSnapshot, 
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    getDoc,
    serverTimestamp,
    getDocs,
    arrayUnion,
    setDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { mapService } from './map.js';

class AdminDashboard {
    constructor() {
        this.buses = {};
        this.drivers = {};
        this.activeSection = 'dashboard';
        this.initAuth();
    }

    initAuth() {
        console.log('Initializing auth...');
        
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                console.log('No user found, redirecting to login');
                window.location.href = 'index.html';
                return;
            }

            try {
                const userDoc = await this.getUserData(user.uid);
                console.log('User data:', userDoc);

                if (!userDoc || userDoc.role !== 'admin') {
                    console.log('Not an admin, redirecting');
                    window.location.href = 'index.html';
                    return;
                }

                // User is authenticated and is an admin
                console.log('Admin authenticated, initializing dashboard');
                document.body.style.display = 'block';
                document.getElementById('loading').style.display = 'none';
                document.getElementById('admin-name').textContent = userDoc.name || 'Admin';
                this.initializeDashboard();

            } catch (error) {
                console.error('Auth error:', error);
                window.location.href = 'index.html';
            }
        });
    }

    async initializeDashboard() {
        // Initialize map
        mapService.initMap();
        
        // Initialize event listeners
        this.initializeEventListeners();
        
        // Start real-time listeners
        this.startRealtimeListeners();
        
        // Show dashboard section by default
        this.showSection('dashboard');
        
        // Load drivers for the select dropdown
        await this.loadDriversForSelect();
        
        // Add event listener for add bus modal
        document.getElementById('add-bus-btn').addEventListener('click', () => {
            this.loadDriversForSelect(); // Refresh drivers list when modal opens
            document.getElementById('add-bus-modal').style.display = 'block';
        });
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.add('hidden');
        });
        
        // Show selected section
        document.getElementById(`${sectionName}-section`).classList.remove('hidden');
        
        // Update active nav button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionName);
        });

        // Refresh map if showing dashboard
        if (sectionName === 'dashboard') {
            mapService.refreshMap();
        }
    }

    async getUserData(uid) {
        try {
            const docRef = doc(db, 'users', uid);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? docSnap.data() : null;
        } catch (error) {
            console.error("Error getting user data:", error);
            return null;
        }
    }

    initializeEventListeners() {
        // Logout button
        document.getElementById('logout-btn').addEventListener('click', () => {
            auth.signOut().then(() => {
                window.location.href = '/index.html';
            });
        });

        // Add Bus Modal
        const addBusModalBtn = document.getElementById('add-bus-modal-btn');
        const addBusModal = document.getElementById('add-bus-modal');
        const closeBtns = addBusModal.querySelectorAll('.close-modal');
        const addBusForm = document.getElementById('add-bus-form');

        addBusModalBtn.addEventListener('click', () => {
            addBusModal.classList.add('show');
            document.body.classList.add('modal-open');
        });

        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                addBusModal.classList.remove('show');
                document.body.classList.remove('modal-open');
            });
        });

        // Close modal when clicking outside
        addBusModal.addEventListener('click', (e) => {
            if (e.target === addBusModal) {
                addBusModal.classList.remove('show');
                document.body.classList.remove('modal-open');
            }
        });

        // Driver Modal
        const addDriverBtn = document.getElementById('add-driver-modal-btn');
        const driverModal = document.getElementById('add-driver-modal');
        const driverCloseBtns = driverModal.querySelectorAll('.close-modal');
        const addDriverForm = document.getElementById('add-driver-form');

        addDriverBtn.addEventListener('click', () => {
            driverModal.classList.add('show');
            document.body.classList.add('modal-open');
        });

        driverCloseBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                driverModal.classList.remove('show');
                document.body.classList.remove('modal-open');
            });
        });

        driverModal.addEventListener('click', (e) => {
            if (e.target === driverModal) {
                driverModal.classList.remove('show');
                document.body.classList.remove('modal-open');
            }
        });

        addBusForm.addEventListener('submit', (e) => this.handleAddBus(e));
        addDriverForm.addEventListener('submit', (e) => this.handleAddDriver(e));

        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.showSection(btn.dataset.section);
            });
        });

        // Search functionality
        const searchInput = document.querySelector('.search-box input');
        searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));

        // Map controls
        document.getElementById('center-map').addEventListener('click', () => {
            mapService.centerMap();
        });

        document.getElementById('refresh-map').addEventListener('click', () => {
            mapService.refreshMap();
        });

        // Driver select change handler
        const driverSelect = document.getElementById('driver-select');
        if (driverSelect) {
            driverSelect.addEventListener('change', (e) => {
                const driverId = e.target.value;
                const driverInfoDiv = document.getElementById('selected-driver-info');
                
                if (driverId && this.drivers[driverId]) {
                    const driver = this.drivers[driverId];
                    driverInfoDiv.innerHTML = `
                        <div class="driver-preview">
                            <div class="driver-preview-item">
                                <span class="material-icons">person</span>
                                <span>${driver.name}</span>
                            </div>
                            <div class="driver-preview-item">
                                <span class="material-icons">phone</span>
                                <span>${driver.phone}</span>
                            </div>
                        </div>
                    `;
                } else {
                    driverInfoDiv.innerHTML = '';
                }
            });
        }
    }

    startRealtimeListeners() {
        // Listen for bus updates
        onSnapshot(collection(db, 'buses'), (snapshot) => {
            snapshot.docChanges().forEach(change => {
                const bus = { id: change.doc.id, ...change.doc.data() };
                
                if (change.type === 'added' || change.type === 'modified') {
                    this.buses[bus.id] = bus;
                    this.updateBusInGrid(bus);
                }
                
                if (change.type === 'removed') {
                    // If bus is being removed, clear driver assignment
                    if (this.buses[bus.id]?.driverId) {
                        const driverId = this.buses[bus.id].driverId;
                        updateDoc(doc(db, 'drivers', driverId), {
                            assignedBus: null
                        });
                    }
                    delete this.buses[bus.id];
                    this.removeBusFromGrid(bus.id);
                }
            });
            
            this.updateStats();
            this.updateBusList();
        });

        // Listen for driver updates
        onSnapshot(collection(db, 'drivers'), (snapshot) => {
            snapshot.docChanges().forEach(change => {
                const driver = { id: change.doc.id, ...change.doc.data() };
                
                if (change.type === 'added' || change.type === 'modified') {
                    this.drivers[driver.id] = driver;
                    this.updateDriverInTable(driver);
                    // Update any bus cards that have this driver
                    Object.values(this.buses).forEach(bus => {
                        if (bus.driverId === driver.id) {
                            this.updateBusInGrid(bus);
                        }
                    });
                    // Update the bus list in sidebar
                    this.updateBusList();
                }
                
                if (change.type === 'removed') {
                    delete this.drivers[driver.id];
                    const row = document.getElementById(`driver-${driver.id}`);
                    if (row) row.remove();
                    // Update the bus list in sidebar
                    this.updateBusList();
                }
            });
        });
    }

    updateBusInGrid(bus) {
        const busesGrid = document.querySelector('.buses-grid');
        let busCard = document.getElementById(`bus-card-${bus.id}`);

        if (!busCard) {
            busCard = document.createElement('div');
            busCard.id = `bus-card-${bus.id}`;
            busCard.className = 'bus-card';
            busesGrid.appendChild(busCard);
        }

        // Get driver details if available
        const driver = bus.driverId ? this.drivers[bus.driverId] : null;

        busCard.innerHTML = `
            <div class="bus-card-header">
                <h3 class="bus-card-title">${bus.name}</h3>
                <span class="bus-status ${bus.isOnline ? 'online' : 'offline'}">
                    ${bus.isOnline ? 'Online' : 'Offline'}
                </span>
            </div>
            <div class="bus-info">
                <div class="bus-info-item">
                    <span class="material-icons">person</span>
                    <span>Driver: ${driver ? driver.name : 'Not Assigned'}</span>
                </div>
                <div class="bus-info-item">
                    <span class="material-icons">phone</span>
                    <span>Contact: ${driver ? driver.phone : 'N/A'}</span>
                </div>
                <div class="bus-info-item">
                    <span class="material-icons">speed</span>
                    <span>Speed: ${bus.location?.speed ? Math.round(bus.location.speed * 3.6) + ' km/h' : 'N/A'}</span>
                </div>
                <div class="bus-info-item">
                    <span class="material-icons">airline_seat_recline_normal</span>
                    <span>Status: ${bus.isFull ? 'Full' : 'Available'}</span>
                </div>
            </div>
            <div class="bus-actions">
                <button onclick="adminDashboard.trackBus('${bus.id}')" class="bus-action-btn track-btn">
                    <span class="material-icons">location_on</span>
                    Track
                </button>
                <button onclick="adminDashboard.editBus('${bus.id}')" class="bus-action-btn edit-btn">
                    <span class="material-icons">edit</span>
                    Edit
                </button>
                <button onclick="adminDashboard.deleteBus('${bus.id}')" class="bus-action-btn delete-btn">
                    <span class="material-icons">delete</span>
                    Delete
                </button>
            </div>
        `;

        // Update map marker
        mapService.updateBusMarker(bus);
    }

    removeBusFromGrid(busId) {
        const busCard = document.getElementById(`bus-card-${busId}`);
        if (busCard) {
            busCard.remove();
        }
    }

    updateStats() {
        const totalBuses = Object.keys(this.buses).length;
        const onlineBuses = Object.values(this.buses).filter(bus => bus.isOnline).length;
        
        document.getElementById('total-buses').textContent = totalBuses;
        document.getElementById('online-buses').textContent = onlineBuses;
        document.getElementById('offline-buses').textContent = totalBuses - onlineBuses;
    }

    async handleAddBus(e) {
        e.preventDefault();
        const form = e.target;
        const modal = document.getElementById('add-bus-modal');

        const busData = {
            name: form.querySelector('#bus-name').value,
            driverId: form.querySelector('#driver-select').value || null,
            isOnline: false,
            isFull: false,
            location: null,
            createdAt: serverTimestamp(),
            lastUpdate: serverTimestamp()
        };

        try {
            // Add bus to database
            const busRef = await addDoc(collection(db, 'buses'), busData);

            // If a driver was selected, update their assignedBus field
            if (busData.driverId) {
                await updateDoc(doc(db, 'drivers', busData.driverId), {
                    assignedBus: busRef.id
                });
            }

            form.reset();
            modal.classList.remove('show');
            document.body.classList.remove('modal-open');
            this.showNotification('Bus added successfully');

            // Refresh the drivers dropdown
            await this.loadDriversForSelect();
        } catch (error) {
            console.error('Error adding bus:', error);
            this.showNotification('Failed to add bus', 'error');
        }
    }

    async loadDriversForSelect() {
        const driverSelect = document.getElementById('driver-select');
        if (!driverSelect) return;

        // Clear existing options except the first one
        while (driverSelect.options.length > 1) {
            driverSelect.remove(1);
        }

        try {
            // Get all drivers
            const driversSnapshot = await getDocs(collection(db, 'drivers'));
            
            // Get currently assigned driver IDs from active buses
            const assignedDriverIds = Object.values(this.buses)
                .map(bus => bus.driverId)
                .filter(id => id); // Remove null/undefined values

            driversSnapshot.forEach(doc => {
                const driver = { id: doc.id, ...doc.data() };
                
                // Add driver if they're not assigned to any active bus
                if (!assignedDriverIds.includes(driver.id)) {
                    const option = document.createElement('option');
                    option.value = driver.id;
                    option.textContent = `${driver.name} (${driver.phone})`;
                    driverSelect.appendChild(option);
                }
            });

            // Show/hide driver info preview based on selection
            const driverInfoDiv = document.getElementById('selected-driver-info');
            if (driverSelect.value) {
                driverInfoDiv.style.display = 'block';
            } else {
                driverInfoDiv.style.display = 'none';
            }

        } catch (error) {
            console.error('Error loading drivers:', error);
            this.showNotification('Error loading drivers', 'error');
        }
    }

    handleSearch(query) {
        const searchQuery = query.toLowerCase().trim();
        const busList = document.querySelector('.bus-list');
        busList.innerHTML = ''; // Clear current list

        // Filter and display buses in sidebar
        Object.values(this.buses).forEach(bus => {
            const driver = bus.driverId ? this.drivers[bus.driverId] : null;
            const driverName = driver ? driver.name : '';

            if (bus.name.toLowerCase().includes(searchQuery) || 
                driverName.toLowerCase().includes(searchQuery)) {
                
                const busItem = document.createElement('div');
                busItem.className = 'bus-item';
                busItem.innerHTML = `
                    <div class="online-status ${bus.isOnline ? 'online' : 'offline'}"></div>
                    <div class="bus-item-info">
                        <div class="bus-item-name">${bus.name}</div>
                        <div class="bus-item-driver">${driver ? driver.name : 'No driver assigned'}</div>
                    </div>
                    <div class="bus-item-actions">
                        <button onclick="adminDashboard.trackBus('${bus.id}')" title="Track Bus">
                            <span class="material-icons">location_on</span>
                        </button>
                    </div>
                `;
                busList.appendChild(busItem);
            }
        });

        if (busList.children.length === 0) {
            busList.innerHTML = `
                <div class="no-results">
                    <span class="material-icons">search_off</span>
                    <p>No buses found</p>
                </div>
            `;
        }
    }

    async trackBus(busId) {
        const bus = this.buses[busId];
        if (bus) {
            // Switch to dashboard section
            this.showSection('dashboard');
            // Center map on bus location
            if (bus.location) {
                mapService.focusOnBus(busId);
                this.showNotification('Tracking bus: ' + bus.name);
            } else {
                this.showNotification('Bus location not available', 'warning');
            }
        }
    }

    async deleteBus(busId) {
        if (confirm('Are you sure you want to delete this bus?')) {
            try {
                const bus = this.buses[busId];
                
                // If bus had an assigned driver, update the driver's document first
                if (bus.driverId) {
                    await updateDoc(doc(db, 'drivers', bus.driverId), {
                        assignedBus: null
                    }).then(() => {
                        console.log('Driver assignment cleared');
                    }).catch(error => {
                        console.error('Error clearing driver assignment:', error);
                    });
                }

                // Then delete the bus
                await deleteDoc(doc(db, 'buses', busId));
                
                // Update local data
                if (bus.driverId && this.drivers[bus.driverId]) {
                    this.drivers[bus.driverId].assignedBus = null;
                }
                delete this.buses[busId];
                
                this.showNotification('Bus deleted successfully');
                this.updateBusList(); // Update the sidebar list
                await this.loadDriversForSelect(); // Refresh driver dropdown
            } catch (error) {
                console.error('Error deleting bus:', error);
                this.showNotification('Failed to delete bus', 'error');
            }
        }
    }

    async editBus(busId) {
        const bus = this.buses[busId];
        if (!bus) return;

        // Get current driver if assigned
        const currentDriver = bus.driverId ? this.drivers[bus.driverId] : null;

        // Create edit modal HTML
        const modalHTML = `
            <div class="modal" id="edit-bus-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Edit Bus</h2>
                        <button class="close-modal">
                            <span class="material-icons">close</span>
                        </button>
                    </div>
                    <form id="edit-bus-form">
                        <div class="form-group">
                            <label for="edit-bus-name">Bus Name/Number</label>
                            <input type="text" id="edit-bus-name" value="${bus.name}" required>
                        </div>
                        <div class="form-group">
                            <label for="edit-driver-select">Select Driver</label>
                            <select id="edit-driver-select">
                                <option value="">Select a driver</option>
                                ${currentDriver ? 
                                    `<option value="${currentDriver.id}" selected>${currentDriver.name} (${currentDriver.phone})</option>` 
                                    : ''}
                            </select>
                        </div>
                        <div id="edit-driver-info" class="driver-info-preview">
                            ${currentDriver ? `
                                <div class="driver-preview">
                                    <div class="driver-preview-item">
                                        <span class="material-icons">person</span>
                                        <span>${currentDriver.name}</span>
                                    </div>
                                    <div class="driver-preview-item">
                                        <span class="material-icons">phone</span>
                                        <span>${currentDriver.phone}</span>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="primary-btn">Save Changes</button>
                            <button type="button" class="secondary-btn close-modal">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('edit-bus-modal');
        const form = document.getElementById('edit-bus-form');
        const closeButtons = modal.querySelectorAll('.close-modal');
        const driverSelect = document.getElementById('edit-driver-select');
        const driverInfoDiv = document.getElementById('edit-driver-info');

        // Load available drivers
        try {
            const driversSnapshot = await getDocs(collection(db, 'drivers'));
            
            // Get currently assigned driver IDs from active buses
            const assignedDriverIds = Object.values(this.buses)
                .map(bus => bus.driverId)
                .filter(id => id && id !== bus.driverId); // Exclude current bus's driver

            driversSnapshot.forEach(doc => {
                const driver = { id: doc.id, ...doc.data() };
                
                // Add driver if they're not assigned to any other bus
                if (!assignedDriverIds.includes(driver.id) && driver.id !== bus.driverId) {
                    const option = document.createElement('option');
                    option.value = driver.id;
                    option.textContent = `${driver.name} (${driver.phone})`;
                    driverSelect.appendChild(option);
                }
            });
        } catch (error) {
            console.error('Error loading drivers:', error);
        }

        // Show modal
        modal.classList.add('show');
        document.body.classList.add('modal-open');

        // Handle driver selection change
        driverSelect.addEventListener('change', (e) => {
            const selectedDriverId = e.target.value;
            const selectedDriver = this.drivers[selectedDriverId];
            
            if (selectedDriver) {
                driverInfoDiv.innerHTML = `
                    <div class="driver-preview">
                        <div class="driver-preview-item">
                            <span class="material-icons">person</span>
                            <span>${selectedDriver.name}</span>
                        </div>
                        <div class="driver-preview-item">
                            <span class="material-icons">phone</span>
                            <span>${selectedDriver.phone}</span>
                        </div>
                    </div>
                `;
                driverInfoDiv.style.display = 'block';
            } else {
                driverInfoDiv.innerHTML = '';
                driverInfoDiv.style.display = 'none';
            }
        });

        // Handle close button clicks
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                modal.remove();
                document.body.classList.remove('modal-open');
            });
        });

        // Handle form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newDriverId = driverSelect.value;
            
            try {
                // Update bus data
                await updateDoc(doc(db, 'buses', busId), {
                    name: form.querySelector('#edit-bus-name').value,
                    driverId: newDriverId || null,
                    lastUpdate: serverTimestamp()
                });

                // Update old driver's assignment if exists
                if (bus.driverId && bus.driverId !== newDriverId) {
                    await updateDoc(doc(db, 'drivers', bus.driverId), {
                        assignedBus: null
                    });
                }

                // Update new driver's assignment if selected
                if (newDriverId && newDriverId !== bus.driverId) {
                    await updateDoc(doc(db, 'drivers', newDriverId), {
                        assignedBus: busId
                    });
                }

                modal.remove();
                document.body.classList.remove('modal-open');
                this.showNotification('Bus updated successfully');
            } catch (error) {
                console.error('Error updating bus:', error);
                this.showNotification('Failed to update bus', 'error');
            }
        });
    }

    async handleAddDriver(e) {
        e.preventDefault();
        console.log('Adding new driver...'); // Debug log

        const form = e.target;
        const modal = document.getElementById('add-driver-modal');

        const driverData = {
            name: form.querySelector('#driver-name').value,
            phone: form.querySelector('#driver-phone').value,
            passcode: form.querySelector('#driver-passcode').value,
            role: 'driver',
            assignedBus: null,
            createdAt: serverTimestamp()
        };

        try {
            // Add to drivers collection
            const driverRef = await addDoc(collection(db, 'drivers'), driverData);
            console.log('Driver added with ID:', driverRef.id); // Debug log

            form.reset();
            modal.classList.remove('show');
            document.body.classList.remove('modal-open');
            this.showNotification('Driver added successfully');

        } catch (error) {
            console.error('Error adding driver:', error);
            this.showNotification('Failed to add driver', 'error');
        }
    }

    updateDriverInTable(driver) {
        const tbody = document.getElementById('drivers-table-body');
        let row = document.getElementById(`driver-${driver.id}`);

        if (!row) {
            row = document.createElement('tr');
            row.id = `driver-${driver.id}`;
            tbody.appendChild(row);
        }

        // Find assigned bus name if any
        const assignedBus = Object.values(this.buses).find(bus => bus.driverId === driver.id);
        const busName = assignedBus ? assignedBus.name : 'Not Assigned';

        row.innerHTML = `
            <td>${driver.name}</td>
            <td>${driver.phone}</td>
            <td>${driver.passcode}</td>
            <td>${busName}</td>
            <td class="actions">
                <button onclick="adminDashboard.editDriver('${driver.id}')" class="icon-btn">
                    <span class="material-icons">edit</span>
                </button>
                <button onclick="adminDashboard.deleteDriver('${driver.id}')" class="icon-btn danger">
                    <span class="material-icons">delete</span>
                </button>
            </td>
        `;
    }

    async deleteDriver(driverId) {
        if (confirm('Are you sure you want to delete this driver?')) {
            try {
                // Delete from drivers collection
                await deleteDoc(doc(db, 'drivers', driverId));
                
                // Delete from users collection
                await deleteDoc(doc(db, 'users', driverId));

                this.showNotification('Driver deleted successfully');
            } catch (error) {
                console.error('Error deleting driver:', error);
                this.showNotification('Failed to delete driver', 'error');
            }
        }
    }

    async editDriver(driverId) {
        const driver = this.drivers[driverId];
        if (!driver) return;

        const modalHTML = `
            <div class="modal" id="edit-driver-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Edit Driver</h2>
                        <button class="close-modal">
                            <span class="material-icons">close</span>
                        </button>
                    </div>
                    <form id="edit-driver-form">
                        <div class="form-group">
                            <label for="edit-driver-name">Driver Name</label>
                            <input type="text" id="edit-driver-name" value="${driver.name}" required>
                        </div>
                        <div class="form-group">
                            <label for="edit-driver-phone">Contact Number</label>
                            <input type="tel" id="edit-driver-phone" value="${driver.phone}" required>
                        </div>
                        <div class="form-group">
                            <label for="edit-driver-passcode">Login Passcode</label>
                            <input type="text" id="edit-driver-passcode" 
                                   value="${driver.passcode}" 
                                   required 
                                   pattern="[0-9]{4}" 
                                   maxlength="4">
                            <small class="form-hint">4-digit passcode for driver login</small>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="primary-btn">Save Changes</button>
                            <button type="button" class="secondary-btn close-modal">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('edit-driver-modal');
        const form = document.getElementById('edit-driver-form');
        const closeButtons = modal.querySelectorAll('.close-modal');

        modal.classList.add('show');
        document.body.classList.add('modal-open');

        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                modal.remove();
                document.body.classList.remove('modal-open');
            });
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const updatedData = {
                name: form.querySelector('#edit-driver-name').value,
                phone: form.querySelector('#edit-driver-phone').value,
                passcode: form.querySelector('#edit-driver-passcode').value,
                role: 'driver'
            };

            try {
                // Update in drivers collection
                await updateDoc(doc(db, 'drivers', driverId), updatedData);
                
                // Update in users collection
                await updateDoc(doc(db, 'users', driverId), updatedData);

                modal.remove();
                document.body.classList.remove('modal-open');
                this.showNotification('Driver updated successfully');
            } catch (error) {
                console.error('Error updating driver:', error);
                this.showNotification('Failed to update driver', 'error');
            }
        });
    }

    updateBusList() {
        const busList = document.querySelector('.bus-list');
        busList.innerHTML = ''; // Clear current list

        Object.values(this.buses).forEach(bus => {
            const driver = bus.driverId ? this.drivers[bus.driverId] : null;
            const busItem = document.createElement('div');
            busItem.className = 'bus-item';
            busItem.innerHTML = `
                <div class="online-status ${bus.isOnline ? 'online' : 'offline'}"></div>
                <div class="bus-item-info">
                    <div class="bus-item-name">${bus.name}</div>
                    <div class="bus-item-driver">${driver ? driver.name : 'No driver assigned'}</div>
                </div>
                <div class="bus-item-actions">
                    <button onclick="adminDashboard.trackBus('${bus.id}')" title="Track Bus">
                        <span class="material-icons">location_on</span>
                    </button>
                </div>
            `;
            busList.appendChild(busItem);
        });

        if (busList.children.length === 0) {
            busList.innerHTML = `
                <div class="no-results">
                    <span class="material-icons">directions_bus_filled</span>
                    <p>No buses available</p>
                </div>
            `;
        }
    }

    showNotification(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `notification ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Initialize dashboard and make it globally accessible
const adminDashboard = new AdminDashboard();
window.adminDashboard = adminDashboard; // Make it accessible globally for onclick handlers 
