# Modern Clock

A modern analog + digital clock with a glassmorphism face, smooth animation options, and timezone control. Built with plain HTML, CSS, and JavaScript.

## Features
- Analog clock with minimalist markers and 12/3/6/9 numerals
- Digital time + date display
- 24-hour / 12-hour toggle
- Smooth or ticking second hand
- Local or UTC timezone switch
- World time panel (New York, London, Tokyo, Sydney)
- Theme presets (Aurora, Desert, Steel)
- Sunrise/sunset ring with live sun position (uses geolocation if allowed)
- Seconds progress ring
- Calendar panel with month navigation
- Focus Mode (with quick exit button)
- Ambient mode (slow hue shift)
- Chime toggle (beep on the minute)
- Settings persistence via `localStorage`
- Responsive geometry for markers and numerals
- Reduced-motion support

## Run Locally
1. Open `index.html` directly in your browser.
2. Or run a local server in this folder:
   - `python3 -m http.server 8000`
   - Then open `http://localhost:8000`

## Project Structure
- `index.html`: Markup and controls
- `styles.css`: Visual design and animations
- `script.js`: Clock logic, formatting, and responsiveness

## Notes
- Uses `requestAnimationFrame` for smooth animation.
- Time formatting is handled with `Intl.DateTimeFormat`.
- Sunrise/sunset ring requires location permission.
