# PostgreSQL Traffic Simulator

A high-performance Rust application designed to simulate realistic database traffic patterns against a PostgreSQL database. This tool is specifically built to work with the Brickhouse Brands demo data model created by the `demo_setup.py` script.

## Overview

The traffic simulator generates realistic database load by executing various types of queries (SELECT, INSERT, UPDATE) against a PostgreSQL database containing beverage industry order management data. It supports both maximum throughput testing and real-world traffic pattern simulation.

## Features

### 🚀 **Core Simulation Capabilities**
- **Multiple Query Types**: Execute SELECT, INSERT, UPDATE, or mixed workloads
- **Concurrent Connections**: Configure connection pool sizes for realistic concurrent load
- **Duration-Based Execution**: Run simulations for specified time periods
- **Warmup Periods**: Allow database and connection pool warmup before measurement

### 🌊 **Real-World Traffic Patterns**
- **Business Hours Simulation**: Gradual ramp-up, steady daytime traffic, and ramp-down
- **E-Commerce Rush Simulation**: Sudden traffic spikes with calm periods
- **Nightly Batch Simulation**: Low activity with periodic high-intensity bursts
- **Traffic Intensity Levels**: Low (10-30%), Medium (40-70%), High (80-95%), Peak (95-100%)

### 📊 **Performance Metrics**
- **Throughput**: Queries per second (QPS)
- **Latency Analysis**: Min, max, average, P50, P95, P99 latencies
- **Connection Efficiency**: Connection acquisition vs. query execution time
- **Network Baseline**: Separate network latency from database processing time
- **Success/Failure Rates**: Track query success and failure counts

### 🎯 **Database Operations**

The simulator performs realistic operations on the Brickhouse Brands data model:

#### SELECT Operations
- Primary key lookups on the `orders` table
- Realistic order ID ranges to simulate production access patterns
- Indexed queries for optimal performance testing

#### INSERT Operations
- Create new orders with realistic data patterns
- Automatic order number generation with conflict resolution
- Retry logic for handling duplicate key violations
- UUID-based fallback for ultimate uniqueness

#### UPDATE Operations
- **Order Approval Workflow**: Update pending orders to approved status
- **Order Fulfillment**: Transition approved orders to fulfilled
- **Inventory Adjustments**: Modify order quantities for pending orders
- Realistic workflow state transitions matching business processes

## Installation

### Prerequisites
- Rust 1.70+ installed
- Access to a PostgreSQL database with the Brickhouse Brands schema
- Network connectivity to the target database

### Building the Application
```bash
cd traffic-simulator
cargo build --release
```

## Usage

### Basic Usage
```bash
# Run a basic simulation with default settings
cargo run -- --database-url "postgresql://user:password@host:port/database"

# Run with specific parameters
cargo run -- \
  --database-url "postgresql://user:password@host:port/database" \
  --connections 50 \
  --duration 300 \
  --query-type mixed
```

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `--database-url` | PostgreSQL connection string | `postgresql://username:password@localhost/postgres?sslmode=disable` |
| `--connections` | Number of concurrent connections | 100 |
| `--duration` | Simulation duration in seconds | 60 |
| `--query-type` | Type of queries: `select`, `insert`, `update`, `mixed` | `select` |
| `--total-queries` | Total number of queries (optional) | None (unlimited) |
| `--duration-only` | Run only for specified duration, ignore query count | false |
| `--warmup` | Warmup period in seconds | 10 |
| `--measure-network` | Measure baseline network latency | false |
| `--real-simulation` | Enable realistic traffic patterns | false |
| `--disable-logging` | Disable detailed logging output | false |

### Example Commands

#### Maximum Throughput Testing
```bash
# Test maximum SELECT throughput
cargo run -- \
  --database-url "postgresql://user:pass@host:5432/db" \
  --connections 100 \
  --duration 300 \
  --query-type select \
  --warmup 30

# Test mixed workload with high concurrency
cargo run -- \
  --database-url "postgresql://user:pass@host:5432/db" \
  --connections 200 \
  --duration 600 \
  --query-type mixed \
  --measure-network
```

#### Real-World Traffic Simulation
```bash
# Simulate realistic business patterns
cargo run -- \
  --database-url "postgresql://user:pass@host:5432/db" \
  --connections 50 \
  --duration 1800 \
  --real-simulation \
  --query-type mixed

# E-commerce style traffic with spikes
cargo run -- \
  --database-url "postgresql://user:pass@host:5432/db" \
  --connections 100 \
  --duration 3600 \
  --real-simulation \
  --disable-logging
```

### Using the Convenience Script
```bash
# Edit the database URL in run_simulation.sh first
chmod +x run_simulation.sh
./run_simulation.sh
```

## Traffic Patterns

### Business Hours Pattern
- **Phase 1**: Gradual morning ramp-up (15% of duration, low to medium intensity)
- **Phase 2**: Steady business hours (60% of duration, medium to high intensity)
- **Phase 3**: Afternoon wind-down (25% of duration, medium to low intensity)

### E-Commerce Rush Pattern
- **Phase 1**: Normal baseline (40% of duration, low intensity)
- **Phase 2**: Traffic spike (30% of duration, peak intensity with high variance)
- **Phase 3**: Post-spike calm (30% of duration, low to medium intensity)

### Nightly Batch Pattern
- **Phase 1**: Low background activity (70% of duration, low intensity)
- **Phase 2**: Batch processing burst (20% of duration, high intensity)
- **Phase 3**: Processing cooldown (10% of duration, medium intensity)

## Output Metrics

We ran the simulation script on an AWS EC2 instance (m6in.4xlarge) against a Lakebase Postgres instance in the same region (us-west-2); results are shown in the stdout below.
> ⚠️ Please be advised that these results are for information purposes only and do not represent official performance results of Lakebase PostgreSQL.

