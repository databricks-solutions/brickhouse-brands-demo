# Brickhouse Brands Demo 🥤

A comprehensive inventory management dashboard showcasing modern full-stack architecture with React frontend, FastAPI backend, and PostgreSQL (Lakebase) database.  
Designed for deployment on **Databricks Apps** with local development support.

![Image](https://github.com/user-attachments/assets/62325616-502c-45cb-9f0c-254e20416150)

## 📒 Table of Contents

- [📊 Application Features](#-application-features)
  - [Dashboard Overview](#dashboard-overview)
  - [Inventory Management](#inventory-management)
  - [Order Management](#order-management)
  - [Store Management](#store-management)
- [🏗️ Architecture](#️-architecture)
- [🚀 Quick Start](#-quick-start)
  - [Prerequisites](#prerequisites)
  - [1. Databricks CLI Authentication](#1-databricks-cli-authentication)
  - [2. Local Environment Setup](#2-local-environment-setup)
  - [3. Configuration](#3-configuration)
  - [4. Database Setup](#4-database-setup)
  - [5. Start Development Environment](#5-start-development-environment)
- [🔐 Production Deployment with Databricks](#-production-deployment-with-databricks)
  - [Setting Up Databricks Secrets](#setting-up-databricks-secrets)
  - [Deploy to Databricks Apps](#deploy-to-databricks-apps)
- [📁 Project Structure](#-project-structure)
- [🛠️ Development](#️-development)
  - [Local Development Commands](#local-development-commands)
- [📈 Future Considerations](#-future-considerations)
- [ℹ️ How to get help](#ℹ️-how-to-get-help)
- [🤝 Contributing](#-contributing)
- [License](#license)

## 📊 Application Features

### Dashboard Overview
- Real-time KPI cards with inventory metrics
- Interactive charts for sales and inventory trends
- Regional filtering and performance analytics

### Inventory Management
- Complete CRUD operations for products and stock levels
- Low stock alerts and automated reordering suggestions
- Category-based product organization

### Order Management
- Full order lifecycle with approval workflows
- Bulk order processing and fulfillment tracking
- Manager approval system with role-based permissions

### Store Management
- Multi-location inventory tracking
- Regional performance comparisons
- Store type categorization (retail vs warehouse)

## 🏗️ Architecture

This project demonstrates a **modern three-tier architecture** with centralized configuration management:

- **Frontend**: React + TypeScript with shadcn/ui components and Vite build system
- **Backend**: FastAPI with PostgreSQL integration and RESTful API design
- **Database**: PostgreSQL with automated setup scripts and demo data generation
- **Deployment**: Databricks Apps with automated build and deployment pipeline

### Key Features

- **Centralized Configuration**: Single `.env` file synced across all components
- **Automated Setup**: One-command environment setup and development server startup
- **Production-Ready**: Databricks Apps deployment with proper secret management
- **Real-time Dashboard**: Interactive analytics with inventory management and order tracking

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** for frontend development
- **Python 3.10+** for backend and database setup
- **PostgreSQL** database instance (16+ recommended)
- **Databricks CLI** for production deployment to a Databricks Apps environment

### 1. Databricks CLI Authentication

First, install and authenticate with the Databricks CLI:

```bash
# Authenticate with your Databricks workspace and set profile
databricks auth login --host <databricks-workspace-url> --profile <my-profile>

# Verify authentication
databricks auth describe --profile <my-profile>
```

For installation instructions, see the [official Databricks CLI installation guide](https://docs.databricks.com/aws/en/dev-tools/cli/install).


### 2. Local Environment Setup

Run the setup script to configure all components:

```bash
./setup-env.sh
```

This script will:
- Create Python virtual environments for backend and database components
- Install all dependencies (npm packages and pip requirements)
- Copy `.env` file from the project root across all components
- Verify prerequisites and system compatibility

### 3. Configuration

Edit the root `.env` file with your actual configuration:

```bash
# Copy from template if not already created
cp env.example .env

# Edit with your settings
vim .env  # or your preferred editor
```

#### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `databricks_postgres` |
| `DB_USER` | Database username | `your_username` |
| `DB_PASSWORD` | Database password | `your_password` |
| `DATABRICKS_HOST` | Databricks workspace URL | `https://your-workspace.cloud.databricks.com` |
| `DATABRICKS_TOKEN` | Personal access token / PAT (optional) | `your_token` |
| `DATABRICKS_CLIENT_ID` | Databricks client id (instead of PAT) (optional) | `your_client_id` |
| `DATABRICKS_CLIENT_SECRET` | Databricks client id (instead of PAT) (optional) | `your_client_secret` |

> NB - we recommend running `setup-env.sh` if any modifications are made to the environment file

### 4. Database Setup

#### Create Database Service Account (Recommended)

We recommend creating a dedicated service account for database interactions:

```sql
-- Create dedicated service account
CREATE USER api_service_account WITH 
    ENCRYPTED PASSWORD 'SomeSecurePassword123'
    LOGIN
    NOCREATEDB 
    NOCREATEROLE;

-- Grant database connection
GRANT CONNECT ON DATABASE databricks_postgres TO api_service_account;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO api_service_account;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO api_service_account;

-- Grant sequence permissions (for auto-increment columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO api_service_account;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO api_service_account;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT USAGE, SELECT ON SEQUENCES TO api_service_account;
```

Update your `.env` file to use the service account credentials:
```bash
DB_USER=api_service_account
DB_PASSWORD=SomeSecurePassword123
```

#### Initialize Database with Demo Data

Initialize the database with demo data:

```bash
cd database
source venv/bin/activate
python demo_setup.py
```

This creates all necessary tables and populates them with realistic demo data including:
- 50+ beverage products across multiple categories
- 20+ store locations across 4 US regions  
- 240K+ orders with realistic approval workflows
- User accounts for store and regional managers

### 5. Start Development Environment

Launch both frontend and backend servers:

```bash
./start-dev.sh
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 🔐 Production Deployment with Databricks

### Setting Up Databricks Secrets

For production deployment, database credentials are managed through Databricks secrets.  
Set up the required secrets using the Databricks CLI as follows:

```bash
# Create secret scope
databricks secrets create-scope brickhouse-scope --profile <my-profile>

# Set database credentials as secrets
databricks secrets put-secret brickhouse-scope db_host --string-value "your-db-host" --profile <my-profile>
databricks secrets put-secret brickhouse-scope db_user --string-value "your-db-username" --profile <my-profile>
databricks secrets put-secret brickhouse-scope db_password --string-value "your-db-password" --profile <my-profile>

# Verify secrets are created
databricks secrets list-secrets brickhouse-scope --profile <my-profile>
```

### Deploy to Databricks Apps

Use the automated deployment script:

```bash
# Deploy app under given Databricks CLI profile and prod target via Databricks Asset Bundles.
./deploy.sh --profile my-profile --target prod
```

The deployment script automatically:
1. Builds the React frontend for production
2. Copies frontend assets to backend static files
3. Deploys the application bundle to Databricks
4. Starts the application using Databricks Apps

## 📁 Project Structure

```
brickhouse-brands-demo/
├── frontend/              # React + TypeScript frontend
│   ├── src/              # Source code
│   ├── dist/             # Production build output
│   └── package.json      # Frontend dependencies
├── backend/              # FastAPI backend
│   ├── app/              # Application modules
│   ├── static/           # Frontend assets (after build)
│   ├── main.py           # FastAPI application
│   └── requirements.txt  # Python dependencies
├── database/             # Database setup and management
│   ├── demo_setup.py     # Database initialization script
│   └── requirements.txt  # Database tool dependencies
├── setup-env.sh          # Environment setup script
├── start-dev.sh          # Development server startup
├── deploy.sh             # Production deployment script
├── databricks.yml        # Databricks bundle configuration
└── env.example          # Environment variables template
```

## 🛠️ Development

Each component has its own focused README with specific development instructions:

- **Frontend**: See `frontend/README.md` for React development details
- **Backend**: See `backend/README.md` for FastAPI API documentation  
- **Database**: See `database/README.md` for schema and setup details

### Local Development Commands

```bash
# Setup everything
./setup-env.sh

# Start development servers
./start-dev.sh

# Manual component startup
cd backend && source venv/bin/activate && python startup.py
cd frontend && npm run dev

# Database setup and data generation
cd database && source venv/bin/activate && python demo_setup.py --dry-run
```

## 📈 Future Considerations

This demo application provides a solid foundation for:

- **Custom Business Logic**: Extend the API with your specific requirements
- **Enhanced Analytics**: Add more sophisticated reporting and dashboards  
- **Integration**: Connect with external systems and third-party APIs
- **Scaling**: Deploy across multiple Databricks workspaces or cloud providers
- **Authentication**: Advanced user management via On-Behalf-Of Auth workflow and Unity Catalog governed tables

## ℹ️ How to get help

Databricks support doesn't cover this content. For questions or bugs, please open a GitHub issue and the team will help on a best effort basis. Contributions are more than welcome!

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run the setup script to configure your development environment
4. Make your changes and test thoroughly
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

&copy; 2025 Databricks, Inc. All rights reserved. The source in this repository is provided subject to the Databricks License [https://databricks.com/db-license-source].  All included or referenced third party libraries are subject to the licenses set forth below.

| library                                | description             | license    | source                                              |
| fastapi | Modern, fast web framework for building APIs with Python | MIT | https://github.com/tiangolo/fastapi |
| pydantic | Data validation using Python type annotations (FastAPI dependency) | MIT | https://github.com/pydantic/pydantic |
| starlette | Lightweight ASGI framework (FastAPI dependency) | BSD 3-Clause | https://github.com/encode/starlette |
| httpx | Modern HTTP client for Python (FastAPI dependency) | BSD 3-Clause | https://github.com/encode/httpx |
| uvicorn | Lightning-fast ASGI server (FastAPI dependency) | BSD 3-Clause | https://github.com/encode/uvicorn |
