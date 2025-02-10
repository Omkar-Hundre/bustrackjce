class DriverMapService {
    constructor() {
        this.map = null;
        this.busMarkers = {};
        this.routeLayer = null;
        this.routePoints = [];
        // College coordinates
        this.collegeLocation = { lat: 15.796109, lng: 74.474290 };
        this.defaultZoom = 15;
        this.currentView = 'street';
        this.busIcon = null;
        this.collegeIcon = null;
    }

    async initMap() {
        try {
            // Wait for map container to be ready
            await new Promise(resolve => setTimeout(resolve, 100));

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

            this.satelliteMap = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
                maxZoom: 20,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                attribution: '© Google Maps'
            });

            // Set default layer
            this.streetMap.addTo(this.map);

            // Add controls
            this.addMapControls();

            // Create custom icons
            this.createCustomIcons();

            // Add college marker
            this.addCollegeMarker();

            // Initialize route layer
            this.routeLayer = L.polyline([], {
                color: '#1a73e8',
                weight: 3,
                opacity: 0.8
            }).addTo(this.map);

            // Force map resize
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);

        } catch (error) {
            console.error('Map initialization error:', error);
            throw error;
        }
    }

    createCustomIcons() {
        // College icon
        this.collegeIcon = L.divIcon({
            className: 'custom-marker',
            html: `
                <div class="college-marker">
                    <span class="material-icons">school</span>
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        // Bus icon
        this.busIcon = L.divIcon({
            className: 'custom-marker',
            html: `
                <div class="bus-marker online">
                    <span class="material-icons">directions_bus</span>
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
    }

    addMapControls() {
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

        // Add layer control
        const baseMaps = {
            "Street View": this.streetMap,
            "Satellite View": this.satelliteMap
        };
        L.control.layers(baseMaps, null, {
            position: 'topright'
        }).addTo(this.map);
    }

    addCollegeMarker() {
        L.marker([this.collegeLocation.lat, this.collegeLocation.lng], {
            icon: this.collegeIcon
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

    updateBusLocation(location) {
        // Add point to route
        this.routePoints.push([location.lat, location.lng]);
        
        // Update route line
        this.routeLayer.setLatLngs(this.routePoints);

        // Remove existing bus marker if any
        if (this.busMarkers['driver']) {
            this.map.removeLayer(this.busMarkers['driver']);
        }

        // Create bus marker with popup
        const marker = L.marker([location.lat, location.lng], {
            icon: this.busIcon
        }).bindPopup(`
            <div class="popup-content">
                <h3>Your Bus</h3>
                <div class="popup-info">
                    <div class="popup-info-item">
                        <span class="material-icons">speed</span>
                        <span>${Math.round((location.speed || 0) * 3.6)} km/h</span>
                    </div>
                    <div class="popup-info-item">
                        <span class="material-icons">schedule</span>
                        <span>${new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
            </div>
        `);

        // Add to map and store reference
        marker.addTo(this.map);
        this.busMarkers['driver'] = marker;

        // Center map on bus location with animation
        this.map.panTo([location.lat, location.lng], {
            animate: true,
            duration: 1
        });
    }

    toggleSatelliteView() {
        if (this.currentView === 'street') {
            this.map.removeLayer(this.streetMap);
            this.satelliteMap.addTo(this.map);
            this.currentView = 'satellite';
        } else {
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
        if (this.routePoints.length > 0) {
            const bounds = L.latLngBounds(this.routePoints);
            this.map.fitBounds(bounds, {
                padding: [50, 50]
            });
        }
    }

    clearRoute() {
        this.routePoints = [];
        this.routeLayer.setLatLngs([]);
    }
}

export const driverMapService = new DriverMapService(); 