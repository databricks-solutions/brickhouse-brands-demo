# Brickstore Brands

A comprehensive inventory management dashboard built with React and FastAPI, featuring real-time analytics and PostgreSQL database integration.

## 🏗️ Architecture

This project uses a **modern three-tier architecture**:

### Frontend (React + TypeScript)
- **React** with TypeScript for type safety
- **Zustand** for state management
- **shadcn/ui** + **Tailwind CSS** for modern UI components
- **Recharts** for data visualization
- **Vite** for fast development and building
- **Axios** for HTTP API communication

### Backend (FastAPI + PostgreSQL)
- **FastAPI** for high-performance API endpoints
- **PostgreSQL** with connection pooling for data persistence
- **Pydantic** for data validation and serialization
- **psycopg2** for database connectivity
- **RESTful API** design with `/api` prefix

### Integration
- **HTTP-based communication** between frontend and backend
- **No direct database connections** from frontend
- **Type-safe API contracts** with comprehensive error handling
- **Real-time data synchronization** via API calls

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+
- PostgreSQL database

### Frontend Setup

```bash
# Install frontend dependencies
npm install

# Configure environment variables
echo "VITE_API_BASE_URL=http://0.0.0.0:8000/api" > .env

# Start React development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables
cp env.example .env
# Edit .env with your database credentials

# Start FastAPI server
python startup.py
```

The API will be available at `http://localhost:8000`
- Interactive API docs: `http://localhost:8000/docs`

## 📊 Features

### ✅ **Current Implementation (Completed)**
- **Dashboard Overview** - KPI cards with real-time inventory metrics via API
- **Region Filtering** - Dynamic data filtering by geographical regions
- **Inventory Management** - Complete CRUD operations through API endpoints
- **Store Management** - Manage store locations and types via REST API
- **Order Tracking** - Full order lifecycle management with approval workflows
- **User Management** - Role-based access control (store managers, regional managers)
- **Data Visualization** - Interactive charts powered by API data
- **Responsive Design** - Mobile-friendly interface
- **API Integration** - Full HTTP-based communication with FastAPI backend
- **Error Handling** - Comprehensive error handling and user feedback
- **Type Safety** - End-to-end TypeScript coverage
- **Real-time Updates** - Live data synchronization via API calls

### Database Schema
- **Stores** - Store locations with regions and types
- **Products** - Product catalog with categories and pricing
- **Inventory** - Stock levels with automated alerts
- **Orders** - Order management with approval workflows
- **Users** - Role-based user management system

## 🛠️ Development

### Project Structure

```
brickstore-brands/
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── pages/              # Main application pages
│   ├── store/              # Zustand state management
│   ├── api/                # HTTP API service layers
│   │   ├── config/         # API client configuration
│   │   ├── services/       # Service classes for API calls
│   │   └── types/          # TypeScript type definitions
│   ├── hooks/              # Custom React hooks
│   └── utils/              # Utility functions
├── backend/                # FastAPI backend (separate repository)
│   ├── app/
│   │   ├── routers/        # API endpoint definitions
│   │   ├── models/         # Pydantic schemas
│   │   └── database/       # Database connection management
│   ├── main.py             # FastAPI application
│   └── startup.py          # Server startup script
├── database/               # Database schema and setup
└── docs/                   # Project documentation
```

### API Endpoints

The backend provides RESTful APIs with `/api` prefix:

#### Inventory Management
- `GET /api/inventory` - List inventory with filtering and pagination
- `GET /api/inventory/kpis` - Get key performance indicators
- `GET /api/inventory/trends` - Get historical trend data
- `PATCH /api/inventory/{id}/stock` - Update stock levels
- `GET /api/inventory/low-stock-alerts` - Get low stock alerts

#### Order Management
- `GET /api/orders` - List orders with filtering and pagination
- `POST /api/orders` - Create new orders
- `PATCH /api/orders/{id}/approve` - Approve orders
- `PATCH /api/orders/{id}/fulfill` - Fulfill orders
- `GET /api/orders/pending-approvals` - Get pending approvals

