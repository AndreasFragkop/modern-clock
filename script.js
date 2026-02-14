// Modern Clock — main client script
// This file wires up the DOM, handles user settings, runs the animation loop,
// renders analog/digital time, draws time-related rings, and updates panels.

// -------------------------------
// DOM references for the clock face and readouts
// -------------------------------
const clock = document.getElementById('clock');
const hourHand = document.getElementById('hourHand');
const minuteHand = document.getElementById('minuteHand');
const secondHand = document.getElementById('secondHand');
const digitalTime = document.getElementById('digitalTime');
const dateDisplay = document.getElementById('dateDisplay');
const timeLiveRegion = document.getElementById('timeLiveRegion');

// -------------------------------
// Settings controls (UI inputs)
// -------------------------------
const formatToggle = document.getElementById('formatToggle');
const smoothToggle = document.getElementById('smoothToggle');
const timezoneSelect = document.getElementById('timezoneSelect');
const themeSelect = document.getElementById('themeSelect');
const chimeToggle = document.getElementById('chimeToggle');
const ambientToggle = document.getElementById('ambientToggle');
const focusToggle = document.getElementById('focusToggle');
const focusExit = document.getElementById('focusExit');

// -------------------------------
// Panels for world time and calendar
// -------------------------------
const timezoneGrid = document.getElementById('timezoneGrid');
const timezonePanel = document.getElementById('timezonePanel');

const calendarPanel = document.getElementById('calendarPanel');
const calendarTitle = document.getElementById('calendarTitle');
const calendarGrid = document.getElementById('calendarGrid');
const calendarPrev = document.getElementById('calendarPrev');
const calendarNext = document.getElementById('calendarNext');

// -------------------------------
// Decorative rings around the clock face
// -------------------------------
const sunArc = document.getElementById('sunArc');
const sunIndicator = document.getElementById('sunIndicator');
const secondsRing = document.getElementById('secondsRing');

// -------------------------------
// Clock number layout (only 12, 3, 6, 9 for a minimalist dial)
// Each entry stores the label text and its angle on the circle.
// -------------------------------
const numbers = [
    { num: 12, angle: 0 },
    { num: 3, angle: 90 },
    { num: 6, angle: 180 },
    { num: 9, angle: 270 }
];

// -------------------------------
// Persistent settings state (saved to localStorage)
// These values are the source of truth for UI + rendering.
// -------------------------------
const settings = {
    is24Hour: true,
    smoothSecond: true,
    timezone: 'local',
    theme: 'aurora',
    chime: false,
    ambient: false,
    focusMode: false
};

// -------------------------------
// Cached formatter + runtime state
// -------------------------------
let timeFormatter = null;       // Intl.DateTimeFormat for time display
let dateFormatter = null;       // Intl.DateTimeFormat for date display
let lastTickKey = '';           // Used to skip frames when smooth seconds disabled
let lastChimeMinute = null;     // Prevents repeated chimes inside the same minute
let calendarMonthOffset = 0;    // Offset from the current month for calendar navigation
let sunriseData = null;         // { sunrise, sunset } or null when unavailable
let sunriseDateKey = '';        // Date string to refresh sunrise data daily
let ambientPhase = 0;           // Phase used for ambient hue animation
let audioContext = null;        // Web Audio context for chime
let masterGain = null;          // Master gain node for chime volume

// -------------------------------
// Accessibility: reduce motion for users who prefer less animation
// If enabled, we force step-based seconds.
// -------------------------------
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReducedMotion) {
    smoothToggle.checked = false;
    settings.smoothSecond = false;
}

// -------------------------------
// Load stored settings (if any) and merge into defaults
// -------------------------------
const storedSettings = JSON.parse(localStorage.getItem('modernClockSettings') || '{}');
Object.assign(settings, storedSettings);

