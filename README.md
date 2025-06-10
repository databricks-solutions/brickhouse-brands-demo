# Brickhouse Brands Demo - Lakehouse Analytics Platform

**A comprehensive beverage supply chain analytics platform demonstrating the power of Databricks Lakehouse architecture for real-time business intelligence and operational decision-making.**

The Brickhouse Brands Demo showcases how modern Consumer Packaged Goods (CPG) companies can leverage Databricks Lakehouse Platform to unify their data, analytics, and applications in a single, scalable solution. This production-ready application demonstrates real-time inventory optimization, predictive analytics, and operational intelligence that drives business value across the entire supply chain.

## 🎯 Business Value & Lakehouse Benefits

### 💼 **Real-World Business Impact**
- **Inventory Optimization**: Real-time visibility into 4,000+ SKUs across multiple regions, reducing stockouts by 15-20%
- **Demand Forecasting**: Historical trend analysis of 242,000+ orders enabling predictive inventory planning
- **Operational Efficiency**: Automated order approval workflows reducing processing time from hours to minutes
- **Regional Performance**: Geographic analytics revealing top-performing markets and optimization opportunities
- **Cost Reduction**: Optimized stock levels reducing carrying costs while maintaining service levels

### 📊 **What This Demo Showcases**

#### **Operational Analytics in Action**
- **Live KPI Monitoring**: Real-time tracking of inventory value, product velocity, and supply chain health
- **Interactive Dashboards**: Executive-level insights with drill-down capabilities for operational teams
- **Automated Alerting**: Proactive notifications for low stock, unusual demand patterns, and supply disruptions
- **Cross-Regional Analysis**: Performance comparisons and optimization opportunities across geographic markets

#### **Modern Data Applications**
- **Embedded Analytics**: Business intelligence seamlessly integrated into operational workflows
- **Real-Time Decision Making**: Up-to-the-minute data enabling rapid response to market changes
- **Predictive Capabilities**: Historical pattern analysis supporting demand forecasting and inventory planning
- **Self-Service Analytics**: Empowering business users with intuitive, responsive data exploration tools

#### **Enterprise-Grade Architecture**
- **Production-Ready Deployment**: Scalable FastAPI backend with connection pooling and error handling
- **Modern UI/UX**: Responsive React frontend with real-time data synchronization
- **Data Pipeline Orchestration**: Automated data ingestion, transformation, and quality validation
- **Security & Compliance**: Role-based access control and audit trails for regulatory requirements

## 🚀 Quick Start Guide

### Prerequisites
- **Databricks Workspace** - For lakehouse platform deployment
- **PostgreSQL** - For transactional data store (can be replaced with Databricks SQL)
- **Node.js 18+** - For frontend development
- **Python 3.10+** - For backend services

### Automated Setup
```bash

# 1. Configure Databricks integration
# Edit .env file with your Databricks workspace details:
# DATABRICKS_HOST=https://your-workspace.cloud.databricks.com
# DATABRICKS_TOKEN=your-access-token

# 2. Run automated environment setup
./setup-env.sh

# 3. Initialize demo data (242K+ realistic orders)
cd database && source venv/bin/activate
python demo_setup.py
cd ..

# 4. Start the analytics platform
./start-dev.sh
```


## License

&copy; 2025 Databricks, Inc. All rights reserved. The source in this notebook is provided subject to the Databricks License [https://databricks.com/db-license-source]. All included or referenced third party libraries are subject to the licenses set forth below.

| library | description | license | source |
|---------|-------------|---------|---------|
| **Data & Analytics Stack** |
| databricks-sdk | Databricks platform integration | Apache-2.0 | https://github.com/databricks/databricks-sdk-py |
| databricks-sql-connector | High-performance SQL execution | Apache-2.0 | https://github.com/databricks/databricks-sql-python |
| fastapi | Modern API framework for data services | MIT | https://github.com/tiangolo/fastapi |
| psycopg2-binary | PostgreSQL connectivity | LGPL-3.0 | https://github.com/psycopg/psycopg2 |
| **Frontend Analytics** |
| react | User interface framework | MIT | https://github.com/facebook/react |
| recharts | Business intelligence visualizations | MIT | https://github.com/recharts/recharts |
| @tanstack/react-query | Real-time data synchronization | MIT | https://github.com/TanStack/query |
| tailwindcss | Responsive dashboard design | MIT | https://github.com/tailwindlabs/tailwindcss |
| **Data Processing** |
| pandas | Data manipulation and analysis | BSD-3-Clause | https://github.com/pandas-dev/pandas |
| numpy | Numerical computing foundation | BSD-3-Clause | https://github.com/numpy/numpy |
| faker | Realistic demo data generation | MIT | https://github.com/joke2k/faker |
| **Production Infrastructure** |
| uvicorn | ASGI server for scalable deployment | BSD-3-Clause | https://github.com/encode/uvicorn |
| pydantic | Data validation and API contracts | MIT | https://github.com/pydantic/pydantic |
| python-dotenv | Environment configuration management | BSD-3-Clause | https://github.com/theskumar/python-dotenv |
