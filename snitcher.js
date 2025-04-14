// ==UserScript==
// @name         OpenSnitch Pro
// @namespace    https://openguessr.com/
// @version      1.0.2
// @description  Enhanced location finder with timezone and regional information
// @author       Westagger
// @license      GNU GPLv3
// @match        https://openguessr.com/*
// @grant        GM_xmlhttpRequest
// @icon         https://raw.githubusercontent.com/Westagger/OpenSnitch-Pro/refs/heads/main/assets/osp-logo.png
// @supportURL   https://github.com/Westagger/OpenSnitch-Pro/issues
// @downloadURL https://github.com/Westagger/OpenSnitch-Pro/blob/main/snitcher.js
// @updateURL https://update.greasyfork.org/scripts/532833/OpenSnitch%20Pro.user.js
// ==/UserScript==

(function () {
    'use strict';

    let popup = null;
    let lastLocation = null;
    let updateTimeout = null;
    let isMinimized = false;
    let lastUpdateTime = 0;

    function createPopup() {
        if (popup && popup.parentNode) {
            document.body.removeChild(popup);
        }

        popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            color: #ffffff;
            border-radius: 10px;
            z-index: 10000;
            font-family: 'Segoe UI', Arial, sans-serif;
            min-width: 250px;
            max-width: 350px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            border: 1px solid #3d3d3d;
            transition: all 0.3s ease;
        `;

        const titleBar = document.createElement('div');
        titleBar.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 15px;
            background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
            border-bottom: 1px solid #3d3d3d;
            border-radius: 10px 10px 0 0;
        `;

        const titleText = document.createElement('span');
        titleText.textContent = '🌍 OpenSnitch Pro';
        titleText.style.cssText = `
            font-weight: bold;
            font-size: 14px;
            color: #fff;
        `;

        const minimizeBtn = document.createElement('button');
        minimizeBtn.innerHTML = isMinimized ? '+' : '−';
        minimizeBtn.style.cssText = `
            background: none;
            border: none;
            color: #fff;
            font-size: 18px;
            cursor: pointer;
            padding: 0 5px;
            line-height: 20px;
            transition: opacity 0.2s;
        `;
        minimizeBtn.onmouseover = () => minimizeBtn.style.opacity = '0.7';
        minimizeBtn.onmouseout = () => minimizeBtn.style.opacity = '1';
        minimizeBtn.onclick = (e) => {
            e.stopPropagation();
            toggleMinimize();
        };

        titleBar.appendChild(titleText);
        titleBar.appendChild(minimizeBtn);
        popup.appendChild(titleBar);

        const contentContainer = document.createElement('div');
        contentContainer.id = 'opensnitch-content';
        contentContainer.style.cssText = `
            padding: 20px;
            transition: all 0.3s ease;
            ${isMinimized ? 'display: none;' : ''}
        `;
        popup.appendChild(contentContainer);

        document.body.appendChild(popup);
        return contentContainer;
    }

    function toggleMinimize() {
        const content = document.getElementById('opensnitch-content');
        const minimizeBtn = popup.querySelector('button');
        isMinimized = !isMinimized;

        if (isMinimized) {
            content.style.display = 'none';
            minimizeBtn.innerHTML = '+';
        } else {
            content.style.display = 'block';
            minimizeBtn.innerHTML = '−';
        }
    }

    async function getTimeZoneInfo(lat, lng) {
        try {
            const response = await fetch(`https://timeapi.io/api/Time/current/coordinate?latitude=${lat}&longitude=${lng}`);
            const data = await response.json();
            return {
                timeZone: data.timeZone,
                localTime: new Date(data.dateTime).toLocaleString('en-US', {
                    timeZone: data.timeZone,
                    hour12: false
                })
            };
        } catch (error) {
            console.error('[OpenSnitch Pro] Timezone fetch error:', error);
            return {
                timeZone: 'Unable to determine timezone',
                localTime: new Date().toLocaleString('en-US', {hour12: false})
            };
        }
    }

    function createMapsButton(lat, lng) {
        const button = document.createElement('button');
        button.textContent = '📍 Open in Google Maps';
        button.style.cssText = `
            background: #4285f4;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            margin-top: 10px;
            transition: background-color 0.2s;
            width: 100%;
        `;
        button.onmouseover = () => button.style.background = '#5290f5';
        button.onmouseout = () => button.style.background = '#4285f4';
        button.onclick = () => window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
        return button;
    }

    function formatContent(locationDetails, timeZoneInfo, lat, lng) {
        const contentDiv = document.createElement('div');
        contentDiv.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

        const sections = [
            { label: 'Time Zone', value: `${timeZoneInfo.timeZone}\n${timeZoneInfo.localTime}` },
            { label: 'Country', value: locationDetails.country },
            { label: 'Region', value: locationDetails.location },
            { label: 'State', value: locationDetails.state },
            { label: 'City', value: locationDetails.city }
        ];

        sections.forEach(section => {
            if (section.value) {
                const sectionDiv = document.createElement('div');
                sectionDiv.style.cssText = 'display: flex; flex-direction: column;';

                const label = document.createElement('span');
                label.style.cssText = 'color: #888; font-size: 12px; margin-bottom: 2px;';
                label.textContent = section.label;

                const value = document.createElement('span');
                value.style.cssText = 'color: #fff; font-size: 14px; white-space: pre-line;';
                value.textContent = section.value;

                sectionDiv.appendChild(label);
                sectionDiv.appendChild(value);
                contentDiv.appendChild(sectionDiv);
            }
        });

        contentDiv.appendChild(createMapsButton(lat, lng));
        return contentDiv;
    }

    function getCountryBounds(country) { // More accurate bounds for big ass countries
        const bounds = {
            'United States': { north: 49, south: 25, east: -66.93, west: -124.78 },
            'Russia': { north: 81.85, south: 41.18, east: 190.32, west: 19.25 },
            'Canada': { north: 83.11, south: 41.67, east: -52.62, west: -141.00 },
            'Brazil': { north: 5.27, south: -33.75, east: -34.79, west: -73.99 },
            'China': { north: 53.55, south: 18.15, east: 134.77, west: 73.55 },
            'Australia': { north: -10.06, south: -43.64, east: 153.61, west: 113.16 },
            'India': { north: 35.51, south: 6.75, east: 97.40, west: 68.10 },
            'Argentina': { north: -21.78, south: -55.06, east: -53.65, west: -73.56 },
            'Mexico': { north: 32.72, south: 14.53, east: -86.70, west: -118.40 },
            'Indonesia': { north: 5.90, south: -10.95, east: 141.02, west: 95.29 },
            'South Africa': { north: -22.13, south: -34.84, east: 32.89, west: 16.47 },
            'Ukraine': { north: 52.37, south: 44.39, east: 40.22, west: 22.13 },
            'France': { north: 51.09, south: 41.36, east: 9.56, west: -5.14 },
            'Germany': { north: 55.06, south: 47.27, east: 15.04, west: 5.87 },
            'Japan': { north: 45.52, south: 24.25, east: 145.82, west: 122.94 },
            'Spain': { north: 43.79, south: 36.00, east: 4.33, west: -9.30 },
            'Sweden': { north: 69.06, south: 55.34, east: 24.16, west: 11.11 },
            'Norway': { north: 71.18, south: 57.97, east: 31.17, west: 4.65 },
            'Finland': { north: 70.09, south: 59.81, east: 31.59, west: 20.55 },
            'Poland': { north: 54.84, south: 49.00, east: 24.15, west: 14.12 },
            'Italy': { north: 47.09, south: 36.65, east: 18.52, west: 6.63 },
            'United Kingdom': { north: 58.67, south: 49.96, east: 1.76, west: -8.65 },
            'Turkey': { north: 42.14, south: 35.82, east: 44.83, west: 25.66 },
            'Thailand': { north: 20.46, south: 5.61, east: 105.64, west: 97.34 },
            'Vietnam': { north: 23.39, south: 8.56, east: 109.47, west: 102.14 },
            'New Zealand': { north: -34.39, south: -47.29, east: 178.56, west: 166.42 },
            'South Korea': { north: 38.61, south: 33.11, east: 131.87, west: 125.07 },
            'Malaysia': { north: 7.36, south: 0.85, east: 119.27, west: 99.64 },
            'Philippines': { north: 21.12, south: 4.58, east: 126.60, west: 116.93 },
            'Chile': { north: -17.50, south: -55.98, east: -66.42, west: -75.64 },
            'Peru': { north: -0.03, south: -18.35, east: -68.68, west: -81.33 },
            'Colombia': { north: 13.38, south: -4.23, east: -66.87, west: -81.73 },
            'Greece': { north: 41.75, south: 34.80, east: 28.24, west: 19.37 },
            'Romania': { north: 48.27, south: 43.62, east: 29.67, west: 20.26 },
            'Portugal': { north: 42.15, south: 36.96, east: -6.19, west: -9.50 },
            'Netherlands': { north: 53.51, south: 50.75, east: 7.22, west: 3.36 },
            'Belgium': { north: 51.50, south: 49.49, east: 6.40, west: 2.54 },
            'Switzerland': { north: 47.81, south: 45.82, east: 10.49, west: 5.96 },
            'Austria': { north: 49.02, south: 46.37, east: 17.16, west: 9.53 },
            'Czech Republic': { north: 51.06, south: 48.55, east: 18.86, west: 12.09 },
            'Denmark': { north: 57.75, south: 54.56, east: 15.19, west: 8.07 },
            'Hungary': { north: 48.59, south: 45.74, east: 22.90, west: 16.11 },
            'Ireland': { north: 55.39, south: 51.42, east: -6.00, west: -10.48 },
            'Slovakia': { north: 49.61, south: 47.73, east: 22.57, west: 16.84 },
            'Bulgaria': { north: 44.22, south: 41.23, east: 28.61, west: 22.36 },
            'Croatia': { north: 46.55, south: 42.39, east: 19.45, west: 13.49 },
            'Estonia': { north: 59.68, south: 57.52, east: 28.21, west: 21.76 },
            'Latvia': { north: 58.08, south: 55.67, east: 28.24, west: 20.97 },
            'Lithuania': { north: 56.45, south: 53.89, east: 26.87, west: 20.93 },
            'Slovenia': { north: 46.87, south: 45.42, east: 16.61, west: 13.38 },
            'Taiwan': { north: 25.30, south: 21.90, east: 122.00, west: 120.00 },
            'Israel': { north: 33.34, south: 29.49, east: 35.90, west: 34.27 },
            'Egypt': { north: 31.67, south: 22.00, east: 36.90, west: 24.70 },
            'Morocco': { north: 35.92, south: 27.66, east: -1.12, west: -13.17 },
            'Tunisia': { north: 37.35, south: 30.23, east: 11.60, west: 7.52 },
            'Kenya': { north: 5.02, south: -4.72, east: 41.91, west: 33.91 },
            'Nigeria': { north: 13.89, south: 4.27, east: 14.68, west: 2.67 },
            'Ghana': { north: 11.17, south: 4.74, east: 1.19, west: -3.26 },
            'Botswana': { north: -17.78, south: -26.91, east: 29.38, west: 20.00 },
            'Uruguay': { north: -30.08, south: -34.98, east: -53.07, west: -58.44 },
            'Paraguay': { north: -19.29, south: -27.61, east: -54.25, west: -62.65 },
            'Bolivia': { north: -9.68, south: -22.90, east: -57.45, west: -69.65 },
            'Ecuador': { north: 1.44, south: -5.00, east: -75.19, west: -81.01 },
            'Cambodia': { north: 14.69, south: 10.41, east: 107.64, west: 102.33 },
            'Laos': { north: 22.50, south: 13.91, east: 107.70, west: 100.09 },
            'Mongolia': { north: 52.15, south: 41.56, east: 119.94, west: 87.73 },
            'Sri Lanka': { north: 9.83, south: 5.92, east: 81.88, west: 79.65 },
            'Bangladesh': { north: 26.63, south: 20.74, east: 92.67, west: 88.03 },
            'Nepal': { north: 30.45, south: 26.36, east: 88.20, west: 80.06 },
            'Myanmar': { north: 28.54, south: 9.78, east: 101.17, west: 92.19 }
        };
        return bounds[country] || null;
    }

    function determineLocation(lat, lng, address) {
        const countryBounds = getCountryBounds(address.country);
        if (!countryBounds) return 'Location data unavailable';

        let parts = [];

        const latPosition = (lat - countryBounds.south) / (countryBounds.north - countryBounds.south);
        if (latPosition < 0.33) parts.push('Southern');
        else if (latPosition > 0.66) parts.push('Northern');
        else parts.push('Central');

        const lngPosition = (lng - countryBounds.west) / (countryBounds.east - countryBounds.west);
        if (lngPosition < 0.33) parts.push('Western');
        else if (lngPosition > 0.66) parts.push('Eastern');
        else parts.push('Central');

        return `${parts.join(' ')} region`;
    }

    function checkForLocationChanges() {
        const iframe = document.querySelector('#PanoramaIframe');
        if (!iframe) return;

        const src = iframe.getAttribute('src');
        if (!src) return;

        try {
            const url = new URL(src);
            const newLocation = url.searchParams.get('location');
            const currentTime = Date.now();

            if (newLocation && newLocation !== lastLocation && currentTime - lastUpdateTime > 100) {
                console.log('[OpenSnitch Pro] Location change detected:', newLocation);
                lastUpdateTime = currentTime;
                showLocationInfo();
            }
        } catch (error) {
            console.error('[OpenSnitch Pro] Error checking location:', error);
        }
    }

    async function getLocationDetails(lat, lng) {
        return new Promise((resolve) => {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

            fetch(url)
                .then(response => response.json())
                .then(data => {
                    const address = data.address;
                    const locationInfo = {
                        country: address.country || 'Unknown Country',
                        state: address.state || address.region || '',
                        city: address.city || address.town || address.village || address.suburb || 'Unknown City',
                        location: determineLocation(lat, lng, address)
                    };
                    resolve(locationInfo);
                })
                .catch((error) => {
                    console.error('[OpenSnitch Pro] Location fetch error:', error);
                    resolve({
                        country: 'Error fetching location',
                        state: '',
                        city: 'Try again later',
                        location: ''
                    });
                });
        });
    }

    async function showLocationInfo() {
        if (updateTimeout) {
            clearTimeout(updateTimeout);
            updateTimeout = null;
        }

        let iframe = document.querySelector('#PanoramaIframe');
        if (!iframe) {
            createPopup().textContent = 'Waiting for map to load...';
            return;
        }

        try {
            let location;
            const currentUrl = new URL(window.location.href);
            location = currentUrl.searchParams.get('locationSearch') ||
                      currentUrl.searchParams.get('location');

            if (!location) {
                const src = iframe.getAttribute('src');
                if (src) {
                    const url = new URL(src);
                    location = url.searchParams.get('location');
                }
            }

            if (!location || location === lastLocation) {
                return;
            }

            console.log('[OpenSnitch Pro] Processing new location:', location);
            lastLocation = location;
            const [lat, lng] = location.split(',').map(Number);
            const [locationDetails, timeZoneInfo] = await Promise.all([
                getLocationDetails(lat, lng),
                getTimeZoneInfo(lat, lng)
            ]);

            const popupContent = createPopup();
            const contentDiv = formatContent(locationDetails, timeZoneInfo, lat, lng);
            popupContent.appendChild(contentDiv);

        } catch (error) {
            console.error('[OpenSnitch Pro] Error:', error);
            createPopup().textContent = 'Error processing location';
        }
    }

    function initialize() {
        console.log('[OpenSnitch Pro] Initializing...');
        showLocationInfo();

        // Primary location check interval
        setInterval(checkForLocationChanges, 25);

        // Mutation observer for DOM changes
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'src' ||
                    mutation.target.id === 'PanoramaIframe') {
                    checkForLocationChanges();
                }
            }
        });

        observer.observe(document.body, {
            subtree: true,
            attributes: true,
            attributeFilter: ['src'],
            childList: true
        });

        // Fallback refresh mechanism
        setInterval(() => {
            const currentTime = Date.now();
            if (currentTime - lastUpdateTime > 5000) {
                checkForLocationChanges();
            }
        }, 1000);

        console.log('[OpenSnitch Pro] Initialization complete');
    }

    initialize();
})();