```
===============================================
📊 Query Statistics:
   Total Queries:           628,800
   Successful:              628,800
   Failed:                        0
   Success Rate:            100.00%

⚡ Operational Performance:
   Duration:                 30.01s
   Queries/Second:        20,955.69
   Concurrent Sessions:         150
   Connection Efficiency:     99.8%

📈 Latency Breakdown (ms):
   Total Average:             4.35
   Minimum:                   2.80
   Maximum:                 219.52
   50th Percentile:           4.47
   95th Percentile:           5.38
   99th Percentile:           5.64

🎯 Operational Assessment:
   🚀 EXCEPTIONAL: <10ms DB processing time!
   🔥 HIGH THROUGHPUT: >100 QPS achieved
   ⚡ EFFICIENT: 99% query vs connection time

💡 Operational Insights:
   • Database handles 150 concurrent operational sessions
   • Sustained 20,955 queries/second under load
   • 99% of queries complete within 5.6ms
===============================================
```

## Database Schema Requirements

This simulator is designed to work with the Brickhouse Brands data model. Ensure your database has:

### Required Tables
- **`orders`**: Core orders table with columns:
  - `order_id` (Primary Key)
  - `order_number` (Unique)
  - `to_store_id`, `product_id`, `quantity_cases`
  - `order_status` ('pending_review', 'approved', 'fulfilled', 'cancelled')
  - `requested_by`, `approved_by`
  - `order_date`, `approved_date`, `fulfilled_date`

### Required Indexes
- Primary key on `order_id`
- Unique index on `order_number`
- Index on `order_status` for workflow queries
- Index on `to_store_id` for store-based queries

## Performance Considerations

### Connection Pool Sizing
- Start with 50-100 connections for most databases
- Monitor connection pool utilization in database
- Adjust based on your database's `max_connections` setting

### Query Distribution
- **SELECT**: 60% of mixed workload (read-heavy, typical of most applications)
- **INSERT**: 25% of mixed workload (new order creation)
- **UPDATE**: 15% of mixed workload (order status transitions)

### Resource Usage

To measure actual resource usage for your specific configuration, use these commands:

**Memory Usage:**
```bash
# Run simulation and monitor memory in another terminal
./run_simulation.sh &
SIM_PID=$!
while kill -0 $SIM_PID 2>/dev/null; do
  ps -p $SIM_PID -o pid,vsz,rss,pcpu,comm
  sleep 5
done
echo "Simulation finished"
```

**Detailed Resource Monitoring:**
```bash
# Monitor CPU and memory during simulation run
./run_simulation.sh &
SIM_PID=$!

# On macOS
top -pid $SIM_PID -l 0 &
TOP_PID=$!

# On Linux (alternative)
# htop -p $SIM_PID &
# TOP_PID=$!

# Wait for simulation to finish, then stop monitoring
wait $SIM_PID
kill $TOP_PID 2>/dev/null
echo "Monitoring stopped"
```

**Network Usage with Auto-Stop:**
```bash
# Method 1: Monitor for duration of simulation
timeout 35s netstat -i 1 & ./run_simulation.sh

# Method 2: More controlled approach
./run_simulation.sh &
SIM_PID=$!
netstat -i 1 &
NET_PID=$!
wait $SIM_PID  # Wait for simulation to finish
kill $NET_PID 2>/dev/null  # Stop network monitoring
echo "Network monitoring stopped"
```

**All-in-One Monitoring:**
```bash
# Single command that monitors everything and auto-stops
./run_simulation.sh &
SIM_PID=$!
echo "Monitoring simulation (PID: $SIM_PID)..."
while kill -0 $SIM_PID 2>/dev/null; do
  echo "$(date '+%H:%M:%S') - $(ps -p $SIM_PID -o rss=,pcpu= | awk '{printf "Memory: %dMB, CPU: %.1f%%", $1/1024, $2}')"
  sleep 5
done
echo "✅ Simulation completed"
```

Typical resource usage will vary significantly based on:
- Connection count (more connections = more memory per connection pool)
- Query rate and complexity
- Network latency to database
- System architecture and available resources

## Troubleshooting

### Common Issues

**Connection Failures**
```
Error: Failed to create connection pool
```
- Verify database URL format and credentials
- Check network connectivity to database
- Ensure database accepts the specified number of connections

**Query Failures**
```
Error: Database error: relation "orders" does not exist
```
- Run the `demo_setup.py` script to create the required schema
- Verify you're connecting to the correct database/schema

**High Latency**
- Check network latency with `--measure-network`
- Monitor database CPU and I/O utilization
- Consider reducing connection count if overwhelming the database

### Performance Tuning

**For Maximum Throughput**
- Use `--query-type select` (fastest operations)
- Increase `--connections` gradually while monitoring database
- Use `--disable-logging` to reduce overhead

**For Realistic Testing**
- Enable `--real-simulation` for varying load patterns
- Use `--query-type mixed` for balanced workload
- Set appropriate `--duration` for pattern completion

## Development

### Building from Source
```bash
git clone <repository>
cd traffic-simulator
cargo build --release
```

### Running Tests
```bash
cargo test
```

### Adding New Query Patterns
The simulator is designed to be extensible. To add new query patterns:

1. Extend the `QueryType` enum
2. Add handling in `execute_operational_query()`
3. Implement the specific query logic
4. Update the mixed workload distribution

## Contributing

When contributing to this simulator:

1. Maintain realistic query patterns that reflect actual business operations
2. Ensure new features work with the existing data model
3. Add appropriate error handling and retry logic
4. Update documentation for new configuration options

## License

See the project root LICENSE.md for license information. 