# Job Tracker

A dark-mode, responsive web application for tracking job applications, interviews, and career coaching contacts. Built with vanilla HTML, CSS, and JavaScript with localStorage persistence.

## Features

- **Dark-Mode Responsive UI** - Clean, modern design that looks great on mobile, tablet, and desktop screens
- **Kanban Board** - Visual pipeline with 6 stages: Wishlist, Applied, Screening, Interview, Final Round, and Offer
- **Drag & Drop** - Move job cards between stages by dragging
- **Add/Edit/Delete Jobs** - Full CRUD operations with form validation (Company and Role required)
- **Job Coach Tracking** - Separate tab for managing career coach contacts
- **Smart Import** - Paste emails or calendar invites to auto-extract job/interview details
- **localStorage Persistence** - All data persists across browser sessions
- **Statistics Dashboard** - Track total applications, response rate, and upcoming interviews
- **Data Export** - Download your data as JSON for backup

## How to Run

1. Open Finder and navigate to `~/Desktop/Job Tracker`
2. Double-click `job-tracker.html` to open it in your default browser

Or from Terminal:
```bash
cd ~/Desktop/"Job Tracker"
open job-tracker.html
```

## File Structure

```
Job Tracker/
├── job-tracker.html   # Main HTML file
├── styles.css         # All CSS styles
├── script.js          # All JavaScript logic
├── README.md          # This file
└── CLAUDE.md          # Guidelines for Claude Code
```

## Data Storage

Data is stored in your browser's localStorage under these keys:
- `jobTrackerData` - Array of job application objects
- `jobTrackerCoaches` - Array of coach objects

Each job object contains:
```javascript
{
  id: "unique-id",
  company: "Company Name",
  role: "Job Title",
  location: "City or Remote",
  salary: "$XX,XXX - $XX,XXX",
  dateApplied: "YYYY-MM-DD",
  stage: "wishlist|applied|screening|interview|final|offer",
  interviewDate: "YYYY-MM-DD",
  interviewTime: "HH:MM",
  contactName: "Recruiter Name",
  contactInfo: "email@example.com",
  tags: ["Tag1", "Tag2"],
  notes: "Any notes...",
  tasks: [{ text: "Task description", completed: false }]
}
```

## Future Improvements

1. **Filtering & Searching** - Add ability to filter jobs by stage, tags, or search by company/role name
2. **Multiple Views** - Toggle between Kanban board view and table/list view
3. **Export/Import Data** - Import data from JSON file to restore backups or transfer between browsers
4. **Calendar Integration** - Export interviews to Google Calendar or Apple Calendar (.ics files)
5. **Email Reminders** - Integration with email services to send interview reminders
6. **Analytics Dashboard** - Charts showing application trends over time, success rates by company size, etc.
7. **Browser Extension** - One-click save jobs from LinkedIn, Indeed, or other job boards
8. **Dark/Light Theme Toggle** - Option to switch between dark and light themes

## Browser Support

Works in all modern browsers:
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## License

Personal use project. Feel free to modify for your own job search needs.
