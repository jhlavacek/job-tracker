# CLAUDE.md - Project Guidelines for Claude Code

## Project Overview

**Job Tracker** is a single-page web application for tracking job applications during a job search. It helps users manage their application pipeline from initial wishlist through to offer, with additional support for tracking career coaches.

### Purpose
- Track job applications through various stages
- Schedule and remember interview dates/times
- Manage career coach contacts and meetings
- Persist data locally without requiring a backend

## Tech Stack

- **HTML5** - Semantic markup with accessibility attributes
- **CSS3** - Custom properties (variables), Flexbox, Grid, responsive design
- **JavaScript (ES6+)** - Vanilla JS, no frameworks or build tools
- **localStorage** - Client-side data persistence
- **No Backend** - Fully static, runs directly in browser

## File Structure

```
Job Tracker/
├── job-tracker.html   # Main entry point, all HTML structure
├── styles.css         # All styles, organized by component
├── script.js          # All JavaScript, organized by feature
├── README.md          # User documentation
└── CLAUDE.md          # This file - dev guidelines
```

## Style Guidelines

### Visual Design
- **Keep dark mode** - The app uses a dark theme by default. Do not change to light mode unless explicitly requested.
- **Color palette** is defined in CSS custom properties (`:root` block in styles.css):
  - Backgrounds: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`
  - Text: `--text-primary`, `--text-secondary`
  - Status colors: `--color-wishlist` (purple), `--color-applied` (blue), etc.
- **Accent color** is blue (`--color-applied: #3b82f6`) for primary actions

### Responsiveness
- Mobile-first breakpoints at 480px and 768px
- Test changes on narrow screens (320px+)
- Kanban board scrolls horizontally on mobile

### Accessibility
- All form inputs have associated `<label>` elements
- Modals have proper ARIA attributes (`role`, `aria-modal`, `aria-labelledby`)
- Interactive elements have visible focus states
- Color contrast meets WCAG AA standards

## Code Conventions

### JavaScript
- Functions are organized by feature (Data, Stats, Board, Modals, etc.)
- Each function has a JSDoc comment explaining its purpose
- Use `const` and `let`, never `var`
- HTML is escaped with `escapeHtml()` to prevent XSS
- Data is stored as arrays of objects in `jobs` and `coaches` variables

### CSS
- Organized into sections with comment headers
- Use CSS custom properties for colors
- BEM-ish naming: `.job-card`, `.job-card-header`, `.job-card-actions`
- Avoid `!important`

### HTML
- Semantic elements (`<header>`, `<main>`, `<section>`, `<nav>`)
- ARIA attributes for accessibility
- IDs for JavaScript hooks, classes for styling

## Data Model

### Job Object
```javascript
{
  id: string,           // Unique identifier
  company: string,      // Required
  role: string,         // Required
  location: string,
  salary: string,
  dateApplied: string,  // YYYY-MM-DD
  stage: string,        // wishlist|applied|screening|interview|final|offer
  interviewDate: string,
  interviewTime: string,
  contactName: string,
  contactInfo: string,
  tags: string[],
  notes: string,
  tasks: Array<{text: string, completed: boolean}>
}
```

### Coach Object
```javascript
{
  id: string,
  name: string,         // Required
  specialty: string,
  price: string,
  rating: number|null,  // 1-5
  email: string,
  phone: string,
  website: string,
  meetingDate: string,
  meetingTime: string,
  status: string,       // researching|contacted|consulting|hired|declined
  notes: string
}
```

### localStorage Keys
- `jobTrackerData` - JSON string of jobs array
- `jobTrackerCoaches` - JSON string of coaches array

## Working with This Project

### Before Making Changes
1. Read the relevant code sections first
2. Understand the existing patterns
3. For large changes, describe your plan and wait for confirmation

### Incremental Edits
- Prefer small, focused changes over large rewrites
- Test each change in the browser before moving to the next
- Keep existing functionality working

### Adding Features
1. Add any new CSS to the appropriate section in styles.css
2. Add new JavaScript functions with JSDoc comments
3. Update HTML structure as needed
4. Maintain dark mode compatibility
5. Ensure mobile responsiveness
6. Add ARIA attributes for accessibility

### Testing Changes
After making changes, verify:
1. Page loads without console errors
2. Existing data persists (check localStorage)
3. Add/edit/delete operations work
4. Drag and drop still functions
5. Modals open and close correctly
6. Mobile view is usable

## Common Tasks

### Adding a New Field to Jobs
1. Add the field to the form in `job-tracker.html`
2. Update `saveJob()` in script.js to read the field
3. Update `openEditModal()` to populate the field when editing
4. Update `createJobCard()` if the field should display on cards
5. Consider adding to the default job in `defaultJobs` array

### Changing Colors
1. Modify the CSS custom property in `:root` block of styles.css
2. Colors will update everywhere they're used

### Adding a New Stage
1. Add column HTML in `job-tracker.html`
2. Add to `stages` array in `renderBoard()` function
3. Add option to stage `<select>` in the job form
4. Add color variable and column styling in styles.css

## Goal Date

The app has a countdown to April 30, 2026 hardcoded in `GOAL_DATE`. To change this:
```javascript
const GOAL_DATE = new Date('YYYY-MM-DD');
```

## Questions?

If requirements are unclear:
- Ask before making assumptions
- Propose options when multiple approaches exist
- Confirm destructive changes before executing
