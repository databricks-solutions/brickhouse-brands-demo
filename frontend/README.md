# Frontend - Brickhouse Brands Dashboard

Modern React dashboard built with TypeScript, featuring a comprehensive inventory management interface with real-time analytics and responsive design.

## 📒 Table of Contents

- [🛠️ Technology Stack](#️-technology-stack)
- [🚀 Getting Started](#-getting-started)
- [📁 Project Structure](#-project-structure)
- [🎨 UI Components](#-ui-components)
- [🔄 State Management](#-state-management)
- [🔌 API Integration](#-api-integration)
- [📊 Data Visualization](#-data-visualization)
- [🎯 Features](#-features)
- [🏗️ Build and Deployment](#️-build-and-deployment)
- [🔧 Development](#-development)
- [🧪 Testing](#-testing)
- [📱 Responsive Design](#-responsive-design)
- [🎨 Theming](#-theming)
- [🚀 Performance Optimizations](#-performance-optimizations)

## 🛠️ Technology Stack

- **React 18** with TypeScript for type safety
- **Vite** for fast development and building  
- **shadcn/ui + Tailwind CSS** for modern UI components
- **Zustand** for lightweight state management
- **TanStack Query** for server state management
- **React Router** for client-side routing
- **Recharts** for data visualization
- **Axios** for HTTP API communication

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, or bun package manager

### Development Setup

The frontend is automatically configured when you run the main project setup:

```bash
# From project root
./setup-env.sh
./start-dev.sh
```

### Manual Development Setup

If you need to set up the frontend independently:

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The development server will be available at `http://localhost:5173`

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── ui/              # shadcn/ui base components
│   │   ├── layout/          # Layout components
│   │   └── charts/          # Chart components
│   ├── pages/               # Main application pages
│   │   ├── Dashboard.tsx    # Main dashboard page
│   │   ├── Inventory.tsx    # Inventory management
│   │   ├── Orders.tsx       # Order management
│   │   └── Stores.tsx       # Store management
│   ├── api/                 # API service layer
│   │   ├── config/          # API client configuration
│   │   ├── services/        # Service classes for API calls
│   │   └── types/           # TypeScript type definitions
│   ├── store/               # Zustand state management
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utility libraries
│   └── utils/               # Helper functions
├── public/                  # Static assets
├── dist/                    # Production build output
└── index.html              # HTML template
```

## 🎨 UI Components

The application uses [shadcn/ui](https://ui.shadcn.com/) for consistent, accessible UI components:

### Core Components Used
- **Cards** - Dashboard KPI cards and content containers
- **Tables** - Data tables with sorting and filtering
- **Forms** - Form inputs with validation
- **Dialogs** - Modal dialogs for create/edit operations
- **Charts** - Interactive data visualization
- **Navigation** - Sidebar and breadcrumb navigation

### Custom Components
- **DashboardLayout** - Main application layout with sidebar
- **KPICard** - Standardized KPI display component  
- **DataTable** - Enhanced table with search and filtering
- **RegionFilter** - Multi-select region filtering
- **OrderStatusBadge** - Status indicator badges

## 🔄 State Management

### Zustand Stores

The application uses Zustand for client-side state management:

```typescript
// Example store structure
interface AppStore {
  // User preferences
  selectedRegion: string[];
  setSelectedRegion: (regions: string[]) => void;
  
  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  
  // Application data cache
  stores: Store[];
  setStores: (stores: Store[]) => void;
}
```

### Server State with TanStack Query

API data is managed using TanStack Query for:
- Automatic caching and background updates
- Loading and error states
- Optimistic updates
- Request deduplication

```typescript
// Example API hook
export const useInventoryData = () => {
  return useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryService.getInventory(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

## 🔌 API Integration

### Service Layer Architecture

All API calls are organized into service classes:

```typescript
// services/inventoryService.ts
class InventoryService {
  async getInventory(params?: InventoryFilters): Promise<InventoryItem[]> {
    const response = await apiClient.get('/inventory', { params });
    return response.data;
  }
  
  async updateStock(id: string, quantity: number): Promise<void> {
    await apiClient.patch(`/inventory/${id}/stock`, { quantity });
  }
}
```

### Type Safety

Full TypeScript coverage with shared types:

```typescript
// types/inventory.ts
export interface InventoryItem {
  id: string;
  product_name: string;
  category: string;
  current_stock: number;
  reorder_level: number;
  store_id: string;
  store_name: string;
  region: string;
}

export interface InventoryFilters {
  region?: string[];
  category?: string[];
  low_stock?: boolean;
}
```

## 📊 Data Visualization

### Recharts Integration

Interactive charts using Recharts library:

- **Bar Charts** - Category and regional comparisons
- **Line Charts** - Trend analysis over time
- **Pie Charts** - Distribution analysis
- **Area Charts** - Cumulative metrics

```typescript
// Example chart component
export const InventoryTrendChart = ({ data }: { data: TrendData[] }) => {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  );
};
```

## 🎯 Features

### Dashboard
- Real-time KPI cards with animated counters
- Interactive regional filtering
- Responsive chart visualizations
- Quick action buttons

### Inventory Management
- Sortable and filterable data tables
- Bulk stock level updates
- Low stock alerts and notifications
- Category-based organization

### Order Management  
- Order lifecycle tracking
- Approval workflow interface
- Bulk operations support
- Status filtering and search

### Store Management
- Multi-location view
- Performance comparison charts
- Store type and region management

## 🏗️ Build and Deployment

### Development Build
```bash
npm run dev          # Start dev server
npm run build:dev    # Build for development
```

### Production Build
```bash
npm run build        # Build for production
npm run preview      # Preview production build
```

### Build Configuration

The build process is optimized for:
- **Code splitting** - Automatic route-based splitting
- **Tree shaking** - Dead code elimination  
- **Asset optimization** - Image and font optimization
- **Bundle analysis** - Size monitoring and optimization

## 🔧 Development

### Adding New Pages

1. Create page component in `src/pages/`
2. Add route in `App.tsx`
3. Update navigation in `components/layout/Sidebar.tsx`

### Adding New API Services

1. Create service class in `src/api/services/`
2. Add TypeScript types in `src/api/types/`
3. Create React Query hooks in `src/hooks/`

### Styling Guidelines

- Use Tailwind CSS utility classes
- Follow shadcn/ui design system
- Maintain responsive design principles
- Use CSS variables for theme customization

### Code Quality

The project includes:
- **ESLint configuration** for code consistency
- **TypeScript strict mode** for type safety
- **Prettier integration** for code formatting
- **Path aliases** for clean imports (`@/components/...`)

## 🧪 Testing

While not currently implemented, the project is set up for:
- **Unit testing** with Vitest
- **Component testing** with React Testing Library
- **E2E testing** with Playwright

## 📱 Responsive Design

The dashboard is fully responsive with:
- **Mobile-first approach** using Tailwind breakpoints
- **Collapsible sidebar** for mobile navigation
- **Responsive data tables** with horizontal scrolling
- **Touch-friendly interactions** for mobile devices

## 🎨 Theming

Built-in dark/light theme support using:
- **CSS custom properties** for color schemes
- **next-themes** for theme persistence
- **Tailwind dark mode** classes
- **System preference detection**

## 🚀 Performance Optimizations

- **Lazy loading** of route components
- **Virtualized tables** for large datasets
- **Optimized re-renders** with React.memo
- **Efficient API caching** with TanStack Query
- **Bundle optimization** with Vite 