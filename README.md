## REX Widget Environments

Frontend fallbacks (used only if `/api/rex_widget/config` does not provide values):

- `REACT_APP_REX_API_BASE` (optional, default same-origin)
- `REACT_APP_DEMO_URL`
- `REACT_APP_CALENDLY_URL`

Server env:

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SLACK_WEBHOOK_URL`
- `ZAPIER_HOOK_URL` (optional)
- `MONDAY_TOKEN` (optional)
- `MONDAY_BOARD_ID` (optional)
- `SITE_SITEMAP_URLS` (comma-separated)
- `MAX_PAGES` (optional, default 200)
- `CORS_ALLOW_ORIGINS="https://thehirepilot.com,https://*.thehirepilot.com"`

### QA Checklist

1. Public site launches Sales Mode. Chips visible.
2. After 2 Q&As, CTA row appears (Demo/Calendly/Human).
3. Lead submit inserts `rex_leads` and triggers Slack (and Zapier/Monday if configured).
4. In app routes, Support Mode answers with step-by-step and sources.
5. Close & reopen restores last 15 messages (per anon/user scope).
6. Handoff posts transcript to Slack.
7. Admin POST `/api/rex_widget/kb/reindex` triggers Edge Function crawl; new sources appear.

### Fixtures

- `fixtures/rex/sample_pages.json` – sample KB pages/chunks
- `fixtures/rex/rb2b_sample.json` – mock RB2B payload

# HirePilot

HirePilot is an AI-powered recruiting platform that helps companies hire better, faster. This project is built with React and uses modern web technologies to provide a seamless user experience.

## Features

- AI-powered candidate screening
- Automated interview scheduling
- Candidate tracking and management
- Analytics and reporting
- Team collaboration tools

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/hirepilot.git
cd hirepilot
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in development mode.

### `npm test`

Launches the test runner in interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

## Technologies Used

- React
- Tailwind CSS
- Font Awesome
- Web Vitals

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [React](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Font Awesome](https://fontawesome.com/) 