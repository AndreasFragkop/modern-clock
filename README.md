# Modern Clock

A modern analog + digital clock with theme presets, world time, calendar, and focus mode. Built with plain HTML, CSS, and JavaScript.

![Modern Clock](images/modern-clock.png)

## Project Structure
```text
modern-clock/
├── index.html              # Markup and controls
├── styles.css              # Layout, themes, and animation styling
├── script.js               # Clock logic and UI behavior
├── README.md               # Project documentation
└── images/
    └── modern-clock.png    # README screenshot
```

## Run
1. Quick start: open `index.html` directly in your browser.
2. Local server option:
   - From `modern-clock/`, run:
     ```bash
     python3 -m http.server 8000
     ```
   - Open `http://localhost:8000`.

## Requirements
- A modern web browser
- Optional: Python 3 (only needed for local server mode)

## Browser Support
- Google Chrome (recent versions)
- Microsoft Edge (recent versions)
- Mozilla Firefox (recent versions)
- Safari (recent versions)

## How to Use
1. View live analog and digital time immediately on load.
2. Toggle 12/24-hour display and local/UTC mode.
3. Enable smooth seconds or tick mode.
4. Switch between theme presets.
5. Use Focus Mode to hide extra panels and enlarge the clock.
6. Use calendar navigation controls for month browsing.
7. Check world time cards for supported cities.

## How It Works
- A `requestAnimationFrame` loop updates clock state continuously.
- Hand rotations are calculated from current time values.
- Digital time/date formatting uses `Intl.DateTimeFormat`.
- Theme, mode, and UI preferences are persisted with `localStorage`.
- World time cards use predefined IANA timezone entries.
- Sunrise/sunset and seconds progress rings are drawn via CSS gradients and runtime values.

## Features
- Analog clock with hour/minute/second hands
- Digital clock and date display
- 12/24-hour format toggle
- Local/UTC switching
- Smooth or ticking seconds
- World time panel
- Theme presets
- Sunrise/sunset ring with sun-position indicator
- Seconds progress ring
- Calendar panel with navigation
- Focus Mode and ambient visual mode
- Minute chime toggle
- Reduced-motion support
- Persistent settings via `localStorage`

## Limitations
- Sunrise/sunset calculations depend on geolocation permission.
- Chime behavior depends on browser audio permission/policies.
- World time list is fixed unless modified in code.
- Browser-only implementation may vary slightly across environments.

## Privacy
- All clock rendering and settings logic run locally in the browser.
- No backend service is required.
- Preferences are stored in localStorage under `modernClockSettings`.

## Roadmap
- Add configurable world time city management in the UI.
- Add optional offline fallback for any external assets.
- Add keyboard shortcuts for common toggles.
- Expand accessibility controls for contrast and type scale.

## Notes
- Uses `requestAnimationFrame` for smooth visual updates.
- Time/date formatting relies on `Intl.DateTimeFormat`.
- Geolocation-driven daylight ring gracefully degrades when permission is denied.