// -------------------------------
// Sync UI controls with stored settings
// -------------------------------
formatToggle.checked = settings.is24Hour;
smoothToggle.checked = settings.smoothSecond;
timezoneSelect.value = settings.timezone;
themeSelect.value = settings.theme;
chimeToggle.checked = settings.chime;
ambientToggle.checked = settings.ambient;

// -------------------------------
// Resolve timezone option for Intl formatting
// Return undefined to use local browser timezone.
// -------------------------------
function getTimeZoneOption() {
    return settings.timezone === 'utc' ? 'UTC' : undefined;
}

// -------------------------------
// Build or refresh the Intl formatters when settings change
// -------------------------------
function updateFormatters() {
    const timeZone = getTimeZoneOption();
    timeFormatter = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: !settings.is24Hour,
        timeZone
    });

    dateFormatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone
    });
}

// -------------------------------
// Remove any existing markers (used on resize)
// -------------------------------
function clearMarkers() {
    const markers = clock.querySelectorAll('.marker, .number');
    markers.forEach(marker => marker.remove());
}

// -------------------------------
// Build the 60 markers and the 4 numeric labels
// -------------------------------
function buildMarkers() {
    clearMarkers();

    // Size is dynamic to support responsive resizing
    const rect = clock.getBoundingClientRect();
    const size = rect.width;
    const center = size / 2;
    const markerRadius = size * 0.47;
    const numberRadius = size * 0.4;
    const sunRadius = size * 0.41;

    // Store sun radius as a CSS custom property for the indicator position
    clock.style.setProperty('--sun-radius', `${sunRadius}px`);

    // Minute/second markers around the dial
    for (let i = 0; i < 60; i++) {
        const marker = document.createElement('div');
        marker.className = i % 5 === 0 ? 'marker major' : 'marker';
        const angle = i * 6; // 360 degrees / 60 markers
        marker.style.transform = `translate(-50%, -${markerRadius}px) rotate(${angle}deg)`;
        clock.appendChild(marker);
    }

    // Numeric labels placed manually for a clean look
    numbers.forEach(item => {
        const numberDiv = document.createElement('div');
        numberDiv.className = 'number';
        numberDiv.textContent = item.num;

        const angleRad = (item.angle - 90) * (Math.PI / 180);
        const x = center + numberRadius * Math.cos(angleRad);
        const y = center + numberRadius * Math.sin(angleRad);

        numberDiv.style.left = `${x}px`;
        numberDiv.style.top = `${y}px`;

        clock.appendChild(numberDiv);
    });
}

// -------------------------------
// Return time parts in the currently selected timezone
// -------------------------------
function getTimeParts(now) {
    if (settings.timezone === 'utc') {
        return {
            hours: now.getUTCHours(),
            minutes: now.getUTCMinutes(),
            seconds: now.getUTCSeconds(),
            milliseconds: now.getUTCMilliseconds()
        };
    }

    return {
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds(),
        milliseconds: now.getMilliseconds()
    };
}

// -------------------------------
// Static list of world time zones shown in the panel
// Each item includes a label + IANA time zone ID.
// -------------------------------
const timezones = [
    { label: 'New York', zone: 'America/New_York' },
    { label: 'London', zone: 'Europe/London' },
    { label: 'Tokyo', zone: 'Asia/Tokyo' },
    { label: 'Sydney', zone: 'Australia/Sydney' }
];

// -------------------------------
// Create the time zone cards
// -------------------------------
function buildTimezonePanel() {
    timezoneGrid.innerHTML = '';
    timezones.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'timezone-card';
        card.innerHTML = `
            <div class="tz-city">${entry.label}</div>
            <div class="tz-time" data-zone="${entry.zone}">00:00</div>
        `;
        timezoneGrid.appendChild(card);
    });
}

// -------------------------------
// Update each time zone card with the current time
// -------------------------------
function updateTimezonePanel(now) {
    const use24 = settings.is24Hour;
    timezoneGrid.querySelectorAll('.tz-time').forEach(node => {
        const zone = node.getAttribute('data-zone');
        const formatter = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: !use24,
            timeZone: zone
        });
        node.textContent = formatter.format(now);
    });
}

