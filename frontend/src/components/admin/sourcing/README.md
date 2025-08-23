# Sourcing Agent Super Admin UI

This directory contains the Super Admin interface components for managing the Sourcing Agent system.

## 📁 Components

### `SourcingDashboard.jsx`
Main dashboard component with navigation and routing for all sourcing features.

### `CampaignsPage.jsx`
- Lists all sourcing campaigns with filtering
- Shows campaign stats and status
- Quick actions for viewing details and replies

### `CampaignDetailPage.jsx`
- Detailed campaign view with performance metrics
- Email sequence preview
- Campaign control actions (pause/resume/launch)
- Sender information and settings

### `RepliesPage.jsx`
- Thread-based reply management
- AI classification display
- Action buttons: "Draft with REX", "Book Demo", "Disqualify"
- Filtering by reply classification

## 🔧 Integration

### 1. Add to Router
Add the sourcing routes to your main app router:

```jsx
// In your main App.jsx or router configuration
import { SourcingDashboard } from './components/admin/sourcing';

// Add to your routes
<Route path="/super-admin/sourcing/*" element={<SourcingDashboard />} />
```

### 2. Add Navigation Link
Add a navigation link in your Super Admin sidebar:

```jsx
// In SuperAdminDashboard.jsx or similar
<Link 
  to="/super-admin/sourcing" 
  className="nav-link"
>
  🤖 Sourcing Agent
</Link>
```

### 3. Environment Variables
Ensure your frontend has the backend URL configured:

```env
VITE_BACKEND_URL=http://localhost:8080
```

## 🚀 Features

### Campaign Management
- ✅ Create and manage sourcing campaigns
- ✅ View campaign performance metrics
- ✅ Control campaign execution (pause/resume)
- ✅ Email sequence preview and management

### Reply Management
- ✅ AI-powered reply classification
- ✅ Thread-based conversation view
- ✅ Action buttons for common responses
- ✅ Integration hooks for REX drafting

### Analytics
- ✅ Real-time campaign statistics
- ✅ Reply rate and conversion tracking
- ✅ Lead progression monitoring
- ✅ Performance grading system

## 📊 API Endpoints Used

The components use these backend API endpoints:

- `GET /api/sourcing/campaigns` - List campaigns
- `GET /api/sourcing/campaigns/:id` - Campaign details
- `GET /api/sourcing/campaigns/:id/leads` - Campaign leads
- `GET /api/sourcing/campaigns/:id/replies` - Campaign replies
- `POST /api/sourcing/campaigns/:id/pause` - Pause campaign
- `POST /api/sourcing/campaigns/:id/resume` - Resume campaign
- `POST /api/sourcing/campaigns/:id/schedule` - Launch campaign
- `POST /api/sourcing/replies/:id/book-demo` - Book demo action
- `POST /api/sourcing/replies/:id/disqualify` - Disqualify lead

## 🎨 Styling

Components use Tailwind CSS with a dark theme consistent with the existing admin interface:

- **Background**: `bg-gray-900` (main), `bg-gray-800` (cards)
- **Text**: `text-white` (primary), `text-gray-400` (secondary)
- **Borders**: `border-gray-700`
- **Buttons**: `bg-blue-600` (primary), `bg-green-600` (success), `bg-red-600` (danger)

## 🔮 Future Enhancements

### Planned Features
- **Advanced Analytics** - Detailed performance dashboards
- **A/B Testing** - Sequence optimization tools
- **Bulk Actions** - Mass campaign management
- **Export Features** - Data export and reporting
- **Team Management** - Multi-user campaign access

### REX Integration
- **Draft Responses** - Direct REX integration for reply drafting
- **Campaign Creation** - REX-powered campaign wizard
- **Smart Suggestions** - AI-powered optimization recommendations

## 🧪 Testing

To test the components:

1. Ensure backend is running with sourcing API endpoints
2. Navigate to `/super-admin/sourcing`
3. Create test campaigns using the REX orchestrator
4. Verify all CRUD operations work correctly
5. Test reply management and actions

## 📱 Responsive Design

Components are responsive and work on:
- ✅ Desktop (1200px+)
- ✅ Tablet (768px - 1199px)
- ✅ Mobile (320px - 767px)

Key responsive features:
- Grid layouts adapt to screen size
- Navigation collapses on mobile
- Cards stack vertically on smaller screens
- Action buttons group appropriately

---

*Sourcing Agent Super Admin UI - Professional campaign management interface* 🎯✨
