class MapService {
    constructor() {
        this.map = null;
        this.busMarkers = {};
        // College coordinates
        this.collegeLocation = { lat: 15.796109, lng: 74.474290 }; // Replace with your college coordinates
        this.defaultZoom = 15;
    }

    initMap() {
        // Initialize map centered on college
        this.map = L.map('map', {
            center: [this.collegeLocation.lat, this.collegeLocation.lng],
            zoom: this.defaultZoom,
            zoomControl: false // We'll add zoom control in a custom position
        });

        // Define base maps
        const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        });

        const satelliteMap = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: '© Google Maps'
        });

        // Add base maps
        const baseMaps = {
            "Street View": streetMap,
            "Satellite View": satelliteMap
        };

        // Add layer control
        L.control.layers(baseMaps, null, {
            position: 'topright'
        }).addTo(this.map);

        // Add zoom control
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);

        // Add scale control
        L.control.scale({
            metric: true,
            imperial: false,
            position: 'bottomleft'
        }).addTo(this.map);

        // Set default layer
        streetMap.addTo(this.map);

        // Add college marker
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

        // Create bus icon
        const busIcon = L.divIcon({
            className: 'custom-marker',
            html: `
                <div class="bus-marker ${bus.isOnline ? 'online' : 'offline'}">
                    <span class="material-icons">directions_bus</span>
                    <div class="pulse"></div>
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        // Use bus location if available, otherwise use college location
        const location = bus.location ? 
            { lat: bus.location.lat, lng: bus.location.lng } : 
            this.collegeLocation;

        // Create marker
        const marker = L.marker([location.lat, location.lng], {
            icon: busIcon
        });

        // Add popup
        const driver = window.adminDashboard.drivers[bus.driverId];
        marker.bindPopup(`
            <div class="bus-popup">
                <h3>${bus.name}</h3>
                <div class="bus-info">
                    <p>
                        <span class="material-icons">person</span>
                        Driver: ${driver ? driver.name : 'Not Assigned'}
                    </p>
                    ${driver ? `
                        <p>
                            <span class="material-icons">phone</span>
                            Contact: ${driver.phone}
                        </p>
                    ` : ''}
                    <p>
                        <span class="material-icons">info</span>
                        Status: ${bus.isOnline ? 'Online' : 'Offline'}
                    </p>
                    ${bus.isFull ? `
                        <p class="warning">
                            <span class="material-icons">warning</span>
                            Bus is currently full
                        </p>
                    ` : ''}
                </div>
            </div>
        `);

        // Add to map
        marker.addTo(this.map);
        this.busMarkers[bus.id] = marker;
    }

    refreshMap() {
        // Update all bus markers
        Object.values(window.adminDashboard.buses).forEach(bus => {
            this.updateBusMarker(bus);
        });
    }

    focusOnBus(busId) {
        const marker = this.busMarkers[busId];
        if (marker) {
            this.map.setView(marker.getLatLng(), this.defaultZoom);
            marker.openPopup();
        }
    }

    centerMap() {
        this.map.setView([this.collegeLocation.lat, this.collegeLocation.lng], this.defaultZoom);
    }
}

export const mapService = new MapService(); 