// -------------------------------
// Apply the selected theme class to <body>
// -------------------------------
function setTheme(themeName) {
    document.body.classList.remove('theme-aurora', 'theme-desert', 'theme-steel');
    document.body.classList.add(`theme-${themeName}`);
}

// -------------------------------
// Persist settings in localStorage for next load
// -------------------------------
function saveSettings() {
    localStorage.setItem('modernClockSettings', JSON.stringify(settings));
}

// -------------------------------
// Create an AudioContext on first use (chime feature)
// -------------------------------
function initAudio() {
    if (audioContext) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.35;
    masterGain.connect(audioContext.destination);
}

// -------------------------------
// Play a short chime using a sine oscillator
// -------------------------------
function playChime() {
    initAudio();
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, audioContext.currentTime);
    gain.gain.setValueAtTime(0.001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.4, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(audioContext.currentTime + 0.45);
}

// -------------------------------
// Build a simple monthly calendar grid
// offset = 0 => current month, 1 => next month, -1 => previous month
// -------------------------------
function buildCalendar(offset = 0) {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = target.getFullYear();
    const month = target.getMonth();

    calendarTitle.textContent = target.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    const headers = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    calendarGrid.innerHTML = '';
    headers.forEach(label => {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell header';
        cell.textContent = label;
        calendarGrid.appendChild(cell);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    // Leading empty cells align the first day correctly
    for (let i = 0; i < firstDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        cell.textContent = '';
        calendarGrid.appendChild(cell);
    }

    // Create each day cell and highlight today
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        cell.textContent = day;
        if (
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear()
        ) {
            cell.classList.add('today');
        }
        calendarGrid.appendChild(cell);
    }
}

// -------------------------------
// Toggle focus mode to hide panels and enlarge the clock
// -------------------------------
function toggleFocusMode() {
    settings.focusMode = !settings.focusMode;
    document.body.classList.toggle('focus-mode', settings.focusMode);
    focusToggle.textContent = settings.focusMode ? 'Exit Focus' : 'Focus Mode';
    saveSettings();
}

// -------------------------------
// Apply a gentle ambient hue-shift when enabled
// -------------------------------
function applyAmbientMode() {
    if (!settings.ambient) {
        document.body.style.filter = '';
        return;
    }
    ambientPhase = (ambientPhase + 0.002) % 1;
    const hue = 200 + Math.sin(ambientPhase * Math.PI * 2) * 20;
    document.body.style.filter = `hue-rotate(${hue}deg) brightness(0.95)`;
}

// -------------------------------
// Local midnight is used as the base for sunrise arc calculations
// -------------------------------
function getLocalMidnight(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// -------------------------------
// Calculate sunrise and sunset time using a simplified solar position algorithm
// Returns null at extreme latitudes where sunrise/sunset may not occur.
// -------------------------------
function calcSunTimes(date, latitude, longitude) {
    const rad = Math.PI / 180;
    const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
        Date.UTC(date.getFullYear(), 0, 0)) / 86400000);

    const lngHour = longitude / 15;
    const zenith = 90.833;

    function calcTime(isSunrise) {
        const t = day + ((isSunrise ? 6 : 18) - lngHour) / 24;
        const M = (0.9856 * t) - 3.289;
        let L = M + (1.916 * Math.sin(M * rad)) + (0.02 * Math.sin(2 * M * rad)) + 282.634;
        L = (L + 360) % 360;
        let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
        RA = (RA + 360) % 360;
        const Lquadrant = Math.floor(L / 90) * 90;
        const RAquadrant = Math.floor(RA / 90) * 90;
        RA = (RA + (Lquadrant - RAquadrant)) / 15;

        const sinDec = 0.39782 * Math.sin(L * rad);
        const cosDec = Math.cos(Math.asin(sinDec));
        const cosH = (Math.cos(zenith * rad) - (sinDec * Math.sin(latitude * rad))) /
            (cosDec * Math.cos(latitude * rad));

        if (cosH > 1 || cosH < -1) {
            return null;
        }

        const H = (isSunrise ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad) / 15;
        const T = H + RA - (0.06571 * t) - 6.622;
        let UT = (T - lngHour) % 24;
        if (UT < 0) UT += 24;
        return UT;
    }

    const sunriseUT = calcTime(true);
    const sunsetUT = calcTime(false);

    if (sunriseUT === null || sunsetUT === null) {
        return null;
    }

    const sunrise = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    sunrise.setUTCHours(Math.floor(sunriseUT));
    sunrise.setUTCMinutes(Math.floor((sunriseUT % 1) * 60));
    sunrise.setUTCSeconds(0);

    const sunset = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    sunset.setUTCHours(Math.floor(sunsetUT));
    sunset.setUTCMinutes(Math.floor((sunsetUT % 1) * 60));
    sunset.setUTCSeconds(0);

    return { sunrise, sunset };
}

