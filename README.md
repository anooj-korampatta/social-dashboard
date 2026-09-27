# GWC Social Media Performance Dashboard

A single-page, tab-based Bootstrap dashboard prototype based on the August 2026 GWC Social Media Performance Report.

## Features

- One-page dashboard with tabs: Overview, LinkedIn, Instagram, X, Insights
- Month selector designed for future monthly expansion
- KPI cards and Apr-Aug trend chart
- Channel contribution view
- Platform-specific posting cadence, content mix, language mix, top/needs-attention posts, and recommended action
- Context-sensitive **Download PDF** button that exports the currently selected tab
- Responsive Bootstrap 5 layout
- Minimal black/white UI with selective GWC green
- Proxima Nova via Adobe Typekit

## Project structure

```text
gwc-social-dashboard/
├── index.html
├── README.md
└── assets/
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── data.js
    │   └── app.js
    └── images/
        ├── gwc-logo-placeholder.svg
        ├── post-linkedin-top.svg
        ├── post-linkedin-low.svg
        ├── post-instagram-top.svg
        ├── post-instagram-low.svg
        ├── post-x-top.svg
        └── post-x-low.svg
```

## Run locally

Because the project uses CDN-hosted Bootstrap, Chart.js, html2pdf.js, Bootstrap Icons, and Adobe Typekit, internet access is required.

You can double-click `index.html`, or serve it locally for the cleanest behaviour:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Replace the logo

Replace:

```text
assets/images/gwc-logo-placeholder.svg
```

with the approved GWC SVG, keeping the same filename, or update the path in `index.html` and `assets/js/app.js`.

## Add another month

1. Open `assets/js/data.js`.
2. Add the month key to `reportMeta.availableMonths`.
3. Add a matching month object inside `months` using the same schema as `2026-08`.
4. Reload the page. The month selector updates automatically.

For production, the static `data.js` object can later be replaced with JSON files, a CMS, a database, or an API.

## PDF export

The Download PDF button exports the **currently active tab** in A4 landscape format using html2pdf.js. If the library cannot load, the dashboard falls back to the browser print dialog.

## Notes

- The post artwork included here is intentionally placeholder artwork. Replace these files with actual post thumbnails if required.
- The August figures are seeded from the supplied August 2026 social media report.
