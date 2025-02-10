import { db } from './config/firebase-config.js';
import { 
    collection, 
    query, 
    onSnapshot, 
    doc, 
    getDoc 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

class StudentDashboard {
    constructor() {
        this.map = null;
        this.busMarkers = {};
        this.selectedBusId = null;
        this.currentFilter = 'all';
        // College coordinates
        this.collegeLocation = { lat: 15.796109, lng: 74.474290 };
        this.defaultZoom = 15;
        this.currentView = 'street';

        // Add buses storage
        this.buses = new Map(); // Store all buses

        // Initialize dashboard when DOM is loaded
        document.addEventListener('DOMContentLoaded', () => this.initialize());
    }

    async initialize() {
        try {
            // Initialize map
            await this.initMap();

            // Initialize event listeners
            this.initializeEventListeners();

            // Start real-time bus tracking
            this.startBusTracking();

            // Hide loading screen
            document.getElementById('loading').style.display = 'none';

        } catch (error) {
            console.error('Initialization error:', error);
            this.showNotification('Failed to initialize dashboard', 'error');
        }
    }

    async initMap() {
        // Initialize map centered on college
        this.map = L.map('map', {
            center: [this.collegeLocation.lat, this.collegeLocation.lng],
            zoom: this.defaultZoom,
            zoomControl: false,
            attributionControl: true
        });

        // Define base maps
        this.streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        });

        // Satellite map layer
        this.satelliteMap = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: '© Google Maps'
        });

        // Add layer controls
        const baseMaps = {
            "Street View": this.streetMap,
            "Satellite View": this.satelliteMap
        };
        L.control.layers(baseMaps, null, {
            position: 'topright'
        }).addTo(this.map);

        // Set default layer
        this.streetMap.addTo(this.map);

        // Add college marker
        this.addCollegeMarker();
    }

    initializeEventListeners() {
        // Map controls
        document.getElementById('center-map').addEventListener('click', () => this.centerMap());
        document.getElementById('refresh-map').addEventListener('click', () => this.refreshMap());
        document.getElementById('toggle-satellite').addEventListener('click', () => this.toggleMapView());
        document.getElementById('refresh-dashboard').addEventListener('click', () => this.refreshDashboard());

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentFilter = e.target.dataset.filter;
                this.updateFilterButtons();
                this.filterBuses();
            });
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.map.invalidateSize();
        });
    }

    startBusTracking() {
        // Listen for bus updates
        const busesQuery = query(collection(db, 'buses'));
        onSnapshot(busesQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const bus = { id: change.doc.id, ...change.doc.data() };
                
                if (change.type === 'removed') {
                    this.buses.delete(bus.id);
                    this.removeBusMarker(bus.id);
                    this.removeBusFromList(bus.id);
                } else {
                    this.buses.set(bus.id, bus);
                    this.updateBusMarker(bus);
                    this.updateBusList(bus);
                    
                    // Update bus info panel if this is the selected bus
                    if (this.selectedBusId === bus.id) {
                        this.updateBusInfo(bus);
                    }
                }
            });
            // Update filter after changes
            this.filterBuses();
        });
    }

    addCollegeMarker() {
        const collegeIcon = L.divIcon({
            className: 'custom-marker',
            html: `
                <div class="college-marker">
                    <span class="material-icons">school</span>
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        L.marker([this.collegeLocation.lat, this.collegeLocation.lng], {
            icon: collegeIcon
        }).addTo(this.map)
        .bindPopup(`
            <div class="popup-content">
                <h3>KLE College</h3>
                <div class="popup-info">
                    <div class="popup-info-item">
                        <span class="material-icons">location_on</span>
                        <span>Main Campus</span>
                    </div>
                </div>
            </div>
        `);
    }

    updateBusMarker(bus) {
        // Remove existing marker if any
        if (this.busMarkers[bus.id]) {
            this.map.removeLayer(this.busMarkers[bus.id]);
        }

        if (bus.location) {
            const busIcon = L.divIcon({
                className: 'custom-marker',
                html: `
                    <div class="bus-marker ${bus.isOnline ? 'online' : 'offline'}">
                        <span class="material-icons">directions_bus</span>
                    </div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            const marker = L.marker([bus.location.lat, bus.location.lng], {
                icon: busIcon
            }).bindPopup(this.createBusPopup(bus));

            marker.addTo(this.map);
            this.busMarkers[bus.id] = marker;
        }
    }

    updateBusList(bus) {
        // Update bus in storage
        this.buses.set(bus.id, bus);
        // Reapply filter
        this.filterBuses();
    }

    createBusCard(bus) {
        return `
            <div class="bus-header">
                <span class="bus-name">${bus.name}</span>
                <span class="bus-status ${bus.isOnline ? 'online' : 'offline'}">
                    ${bus.isOnline ? 'Online' : 'Offline'}
                </span>
            </div>
            <div class="bus-details">
                ${bus.isOnline ? `
                    <div class="bus-info-row">
                        <span class="material-icons">schedule</span>
                        <span>Last Update: ${new Date(bus.lastUpdate?.toDate()).toLocaleTimeString()}</span>
                    </div>
                    ${bus.isFull ? `
                        <div class="bus-full">
                            Bus is Full
                        </div>
                    ` : ''}
                ` : `
                    <div class="bus-info-row text-warning">
                        <span class="material-icons">info</span>
                        <span>Bus is currently offline</span>
                    </div>
                `}
            </div>
        `;
    }

    createBusPopup(bus) {
        return `
            <div class="popup-content">
                <h3>${bus.name}</h3>
                <div class="popup-info">
                    <div class="popup-info-item">
                        <span class="material-icons">schedule</span>
                        <span>Last Update: ${new Date(bus.lastUpdate?.toDate()).toLocaleTimeString()}</span>
                    </div>
                    <div class="popup-info-item">
                        <span class="material-icons">airline_seat_recline_normal</span>
                        <span>${bus.isFull ? 'Bus is Full' : 'Seats Available'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    selectBus(bus) {
        // Update selected state
        this.selectedBusId = bus.id;
        
        // Update UI
        document.querySelectorAll('.bus-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        const selectedCard = document.getElementById(`bus-${bus.id}`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }

        // Update info panel
        this.updateBusInfo(bus);

        // Center map on bus if location available
        if (bus.location) {
            this.map.setView([bus.location.lat, bus.location.lng], this.defaultZoom);
            if (this.busMarkers[bus.id]) {
                this.busMarkers[bus.id].openPopup();
            }
        }
    }

    async updateBusInfo(bus) {
        const busInfo = document.getElementById('bus-info');
        
        // Get driver information if available
        let driverInfo = `
            <div class="info-section">
                <h4>Driver Details</h4>
                <div class="info-item text-warning">
                    <span class="material-icons">person_off</span>
                    <span>No driver assigned</span>
                </div>
            </div>
        `;

        if (bus.driverId) {
            try {
                // Get driver document from Firestore
                const driverRef = doc(db, 'drivers', bus.driverId);
                const driverSnap = await getDoc(driverRef);
                
                if (driverSnap.exists()) {
                    const driverData = driverSnap.data();
                    // Check if driver data exists and has required fields
                    if (driverData) {
                        driverInfo = `
                            <div class="info-section">
                                <h4>Driver Details</h4>
                                <div class="info-item">
                                    <span class="material-icons">person</span>
                                    <span>${driverData.name || 'Name not available'}</span>
                                </div>
                                <div class="info-item">
                                    <span class="material-icons">phone</span>
                                    <span>${driverData.phone || 'Phone not available'}</span>
                                </div>
                                ${driverData.email ? `
                                    <div class="info-item">
                                        <span class="material-icons">email</span>
                                        <span>${driverData.email}</span>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                        console.log('Driver data fetched:', driverData); // Debug log
                    } else {
                        throw new Error('Driver data is empty');
                    }
                } else {
                    driverInfo = `
                        <div class="info-section">
                            <h4>Driver Details</h4>
                            <div class="info-item text-warning">
                                <span class="material-icons">error</span>
                                <span>Driver information not found in database</span>
                            </div>
                        </div>
                    `;
                    console.warn('Driver document not found:', bus.driverId);
                }
            } catch (error) {
                console.error('Error fetching driver info:', error);
                driverInfo = `
                    <div class="info-section">
                        <h4>Driver Details</h4>
                        <div class="info-item text-warning">
                            <span class="material-icons">error</span>
                            <span>Error loading driver information: ${error.message}</span>
                        </div>
                    </div>
                `;
            }
        }

        // Update the bus status section to handle offline state
        busInfo.innerHTML = `
            <div class="info-content">
                <div class="info-header">
                    <h3>${bus.name}</h3>
                    <span class="status-badge ${bus.isOnline ? 'online' : 'offline'}">
                        <span class="material-icons">circle</span>
                        ${bus.isOnline ? 'Online' : 'Offline'}
                    </span>
                </div>

                <div class="info-section">
                    <h4>Bus Status</h4>
                    ${bus.isOnline ? `
                        <div class="info-item">
                            <span class="material-icons">schedule</span>
                            <span>Last Update: ${new Date(bus.lastUpdate?.toDate()).toLocaleTimeString()}</span>
                        </div>
                        <div class="info-item">
                            <span class="material-icons">airline_seat_recline_normal</span>
                            <span>${bus.isFull ? 'Bus is Full' : 'Seats Available'}</span>
                        </div>
                        ${bus.location ? `
                            <div class="info-item">
                                <span class="material-icons">speed</span>
                                <span>${Math.round((bus.location.speed || 0) * 3.6)} km/h</span>
                            </div>
                            <div class="info-item">
                                <span class="material-icons">location_on</span>
                                <span>Live Location Available</span>
                            </div>
                        ` : `
                            <div class="info-item text-warning">
                                <span class="material-icons">location_off</span>
                                <span>Location not available</span>
                            </div>
                        `}
                    ` : `
                        <div class="info-item text-warning">
                            <span class="material-icons">info</span>
                            <span>Bus is currently offline</span>
                        </div>
                    `}
                </div>

                ${bus.isOnline ? driverInfo : `
                    <div class="info-section">
                        <h4>Driver Details</h4>
                        <div class="info-item text-warning">
                            <span class="material-icons">person_off</span>
                            <span>Driver information not available when bus is offline</span>
                        </div>
                    </div>
                `}

                ${bus.isOnline && bus.route ? `
                    <div class="info-section">
                        <h4>Route Information</h4>
                        <div class="info-item">
                            <span class="material-icons">route</span>
                            <span>${bus.route}</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    shouldShowBus(bus) {
        switch (this.currentFilter) {
            case 'online':
                return bus.isOnline;
            case 'offline':
                return !bus.isOnline;
            default:
                return true;
        }
    }

    updateFilterButtons() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === this.currentFilter);
        });
        // Reapply filter when buttons update
        this.filterBuses();
    }

    filterBuses() {
        // Clear existing list
        const busList = document.getElementById('bus-list');
        busList.innerHTML = '';

        // Sort buses by status (online first) and name
        const sortedBuses = Array.from(this.buses.values()).sort((a, b) => {
            if (a.isOnline !== b.isOnline) {
                return b.isOnline ? 1 : -1; // Online buses first
            }
            return a.name.localeCompare(b.name); // Then alphabetically
        });

        // Filter and add buses
        sortedBuses.forEach(bus => {
            if (this.shouldShowBus(bus)) {
                const busElement = document.createElement('div');
                busElement.id = `bus-${bus.id}`;
                busElement.className = `bus-card ${this.selectedBusId === bus.id ? 'selected' : ''}`;
                busElement.innerHTML = this.createBusCard(bus);
                busElement.onclick = () => this.selectBus(bus);
                busList.appendChild(busElement);
            }
        });

        // Show message if no buses match filter
        if (busList.children.length === 0) {
            busList.innerHTML = `
                <div class="no-buses">
                    <span class="material-icons">info</span>
                    <p>No buses ${this.currentFilter !== 'all' ? `${this.currentFilter} ` : ''}available</p>
                </div>
            `;
        }
    }

    removeBusMarker(busId) {
        if (this.busMarkers[busId]) {
            this.map.removeLayer(this.busMarkers[busId]);
            delete this.busMarkers[busId];
        }
    }

    removeBusFromList(busId) {
        const busElement = document.getElementById(`bus-${busId}`);
        if (busElement) {
            busElement.remove();
        }
    }

    toggleMapView() {
        console.log('Toggling map view');
        if (this.currentView === 'street') {
            console.log('Switching to satellite view');
            this.map.removeLayer(this.streetMap);
            this.satelliteMap.addTo(this.map);
            this.currentView = 'satellite';
        } else {
            console.log('Switching to street view');
            this.map.removeLayer(this.satelliteMap);
            this.streetMap.addTo(this.map);
            this.currentView = 'street';
        }
    }

    centerMap() {
        this.map.setView([this.collegeLocation.lat, this.collegeLocation.lng], this.defaultZoom);
    }

    refreshMap() {
        this.map.invalidateSize();
    }

    refreshDashboard() {
        location.reload();
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const messageEl = document.getElementById('notification-message');
        
        messageEl.textContent = message;
        notification.className = `notification-toast show ${type}`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// Initialize dashboard
const studentDashboard = new StudentDashboard(); 