// -------------------------------
// Update the sun arc and indicator based on sunrise/sunset times
// -------------------------------
function updateSunRing(now) {
    if (!sunriseData) {
        // Without location data, fade the sun UI to a subtle state
        sunArc.style.opacity = '0.2';
        sunIndicator.style.opacity = '0.2';
        return;
    }

    const { sunrise, sunset } = sunriseData;
    const dayStart = getLocalMidnight(now);
    const dayDuration = 24 * 60 * 60 * 1000;
    const sunrisePct = ((sunrise - dayStart) / dayDuration) * 360;
    const sunsetPct = ((sunset - dayStart) / dayDuration) * 360;

    // Conic gradient creates the highlighted day arc
    sunArc.style.background = `conic-gradient(from -90deg,
        rgba(245, 158, 11, 0.0) 0deg,
        var(--ring-fill) ${sunrisePct}deg,
        var(--ring-fill) ${sunsetPct}deg,
        rgba(245, 158, 11, 0.0) ${sunsetPct}deg
    )`;

    const nowPct = ((now - dayStart) / dayDuration) * 360;
    const indicatorAngle = nowPct - 90;
    const radius = getComputedStyle(clock).getPropertyValue('--sun-radius') || '164px';
    sunIndicator.style.transform = `translate(-50%, -50%) rotate(${indicatorAngle}deg) translate(0, -${radius.trim()})`;
}

// -------------------------------
// Update the seconds progress ring using a conic gradient
// -------------------------------
function updateSecondsRing(seconds, milliseconds) {
    const progress = (seconds + milliseconds / 1000) / 60;
    const deg = Math.floor(progress * 360);
    secondsRing.style.background = `conic-gradient(var(--accent) ${deg}deg, rgba(245, 247, 251, 0.08) ${deg}deg)`;
}

