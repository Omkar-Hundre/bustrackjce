import { auth, db } from './config/firebase-config.js';
import { 
    doc, 
    getDoc, 
    updateDoc, 
    onSnapshot,
    collection,
    query,
    where,
    serverTimestamp,
    getDocs
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { driverMapService } from './driverMap.js';

class DriverDashboard {
    constructor() {
        this.isTracking = false;
        this.watchId = null;
        this.tripStartTime = null;
        this.driverId = sessionStorage.getItem('driverId');
        this.driverName = sessionStorage.getItem('driverName');
        this.busId = sessionStorage.getItem('busId');

        // Initialize dashboard when DOM is loaded
        document.addEventListener('DOMContentLoaded', () => this.initialize());
    }

    async initialize() {
        try {
            // Check authentication
            if (!this.driverId || !this.driverName) {
                window.location.href = 'index.html';
                return;
            }

            // Get bus details and check status
            if (this.busId) {
                const busDoc = await getDoc(doc(db, 'buses', this.busId));
                if (busDoc.exists()) {
                    const busData = busDoc.data();
                    // Set driver info with bus name instead of ID
                    document.getElementById('driver-name').textContent = this.driverName;
                    document.getElementById('bus-number').textContent = `Bus: ${busData.name || 'Not Assigned'}`;

                    // Set initial button states based on bus status
                    if (busData.isOnline) {
                        this.isTracking = true;
                        document.getElementById('start-btn').disabled = true;
                        document.getElementById('stop-btn').disabled = false;
                        document.getElementById('toggle-full-btn').disabled = false;
                        
                        // Start location tracking
                        this.watchId = navigator.geolocation.watchPosition(
                            position => this.updateLocation(position),
                            error => this.handleLocationError(error),
                            {
                                enableHighAccuracy: true,
                                maximumAge: 0,
                                timeout: 5000
                            }
                        );

                        // Start timer if we have a last update time
                        if (busData.lastUpdate) {
                            this.tripStartTime = busData.lastUpdate.toDate().getTime();
                            this.updateTimer();
                        }
                    }
                }
            } else {
                document.getElementById('driver-name').textContent = this.driverName;
                document.getElementById('bus-number').textContent = 'Bus: Not Assigned';
            }

            // Show dashboard
            document.getElementById('loading').classList.add('hidden');
            document.querySelector('.driver-container').style.display = 'flex';

            // Initialize map
            await driverMapService.initMap();

            // Initialize event listeners
            this.initializeEventListeners();

            // Start real-time listeners
            if (this.busId) {
                this.startRealtimeListeners();
            }

        } catch (error) {
            console.error('Initialization error:', error);
            this.showNotification('Failed to initialize dashboard', 'error');
        }
    }

    initializeEventListeners() {
        // Control buttons
        document.getElementById('start-btn').addEventListener('click', () => this.startTracking());
        document.getElementById('stop-btn').addEventListener('click', () => this.stopTracking());
        document.getElementById('toggle-full-btn').addEventListener('click', () => this.toggleBusFull());

        // Map controls
        document.getElementById('center-map').addEventListener('click', () => driverMapService.centerMap());
        document.getElementById('refresh-map').addEventListener('click', () => driverMapService.refreshMap());
        document.getElementById('toggle-satellite').addEventListener('click', () => this.toggleMapView());

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            sessionStorage.clear();
            window.location.href = 'index.html';
        });

        // Add window resize handler
        window.addEventListener('resize', () => {
            driverMapService.refreshMap();
        });
    }

    startRealtimeListeners() {
        // Listen for bus updates
        onSnapshot(doc(db, 'buses', this.busId), (doc) => {
            if (doc.exists()) {
                const busData = doc.data();
                this.updateBusStatus(busData);
            }
        });
    }

    async startTracking() {
        if (!this.busId) {
            this.showNotification('No bus assigned', 'error');
            return;
        }

        try {
            if (!navigator.geolocation) {
                throw new Error('Geolocation is not supported by your browser');
            }

            this.isTracking = true;
            this.tripStartTime = Date.now();
            
            // Update UI
            document.getElementById('start-btn').disabled = true;
            document.getElementById('stop-btn').disabled = false;
            document.getElementById('toggle-full-btn').disabled = false;
            
            // Start location tracking
            this.watchId = navigator.geolocation.watchPosition(
                position => this.updateLocation(position),
                error => this.handleLocationError(error),
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 5000
                }
            );

            // Update bus status and store start time
            await updateDoc(doc(db, 'buses', this.busId), {
                isOnline: true,
                lastUpdate: serverTimestamp(),
                tripStartTime: serverTimestamp()
            });

            this.showNotification('Trip started', 'success');
            this.updateTimer();

        } catch (error) {
            console.error('Start tracking error:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async stopTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        this.isTracking = false;
        
        // Update UI
        document.getElementById('start-btn').disabled = false;
        document.getElementById('stop-btn').disabled = true;
        document.getElementById('toggle-full-btn').disabled = true;

        try {
            // Clear the route on map
            driverMapService.clearRoute();

            await updateDoc(doc(db, 'buses', this.busId), {
                isOnline: false,
                lastUpdate: serverTimestamp()
            });
            this.showNotification('Trip ended', 'info');
        } catch (error) {
            console.error('Stop tracking error:', error);
            this.showNotification('Failed to update bus status', 'error');
        }
    }

    async updateLocation(position) {
        try {
            const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                speed: position.coords.speed || 0,
                timestamp: serverTimestamp()
            };

            await updateDoc(doc(db, 'buses', this.busId), {
                location,
                lastUpdate: serverTimestamp()
            });

            // Update map
            driverMapService.updateBusLocation(location);
            
            // Update speed display
            this.updateSpeedometer(location.speed);

        } catch (error) {
            console.error('Location update error:', error);
        }
    }

    updateSpeedometer(speed) {
        const speedKmh = Math.round((speed || 0) * 3.6); // Convert m/s to km/h
        document.getElementById('current-speed').textContent = `${speedKmh} km/h`;
    }

    updateTimer() {
        if (!this.isTracking) return;

        const duration = Date.now() - this.tripStartTime;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);

        document.getElementById('trip-time').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        setTimeout(() => this.updateTimer(), 1000);
    }

    async toggleBusFull() {
        try {
            const busRef = doc(db, 'buses', this.busId);
            const busDoc = await getDoc(busRef);
            const isFull = !busDoc.data().isFull;

            await updateDoc(busRef, { isFull });
            
            const status = isFull ? 'full' : 'available';
            document.getElementById('toggle-full-btn').textContent = 
                `Mark as ${isFull ? 'Available' : 'Full'}`;
            this.showNotification(`Bus marked as ${status}`, 'info');

        } catch (error) {
            console.error('Toggle full status error:', error);
            this.showNotification('Failed to update bus status', 'error');
        }
    }

    toggleMapView() {
        driverMapService.toggleSatelliteView();
    }

    handleLocationError(error) {
        console.error('Location error:', error);
        this.showNotification(`Location error: ${error.message}`, 'error');
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

    updateBusStatus(busData) {
        const statusIndicator = document.getElementById('online-status');
        if (busData.isOnline) {
            statusIndicator.classList.remove('offline');
            statusIndicator.classList.add('online');
            statusIndicator.querySelector('span:last-child').textContent = 'Online';
        } else {
            statusIndicator.classList.remove('online');
            statusIndicator.classList.add('offline');
            statusIndicator.querySelector('span:last-child').textContent = 'Offline';
        }
    }
}

// Initialize dashboard
const driverDashboard = new DriverDashboard(); 