#### Store Management
- `GET /api/stores` - List stores with filtering
- `GET /api/stores/regions` - Get available regions
- `GET /api/stores/options` - Get store options for dropdowns
- `GET /api/stores/performance` - Get store performance analytics

#### User Management
- `GET /api/users` - List users with role filtering
- `GET /api/users/role/{role}` - Get users by role
- `GET /api/users/{id}/permissions` - Get user permissions

#### Product Management
- `GET /api/products` - List products with filtering
- `GET /api/products/categories` - Get product categories
- `GET /api/products/brands` - Get product brands
- `GET /api/products/performance` - Get product analytics

## 🔧 Configuration

### Environment Variables

#### Frontend (`.env` in project root)
```env
# FastAPI Backend Configuration
VITE_API_BASE_URL=http://0.0.0.0:8000/api

# Development settings
NODE_ENV=development
```

#### Backend (`.env` in backend directory)
```env
# PostgreSQL Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/store_flow_analytics
DB_HOST=localhost
DB_PORT=5432
DB_NAME=store_flow_analytics
DB_USER=your_username
DB_PASSWORD=your_password
DEBUG=True

# FastAPI Configuration
API_PREFIX=/api
```

## 📈 Roadmap

### ✅ **Phase 1: Foundation (Completed)**
- React frontend with shadcn/ui components
- Basic inventory and order management
- Dashboard with KPI visualization

### ✅ **Phase 2: API Integration (Completed)**
- FastAPI backend integration
- HTTP-based service layer
- Real-time data synchronization
- Comprehensive error handling

### 🚧 **Phase 3: Advanced Features (In Progress)**
- [ ] WebSocket integration for real-time notifications
- [ ] Advanced analytics and reporting dashboards
- [ ] Automated reordering system
- [ ] Enhanced role-based permissions
- [ ] Bulk operations for inventory management

### 📋 **Phase 4: Production Ready (Planned)**
- [ ] Authentication and authorization system
- [ ] Performance optimization and caching
- [ ] Comprehensive testing suite
- [ ] CI/CD pipeline setup
- [ ] Production deployment configuration

## 🗄️ Database Setup

Refer to `DATABASE_SETUP.md` for detailed database schema and setup instructions.

The database setup now includes:
- PostgreSQL database configuration for the backend
- Frontend API client configuration
- Comprehensive testing procedures

## 📚 Documentation

- **Frontend**: React components with TypeScript interfaces and API service documentation
- **Backend**: Interactive API documentation at `/docs` endpoint
- **Database**: Comprehensive schema documentation in `DATABASE_SETUP.md`
- **API**: RESTful endpoint documentation with request/response examples

## 🚀 Deployment

### Development
```bash
# Start backend (Terminal 1)
cd backend
source venv/bin/activate
python startup.py

# Start frontend (Terminal 2)
npm run dev
```

### Production
- **Frontend**: Deploy via static hosting (Vercel, Netlify) or CDN
- **Backend**: Deploy with Gunicorn/Uvicorn on cloud platforms (Heroku, AWS, GCP)
- **Database**: Use managed PostgreSQL services (AWS RDS, Google Cloud SQL)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with proper TypeScript types
4. Test API integration thoroughly
5. Submit a pull request with detailed description

## ⚠️ Current Status

The project is **fully functional** with complete API integration between the React frontend and FastAPI backend. 

**Key Achievements:**
- ✅ Complete API-based architecture implemented
- ✅ All frontend services migrated to HTTP calls
- ✅ Real-time data synchronization working
- ✅ Comprehensive error handling in place
- ✅ Type-safe API contracts established
- ✅ PostgreSQL database properly integrated via backend

**Current Focus**: Advanced features and production optimization (Phase 3)

**Next Steps**: WebSocket integration for real-time notifications and enhanced analytics dashboards.