// -------------------------------
// Main render loop: updates hands, labels, panels, and effects
// -------------------------------
function updateClock() {
    const now = new Date();
    const { hours, minutes, seconds, milliseconds } = getTimeParts(now);
    const tickKey = `${hours}:${minutes}:${seconds}`;
    const todayKey = now.toDateString();

    // For stepped seconds, skip repeated frames within the same second
    if (!settings.smoothSecond && tickKey === lastTickKey) {
        return;
    }
    lastTickKey = tickKey;

    // Smooth interpolation for each hand if enabled
    const secondProgress = settings.smoothSecond ? seconds + milliseconds / 1000 : seconds;
    const minuteProgress = settings.smoothSecond ? minutes + seconds / 60 : minutes;
    const hourProgress = settings.smoothSecond ? (hours % 12) + minutes / 60 : (hours % 12);

    const secondAngle = secondProgress * 6;
    const minuteAngle = minuteProgress * 6;
    const hourAngle = hourProgress * 30;

    secondHand.style.transform = `rotate(${secondAngle}deg)`;
    minuteHand.style.transform = `rotate(${minuteAngle}deg)`;
    hourHand.style.transform = `rotate(${hourAngle}deg)`;

    // Digital time and accessibility live region
    const timeString = timeFormatter.format(now);
    digitalTime.textContent = timeString;
    timeLiveRegion.textContent = `Time ${timeString}`;

    // Date readout uses the same timezone as the clock
    const dateString = dateFormatter.format(now).toUpperCase();
    dateDisplay.textContent = dateString;

    // Update supporting panels and rings
    updateTimezonePanel(now);
    if (sunriseData && sunriseDateKey !== todayKey) {
        // Refresh sunrise/sunset data once per day
        navigator.geolocation?.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                sunriseData = calcSunTimes(new Date(), latitude, longitude);
                sunriseDateKey = todayKey;
            },
            () => {
                sunriseData = null;
            },
            { maximumAge: 3600000, timeout: 6000 }
        );
    }
    updateSunRing(now);
    updateSecondsRing(seconds, milliseconds);

    // Optional chime on the minute
    if (settings.chime && seconds === 0 && minutes !== lastChimeMinute) {
        lastChimeMinute = minutes;
        playChime();
    }

    // Ambient hue shift per frame (if enabled)
    applyAmbientMode();
}

// -------------------------------
// RAF wrapper for continuous animation
// -------------------------------
function animationLoop() {
    updateClock();
    requestAnimationFrame(animationLoop);
}

// -------------------------------
// Sync settings, refresh formatters, and persist changes
// -------------------------------
function handleSettingsChange() {
    settings.is24Hour = formatToggle.checked;
    settings.smoothSecond = smoothToggle.checked;
    settings.timezone = timezoneSelect.value;
    settings.theme = themeSelect.value;
    settings.chime = chimeToggle.checked;
    settings.ambient = ambientToggle.checked;
    setTheme(settings.theme);
    updateFormatters();
    lastTickKey = '';
    updateClock();
    saveSettings();

    // Ensure audio is unlocked if chime was just enabled
    if (settings.chime) {
        initAudio();
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }
}

// -------------------------------
// Initial bootstrapping
// -------------------------------
updateFormatters();
buildMarkers();
buildTimezonePanel();
buildCalendar(calendarMonthOffset);
setTheme(settings.theme);
document.body.classList.toggle('focus-mode', settings.focusMode);
focusToggle.textContent = settings.focusMode ? 'Exit Focus' : 'Focus Mode';
updateClock();
requestAnimationFrame(animationLoop);

// -------------------------------
// Event wiring
// -------------------------------
window.addEventListener('resize', buildMarkers);
formatToggle.addEventListener('change', handleSettingsChange);
smoothToggle.addEventListener('change', handleSettingsChange);
timezoneSelect.addEventListener('change', handleSettingsChange);
themeSelect.addEventListener('change', handleSettingsChange);
chimeToggle.addEventListener('change', handleSettingsChange);
ambientToggle.addEventListener('change', handleSettingsChange);
focusToggle.addEventListener('click', toggleFocusMode);
focusExit.addEventListener('click', toggleFocusMode);
calendarPrev.addEventListener('click', () => {
    calendarMonthOffset -= 1;
    buildCalendar(calendarMonthOffset);
});
calendarNext.addEventListener('click', () => {
    calendarMonthOffset += 1;
    buildCalendar(calendarMonthOffset);
});

// -------------------------------
// Request geolocation for sunrise/sunset arc on first load
// -------------------------------
navigator.geolocation?.getCurrentPosition(
    (pos) => {
        const { latitude, longitude } = pos.coords;
        sunriseData = calcSunTimes(new Date(), latitude, longitude);
        sunriseDateKey = new Date().toDateString();
    },
    () => {
        sunriseData = null;
    },
    { maximumAge: 3600000, timeout: 6000 }
);
