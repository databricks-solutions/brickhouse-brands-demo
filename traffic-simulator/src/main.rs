use clap::Parser;
use deadpool_postgres::{ManagerConfig, Pool, RecyclingMethod, Runtime};
use futures::future::join_all;
use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};
use rand_distr::{Distribution, Normal};
use serde::Serialize;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Semaphore;
use tokio_postgres::{Config, Row};
use tracing::{info, warn};
use uuid;

/// PostgreSQL Traffic Simulator Tool for Orders Table with Network Latency Analysis
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Database connection string
    #[arg(
        short,
        long,
        default_value = "postgresql://username:password@localhost/postgres?sslmode=disable"
    )]
    database_url: String,

    /// Number of concurrent connections
    #[arg(short, long, default_value_t = 100)]
    connections: usize,

    /// Total number of queries to execute (ignored if --duration-only is set, omit for indefinite run)
    #[arg(short, long)]
    total_queries: Option<usize>,

    /// Query type to simulate
    #[arg(short, long, value_enum, default_value_t = QueryType::Select)]
    query_type: QueryType,

    /// Duration to run the simulation (in seconds)
    #[arg(short = 'D', long, default_value_t = 60)]
    duration: u64,

    /// Run for the configured duration only, ignoring query count limit (works with --duration)
    #[arg(long, default_value_t = false)]
    duration_only: bool,

    /// Warmup period (in seconds)
    #[arg(short, long, default_value_t = 10)]
    warmup: u64,

    /// Measure baseline network latency
    #[arg(long, default_value_t = false)]
    measure_network: bool,

    /// Enable real-world simulation with varying traffic patterns
    #[arg(long, default_value_t = false)]
    real_simulation: bool,

    /// Disable detailed logging output
    #[arg(long, default_value_t = false)]
    disable_logging: bool,
}

#[derive(clap::ValueEnum, Clone, Debug)]
enum QueryType {
    Select,
    Insert,
    Update,
    Mixed,
}

#[derive(Debug, Serialize)]
struct SimulationResult {
    total_queries: usize,
    successful_queries: usize,
    failed_queries: usize,
    duration_seconds: f64,
    queries_per_second: f64,
    average_latency_ms: f64,
    min_latency_ms: f64,
    max_latency_ms: f64,
    p50_latency_ms: f64,
    p95_latency_ms: f64,
    p99_latency_ms: f64,
    concurrent_connections: usize,
    baseline_network_latency_ms: f64,
    database_processing_time_ms: f64,
    connection_efficiency: f64,
}

#[derive(Debug)]
struct QueryMetric {
    latency: Duration,
    success: bool,
    connection_time: Duration,
    query_execution_time: Duration,
}

#[derive(Debug, Clone)]
enum TrafficIntensity {
    Low,    // 10-30% of max throughput
    Medium, // 40-70% of max throughput
    High,   // 80-95% of max throughput
    Peak,   // 95-100% of max throughput
}

#[derive(Debug, Clone)]
enum TrafficPattern {
    BusinessHours, // Gradual ramp up, steady during day, ramp down
    ECommerceRush, // Sudden spikes with periods of calm
    NightlyBatch,  // Low activity with periodic high bursts
}

#[derive(Debug, Clone)]
enum TrendDirection {
    Up,   // Gradually increase during phase
    Down, // Gradually decrease during phase
    Flat, // Stay relatively constant
}

#[derive(Debug)]
struct TrafficPhase {
    intensity: TrafficIntensity,
    duration_percent: f64,        // Percentage of total duration
    qps_variance_std: f64, // Standard deviation for QPS variance (0.0 = no variance, 0.3 = high variance)
    connection_variance_std: f64, // Standard deviation for connection count variance
    qps_trend: TrendDirection, // Whether QPS should trend up, down, or stay flat during phase
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();

    // Initialize tracing conditionally
    if !args.disable_logging {
        tracing_subscriber::fmt::init();
    }

    // Note: For indefinite runs (when --total-queries is omitted),
    // the simulation will run until the duration limit is reached or
    // the process is interrupted (Ctrl+C)

    if args.disable_logging {
        println!("Starting simulation...");
    } else {
        info!("🚀 Starting PostgreSQL Operational Performance Simulation");
        info!("Database URL: {}", mask_password(&args.database_url));
        info!("Concurrent connections: {}", args.connections);

        match args.total_queries {
            Some(total) => info!("Total queries: {}", total),
            None => info!("Total queries: INDEFINITE (run until Ctrl+C)"),
        }

        info!("Query type: {:?}", args.query_type);
        info!("Duration: {} seconds", args.duration);

        if args.duration_only {
            info!("Mode: Duration-only (ignoring query count limit)");
        } else if args.total_queries.is_none() {
            info!("Mode: Indefinite (run until Ctrl+C or duration limit)");
        } else {
            info!("Mode: Limited by duration OR query count");
        }

        if args.real_simulation {
            info!("🌊 Real-world simulation enabled - varying traffic patterns");
        } else {
            info!("🚀 Maximum throughput mode - constant high load");
        }
    }

    // Measure baseline network latency if requested
    let baseline_latency = if args.measure_network {
        if !args.disable_logging {
            info!("📡 Measuring baseline network latency...");
        }
        measure_baseline_latency(&args.database_url, args.disable_logging).await?
    } else {
        0.0
    };

    if baseline_latency > 0.0 && !args.disable_logging {
        info!("📡 Baseline network latency: {:.2}ms", baseline_latency);
    }

    // Create connection pool
    if !args.disable_logging {
        info!("📊 Creating connection pool...");
    }
    let pool = create_connection_pool(&args.database_url, args.connections).await?;
    if !args.disable_logging {
        info!(
            "✅ Connection pool created with {} connections",
            args.connections
        );
    }

    // Test connection pool
    test_connection_pool(&pool).await?;

    // Run warmup
    if args.warmup > 0 {
        run_warmup(&pool, &args).await?;
    }

    // Run main simulation
    let result = if args.real_simulation {
        info!("🚀 Starting operational performance simulation...");
        run_real_world_simulation(&pool, &args, baseline_latency).await?
    } else {
        info!("🚀 Starting operational performance simulation...");
        run_operational_simulation(&pool, &args, baseline_latency).await?
    };

    display_operational_results(&result);

    Ok(())
}

async fn measure_baseline_latency(
    database_url: &str,
    disable_logging: bool,
) -> anyhow::Result<f64> {
    // Extract host from database URL
    let config = database_url.parse::<Config>()?;
    let host = config.get_hosts().first().unwrap().clone();
    let hostname = match host {
        tokio_postgres::config::Host::Tcp(ref h) => h,
        _ => return Ok(0.0),
    };

    // Simple TCP connection time measurement (simulating ping)
    let mut total_latency = 0.0;
    let ping_count = 5;

    for _ in 0..ping_count {
        let start = Instant::now();

        // Try to establish basic TCP connection
        match tokio::net::TcpStream::connect((hostname.as_str(), 5432)).await {
            Ok(_) => {
                total_latency += start.elapsed().as_secs_f64() * 1000.0;
            }
            Err(_) => {
                if !disable_logging {
                    warn!("Failed to measure network latency via TCP ping");
                }
                return Ok(0.0);
            }
        }

        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    Ok(total_latency / ping_count as f64)
}

async fn create_connection_pool(
    database_url: &str,
    max_connections: usize,
) -> anyhow::Result<Pool> {
    // Parse the database URL
    let pg_config = database_url.parse::<Config>()?;

    // Create TLS connector
    let tls_connector = TlsConnector::new()?;
    let tls = MakeTlsConnector::new(tls_connector);

    // Create manager config with optimized settings
    let mgr_config = ManagerConfig {
        recycling_method: RecyclingMethod::Fast,
    };

    // Create pool with optimized settings for low latency
    let pool = Pool::builder(deadpool_postgres::Manager::from_config(
        pg_config, tls, mgr_config,
    ))
    .max_size(max_connections)
    .runtime(Runtime::Tokio1)
    .wait_timeout(Some(std::time::Duration::from_millis(100))) // Fail fast instead of waiting
    .create_timeout(Some(std::time::Duration::from_millis(500))) // Quick connection creation
    .recycle_timeout(Some(std::time::Duration::from_millis(100))) // Fast recycling
    .build()?;

    Ok(pool)
}

async fn test_connection_pool(pool: &Pool) -> anyhow::Result<()> {
    let client = pool.get().await?;
    let _rows = client.query("SELECT 1", &[]).await?;
    Ok(())
}

async fn run_warmup(pool: &Pool, args: &Args) -> anyhow::Result<()> {
    let warmup_queries = args.connections * 5; // 5 queries per connection for warmup
    let semaphore = Arc::new(Semaphore::new(args.connections));
    let disable_logging = args.disable_logging;

    let tasks = (0..warmup_queries).map(|i| {
        let pool = pool.clone();
        let semaphore = Arc::clone(&semaphore);
        let query_type = args.query_type.clone();
        let seed = i as u64;

        tokio::spawn(async move {
            let _permit = semaphore.acquire().await.unwrap();
            let _ =
                execute_operational_query_with_timing(&pool, &query_type, seed, disable_logging)
                    .await;
        })
    });

    join_all(tasks).await;
    tokio::time::sleep(Duration::from_secs(1)).await; // Brief pause after warmup

    Ok(())
}

async fn run_operational_simulation(
    pool: &Pool,
    args: &Args,
    baseline_latency: f64,
) -> anyhow::Result<SimulationResult> {
    let start_time = Instant::now();
    let end_time = start_time + Duration::from_secs(args.duration);
    let semaphore = Arc::new(Semaphore::new(args.connections));
    let disable_logging = args.disable_logging;

    let mut query_count = 0;
    let mut tasks = Vec::new();
    let mut metrics = Vec::new();

    // Run operational queries until time limit
    while Instant::now() < end_time
        && (args.duration_only || query_count < args.total_queries.unwrap_or(usize::MAX))
    {
        let pool = pool.clone();
        let semaphore = Arc::clone(&semaphore);
        let query_type = args.query_type.clone();
        let seed = query_count as u64;

        let task = tokio::spawn(async move {
            let _permit = semaphore.acquire().await.unwrap();
            execute_operational_query_with_timing(&pool, &query_type, seed, disable_logging).await
        });

        tasks.push(task);
        query_count += 1;

        // Batch execute tasks
        if tasks.len() >= args.connections
            || (!args.duration_only
                && args
                    .total_queries
                    .map_or(false, |total| query_count >= total))
        {
            let batch_results = join_all(tasks).await;
            for result in batch_results {
                if let Ok(metric) = result {
                    metrics.push(metric);
                }
            }
            tasks = Vec::new();
        }
    }

    // Execute remaining tasks
    if !tasks.is_empty() {
        let batch_results = join_all(tasks).await;
        for result in batch_results {
            if let Ok(metric) = result {
                metrics.push(metric);
            }
        }
    }

    let total_duration = start_time.elapsed();

    // Calculate operational performance metrics
    calculate_operational_result(metrics, total_duration, args.connections, baseline_latency)
}

async fn run_real_world_simulation(
    pool: &Pool,
    args: &Args,
    baseline_latency: f64,
) -> anyhow::Result<SimulationResult> {
    let start_time = Instant::now();
    let total_duration = Duration::from_secs(args.duration);

    // Choose a traffic pattern based on duration
    let pattern = if args.duration <= 30 {
        TrafficPattern::ECommerceRush // Short duration - show dramatic variations
    } else if args.duration <= 120 {
        TrafficPattern::BusinessHours // Medium duration - business day simulation
    } else {
        TrafficPattern::NightlyBatch // Long duration - show batch processing patterns
    };

    if !args.disable_logging {
        info!("🌊 Using traffic pattern: {:?}", pattern);
    }

    let phases = generate_traffic_phases(&pattern);
    let mut all_metrics = Vec::new();

    for (phase_idx, phase) in phases.iter().enumerate() {
        let phase_duration =
            Duration::from_secs_f64(total_duration.as_secs_f64() * phase.duration_percent);
        if !args.disable_logging {
            info!(
                "📈 Phase {}: {:?} intensity for {:.1}s",
                phase_idx + 1,
                phase.intensity,
                phase_duration.as_secs_f64()
            );
        }

        let phase_metrics =
            run_traffic_phase(pool, args, phase, phase_duration, start_time.elapsed()).await?;
        all_metrics.extend(phase_metrics);

        // Small pause between phases to simulate real-world transitions
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    let total_elapsed = start_time.elapsed();
    calculate_operational_result(
        all_metrics,
        total_elapsed,
        args.connections,
        baseline_latency,
    )
}

fn generate_traffic_phases(pattern: &TrafficPattern) -> Vec<TrafficPhase> {
    match pattern {
        TrafficPattern::BusinessHours => vec![
            TrafficPhase {
                intensity: TrafficIntensity::Low,
                duration_percent: 0.15,
                qps_variance_std: 0.2,
                connection_variance_std: 0.3,
                qps_trend: TrendDirection::Up,
            }, // Morning ramp-up
            TrafficPhase {
                intensity: TrafficIntensity::Medium,
                duration_percent: 0.25,
                qps_variance_std: 0.3,
                connection_variance_std: 0.4,
                qps_trend: TrendDirection::Flat,
            }, // Morning activity
            TrafficPhase {
                intensity: TrafficIntensity::High,
                duration_percent: 0.30,
                qps_variance_std: 0.4,
                connection_variance_std: 0.5,
                qps_trend: TrendDirection::Up,
            }, // Peak hours
            TrafficPhase {
                intensity: TrafficIntensity::Medium,
                duration_percent: 0.20,
                qps_variance_std: 0.3,
                connection_variance_std: 0.4,
                qps_trend: TrendDirection::Down,
            }, // Afternoon
            TrafficPhase {
                intensity: TrafficIntensity::Low,
                duration_percent: 0.10,
                qps_variance_std: 0.2,
                connection_variance_std: 0.3,
                qps_trend: TrendDirection::Flat,
            }, // End of day
        ],
        TrafficPattern::ECommerceRush => vec![
            TrafficPhase {
                intensity: TrafficIntensity::Low,
                duration_percent: 0.20,
                qps_variance_std: 0.8,
                connection_variance_std: 0.9,
                qps_trend: TrendDirection::Flat,
            }, // Quiet period
            TrafficPhase {
                intensity: TrafficIntensity::Peak,
                duration_percent: 0.15,
                qps_variance_std: 0.2,
                connection_variance_std: 0.3,
                qps_trend: TrendDirection::Up,
            }, // Flash sale spike
            TrafficPhase {
                intensity: TrafficIntensity::Medium,
                duration_percent: 0.25,
                qps_variance_std: 0.6,
                connection_variance_std: 0.7,
                qps_trend: TrendDirection::Flat,
            }, // Post-spike activity
            TrafficPhase {
                intensity: TrafficIntensity::Low,
                duration_percent: 0.15,
                qps_variance_std: 0.4,
                connection_variance_std: 0.5,
                qps_trend: TrendDirection::Down,
            }, // Cooldown
            TrafficPhase {
                intensity: TrafficIntensity::High,
                duration_percent: 0.25,
                qps_variance_std: 0.5,
                connection_variance_std: 0.6,
                qps_trend: TrendDirection::Up,
            }, // Secondary spike
        ],
        TrafficPattern::NightlyBatch => vec![
            TrafficPhase {
                intensity: TrafficIntensity::Low,
                duration_percent: 0.40,
                qps_variance_std: 0.3,
                connection_variance_std: 0.4,
                qps_trend: TrendDirection::Flat,
            }, // Background activity
            TrafficPhase {
                intensity: TrafficIntensity::Peak,
                duration_percent: 0.20,
                qps_variance_std: 0.1,
                connection_variance_std: 0.2,
                qps_trend: TrendDirection::Up,
            }, // Batch processing
            TrafficPhase {
                intensity: TrafficIntensity::Low,
                duration_percent: 0.20,
                qps_variance_std: 0.2,
                connection_variance_std: 0.3,
                qps_trend: TrendDirection::Flat,
            }, // Recovery
            TrafficPhase {
                intensity: TrafficIntensity::High,
                duration_percent: 0.20,
                qps_variance_std: 0.4,
                connection_variance_std: 0.5,
                qps_trend: TrendDirection::Up,
            }, // Final batch
        ],
    }
}

async fn run_traffic_phase(
    pool: &Pool,
    args: &Args,
    phase: &TrafficPhase,
    phase_duration: Duration,
    elapsed_offset: Duration,
) -> anyhow::Result<Vec<QueryMetric>> {
    let start_time = Instant::now();
    let end_time = start_time + phase_duration;

    // Calculate base QPS and connections for this phase
    let max_qps = args.connections as f64 * 2.0;
    let base_qps = match phase.intensity {
        TrafficIntensity::Low => max_qps * 0.2,
        TrafficIntensity::Medium => max_qps * 0.55,
        TrafficIntensity::High => max_qps * 0.875,
        TrafficIntensity::Peak => max_qps * 0.975,
    };

    let max_connections = args.connections;
    let base_connections = match phase.intensity {
        TrafficIntensity::Low => (max_connections as f64 * 0.3) as usize,
        TrafficIntensity::Medium => (max_connections as f64 * 0.6) as usize,
        TrafficIntensity::High => (max_connections as f64 * 0.9) as usize,
        TrafficIntensity::Peak => max_connections,
    };

    // Create RNG for this phase
    let mut rng = StdRng::seed_from_u64(elapsed_offset.as_secs());

    // Create normal distributions for variance
    let qps_distribution = Normal::new(0.0, phase.qps_variance_std).unwrap();
    let connection_distribution = Normal::new(0.0, phase.connection_variance_std).unwrap();

    let mut tasks = Vec::new();
    let mut metrics = Vec::new();
    let mut query_count = 0;
    let mut last_adjustment = Instant::now();

    // Variables for current targets (adjusted every ~2 seconds)
    let mut current_qps = base_qps;
    let mut current_connections = base_connections;
    let mut current_semaphore = Arc::new(Semaphore::new(current_connections));
    let disable_logging = args.disable_logging;
    let query_type = args.query_type.clone();

    while Instant::now() < end_time {
        // Adjust QPS and connections every 2 seconds for realistic variation
        if last_adjustment.elapsed() >= Duration::from_secs(2) {
            let phase_progress = start_time.elapsed().as_secs_f64() / phase_duration.as_secs_f64();

            // Apply trend direction
            let trend_factor = match phase.qps_trend {
                TrendDirection::Up => 1.0 + (phase_progress * 0.5), // Ramp up to 150% by end
                TrendDirection::Down => 1.5 - (phase_progress * 0.5), // Ramp down from 150% to 100%
                TrendDirection::Flat => 1.0,                        // Stay constant
            };

            // Apply Gaussian variance to QPS
            let qps_variance = qps_distribution.sample(&mut rng);
            current_qps = (base_qps * trend_factor * (1.0 + qps_variance)).max(1.0);

            // Apply Gaussian variance to connections
            let connection_variance = connection_distribution.sample(&mut rng);
            current_connections = ((base_connections as f64) * (1.0 + connection_variance))
                .max(1.0)
                .min(max_connections as f64) as usize;

            // Update semaphore if connection count changed significantly
            if (current_connections as i32 - current_semaphore.available_permits() as i32).abs() > 5
            {
                current_semaphore = Arc::new(Semaphore::new(current_connections));

                if !disable_logging {
                    info!(
                        "📊 Adjusted traffic: {:.1} QPS, {} connections (trend: {:?})",
                        current_qps, current_connections, phase.qps_trend
                    );
                }
            }

            last_adjustment = Instant::now();
        }

        // Calculate delay for target QPS
        let query_interval = Duration::from_secs_f64(1.0 / current_qps);

        let pool = pool.clone();
        let query_type = query_type.clone();
        let seed = (elapsed_offset.as_secs() + query_count) as u64;

        let task = tokio::spawn(async move {
            // let _permit = semaphore.acquire().await.unwrap();
            execute_operational_query_with_timing(&pool, &query_type, seed, disable_logging).await
        });

        tasks.push(task);
        query_count += 1;

        // Process completed tasks periodically
        if tasks.len() >= (current_connections / 2).max(10) {
            let batch_results = join_all(tasks.drain(0..tasks.len().min(20))).await;
            for result in batch_results {
                if let Ok(metric) = result {
                    metrics.push(metric);
                }
            }
        }

        // Sleep to maintain target QPS
        tokio::time::sleep(query_interval).await;
    }

    // Process remaining tasks
    if !tasks.is_empty() {
        let batch_results = join_all(tasks).await;
        for result in batch_results {
            if let Ok(metric) = result {
                metrics.push(metric);
            }
        }
    }

    Ok(metrics)
}

async fn execute_operational_query_with_timing(
    pool: &Pool,
    query_type: &QueryType,
    seed: u64,
    disable_logging: bool,
) -> QueryMetric {
    let start = Instant::now();

    // Measure connection acquisition time
    let connection_start = Instant::now();
    let client_result = pool.get().await;
    let connection_time = connection_start.elapsed();

    let (success, query_execution_time) = match client_result {
        Ok(client) => {
            let query_start = Instant::now();
            let result = match execute_operational_query(&client, query_type, seed).await {
                Ok(_) => true,
                Err(e) => {
                    if !disable_logging {
                        warn!("Query failed: {}", e);
                    }
                    false
                }
            };
            (result, query_start.elapsed())
        }
        Err(e) => {
            if !disable_logging {
                warn!("Connection failed: {}", e);
            }
            (false, Duration::ZERO)
        }
    };

    let total_latency = start.elapsed();

    QueryMetric {
        latency: total_latency,
        success,
        connection_time,
        query_execution_time,
    }
}

async fn execute_operational_query(
    client: &deadpool_postgres::Client,
    query_type: &QueryType,
    seed: u64,
) -> anyhow::Result<Vec<Row>> {
    let rows = match query_type {
        QueryType::Select => execute_operational_select_query(&client, seed).await?,
        QueryType::Insert => execute_operational_insert_query(&client, seed).await?,
        QueryType::Update => execute_operational_update_query(&client, seed).await?,
        QueryType::Mixed => {
            let mut rng = StdRng::seed_from_u64(seed);
            match rng.gen_range(0..3) {
                0 => execute_operational_select_query(&client, seed).await?,
                1 => execute_operational_insert_query(&client, seed).await?,
                _ => execute_operational_update_query(&client, seed).await?,
            }
        }
    };

    Ok(rows)
}

async fn execute_operational_select_query(
    client: &deadpool_postgres::Client,
    seed: u64,
) -> anyhow::Result<Vec<Row>> {
    let mut rng = StdRng::seed_from_u64(seed);

    // Fast primary key lookup using indexed order_id column
    // Using larger range to reduce hot spots and contention
    let order_id = rng.gen_range(1..=100000i32);
    let rows = client.query(
        "SELECT order_id, order_number, order_status, quantity_cases FROM orders WHERE order_id = $1", 
        &[&order_id]
    ).await?;

    Ok(rows)
}

async fn execute_operational_insert_query(
    client: &deadpool_postgres::Client,
    seed: u64,
) -> anyhow::Result<Vec<Row>> {
    let mut rng = StdRng::seed_from_u64(seed);

    let to_store_id = rng.gen_range(1..=10i32);
    let product_id = rng.gen_range(1..=50i32);
    let quantity_cases = rng.gen_range(1..=20i32);
    let requested_by = rng.gen_range(1..=5i32);

    // Retry up to 5 times to handle duplicate key conflicts
    for attempt in 0..5 {
        // Generate a more unique order number using multiple components
        let timestamp_component = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        
        // Combine seed, attempt, and timestamp for better uniqueness
        let unique_component = (seed.wrapping_mul(1000) + attempt as u64 + (timestamp_component % 10000)) % 999999;
        let order_number = format!("ORD{:06}", unique_component + 1);

        // Attempt the insert
        match client.query(
            "INSERT INTO orders (order_number, to_store_id, product_id, quantity_cases, requested_by, order_status) 
             VALUES ($1, $2, $3, $4, $5, 'pending_review') RETURNING order_id, order_number",
            &[&order_number, &to_store_id, &product_id, &quantity_cases, &requested_by]
        ).await {
            Ok(rows) => return Ok(rows),
            Err(e) => {
                // Check if it's a duplicate key error
                if let Some(db_error) = e.as_db_error() {
                    if db_error.code() == &tokio_postgres::error::SqlState::UNIQUE_VIOLATION {
                        // If it's the last attempt, fall back to a different strategy
                        if attempt == 4 {
                            // Final attempt: use a UUID-based approach
                            let uuid_suffix = uuid::Uuid::new_v4().to_string().replace("-", "");
                            let unique_order_number = format!("ORD{}", &uuid_suffix[..8].to_uppercase());
                            
                            return client.query(
                                "INSERT INTO orders (order_number, to_store_id, product_id, quantity_cases, requested_by, order_status) 
                                 VALUES ($1, $2, $3, $4, $5, 'pending_review') RETURNING order_id, order_number",
                                &[&unique_order_number, &to_store_id, &product_id, &quantity_cases, &requested_by]
                            ).await.map_err(|e| anyhow::anyhow!("Failed to insert order after retries: {}", e));
                        }
                        // Otherwise, continue to next attempt
                        continue;
                    }
                }
                // If it's not a duplicate key error, return the error immediately
                return Err(anyhow::anyhow!("Database error: {}", e));
            }
        }
    }

    // This should never be reached due to the logic above, but just in case
    Err(anyhow::anyhow!("Failed to insert order after all retry attempts"))
}

async fn execute_operational_update_query(
    client: &deadpool_postgres::Client,
    seed: u64,
) -> anyhow::Result<Vec<Row>> {
    let mut rng = StdRng::seed_from_u64(seed);

    // Operational updates - workflow state changes
    let update_choice = rng.gen_range(0..3);

    let rows = match update_choice {
        0 => {
            // Approve pending orders (common workflow)
            client.query(
                "UPDATE orders SET order_status = 'approved', approved_date = CURRENT_TIMESTAMP 
                 WHERE order_status = 'pending_review' AND order_id IN (
                     SELECT order_id FROM orders WHERE order_status = 'pending_review' LIMIT 1
                 ) RETURNING order_id",
                &[]
            ).await?
        }
        1 => {
            // Fulfill approved orders
            client.query(
                "UPDATE orders SET order_status = 'fulfilled', fulfilled_date = CURRENT_TIMESTAMP 
                 WHERE order_status = 'approved' AND order_id IN (
                     SELECT order_id FROM orders WHERE order_status = 'approved' LIMIT 1
                 ) RETURNING order_id",
                &[]
            ).await?
        }
        _ => {
            // Update quantity (inventory adjustment)
            let order_id = rng.gen_range(1..=100000i32);
            let new_quantity = rng.gen_range(1..=25i32);
            client.query(
                "UPDATE orders SET quantity_cases = $1 WHERE order_id = $2 AND order_status = 'pending_review' RETURNING order_id",
                &[&new_quantity, &order_id]
            ).await?
        }
    };

    Ok(rows)
}

fn calculate_operational_result(
    metrics: Vec<QueryMetric>,
    total_duration: Duration,
    concurrent_connections: usize,
    baseline_latency: f64,
) -> anyhow::Result<SimulationResult> {
    let total_queries = metrics.len();
    let successful_queries = metrics.iter().filter(|m| m.success).count();
    let failed_queries = total_queries - successful_queries;

    if successful_queries == 0 {
        return Err(anyhow::anyhow!("No successful queries executed"));
    }

    let mut latencies: Vec<f64> = metrics
        .iter()
        .filter(|m| m.success)
        .map(|m| m.latency.as_secs_f64() * 1000.0)
        .collect();

    let mut connection_times: Vec<f64> = metrics
        .iter()
        .filter(|m| m.success)
        .map(|m| m.connection_time.as_secs_f64() * 1000.0)
        .collect();

    let query_execution_times: Vec<f64> = metrics
        .iter()
        .filter(|m| m.success)
        .map(|m| m.query_execution_time.as_secs_f64() * 1000.0)
        .collect();

    latencies.sort_by(|a, b| a.partial_cmp(b).unwrap());
    connection_times.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let duration_seconds = total_duration.as_secs_f64();
    let queries_per_second = successful_queries as f64 / duration_seconds;

    let average_latency_ms = latencies.iter().sum::<f64>() / latencies.len() as f64;
    let min_latency_ms = latencies.first().copied().unwrap_or(0.0);
    let max_latency_ms = latencies.last().copied().unwrap_or(0.0);

    let p50_index = (latencies.len() as f64 * 0.5) as usize;
    let p95_index = (latencies.len() as f64 * 0.95) as usize;
    let p99_index = (latencies.len() as f64 * 0.99) as usize;

    let p50_latency_ms = latencies.get(p50_index).copied().unwrap_or(0.0);
    let p95_latency_ms = latencies.get(p95_index).copied().unwrap_or(0.0);
    let p99_latency_ms = latencies.get(p99_index).copied().unwrap_or(0.0);

    // Calculate database processing time (subtract network latency)
    let database_processing_time_ms = average_latency_ms - baseline_latency;

    // Connection efficiency (lower is better)
    let avg_connection_time = connection_times.iter().sum::<f64>() / connection_times.len() as f64;
    let avg_query_time =
        query_execution_times.iter().sum::<f64>() / query_execution_times.len() as f64;
    let connection_efficiency = avg_query_time / (avg_connection_time + avg_query_time) * 100.0;

    Ok(SimulationResult {
        total_queries,
        successful_queries,
        failed_queries,
        duration_seconds,
        queries_per_second,
        average_latency_ms,
        min_latency_ms,
        max_latency_ms,
        p50_latency_ms,
        p95_latency_ms,
        p99_latency_ms,
        concurrent_connections,
        baseline_network_latency_ms: baseline_latency,
        database_processing_time_ms,
        connection_efficiency,
    })
}

fn format_number_with_commas(n: usize) -> String {
    let s = n.to_string();
    let mut result = String::new();
    let chars: Vec<char> = s.chars().collect();

    for (i, ch) in chars.iter().enumerate() {
        if i > 0 && (chars.len() - i) % 3 == 0 {
            result.push(',');
        }
        result.push(*ch);
    }
    result
}

fn format_float_with_commas(n: f64) -> String {
    let integer_part = n as usize;
    let decimal_part = n - integer_part as f64;

    if decimal_part < 0.01 {
        // For very small decimal parts, just show as integer
        format_number_with_commas(integer_part)
    } else {
        // Show with 2 decimal places
        let formatted_integer = format_number_with_commas(integer_part);
        format!("{}.{:02}", formatted_integer, (decimal_part * 100.0) as u32)
    }
}

fn display_operational_results(result: &SimulationResult) {
    println!("\n🎯 OPERATIONAL DATABASE PERFORMANCE RESULTS");
    println!("===============================================");

    if result.baseline_network_latency_ms > 0.0 {
        println!("📡 Network Latency Analysis:");
        println!(
            "   Baseline Network RTT:   {:>7.2}ms",
            result.baseline_network_latency_ms
        );
        println!(
            "   Database Processing:    {:>7.2}ms",
            result.database_processing_time_ms
        );
        println!(
            "   Network Overhead:       {:>7.1}%",
            (result.baseline_network_latency_ms / result.average_latency_ms) * 100.0
        );
        println!();
    }

    println!("📊 Query Statistics:");
    println!(
        "   Total Queries:          {:>12}",
        format_number_with_commas(result.total_queries)
    );
    println!(
        "   Successful:             {:>12}",
        format_number_with_commas(result.successful_queries)
    );
    println!(
        "   Failed:                 {:>12}",
        format_number_with_commas(result.failed_queries)
    );
    println!(
        "   Success Rate:           {:>7.2}%",
        (result.successful_queries as f64 / result.total_queries as f64) * 100.0
    );

    println!("\n⚡ Operational Performance:");
    println!(
        "   Duration:               {:>7.2}s",
        result.duration_seconds
    );
    println!(
        "   Queries/Second:         {:>12}",
        format_float_with_commas(result.queries_per_second)
    );
    println!(
        "   Concurrent Sessions:    {:>8}",
        result.concurrent_connections
    );
    println!(
        "   Connection Efficiency:  {:>7.1}%",
        result.connection_efficiency
    );

    println!("\n📈 Latency Breakdown (ms):");
    println!(
        "   Total Average:          {:>7.2}",
        result.average_latency_ms
    );

    if result.baseline_network_latency_ms > 0.0 {
        println!(
            "   Pure DB Processing:     {:>7.2}",
            result.database_processing_time_ms
        );
        println!(
            "   Network Component:      {:>7.2}",
            result.baseline_network_latency_ms
        );
    }

    println!("   Minimum:                {:>7.2}", result.min_latency_ms);
    println!("   Maximum:                {:>7.2}", result.max_latency_ms);
    println!("   50th Percentile:        {:>7.2}", result.p50_latency_ms);
    println!("   95th Percentile:        {:>7.2}", result.p95_latency_ms);
    println!("   99th Percentile:        {:>7.2}", result.p99_latency_ms);

    println!("\n🎯 Operational Assessment:");

    // Database processing performance (without network)
    let db_processing = if result.baseline_network_latency_ms > 0.0 {
        result.database_processing_time_ms
    } else {
        result.average_latency_ms
    };

    if db_processing < 10.0 {
        println!("   🚀 EXCEPTIONAL: <10ms DB processing time!");
    } else if db_processing < 50.0 {
        println!("   ✅ EXCELLENT: <50ms DB processing time");
    } else if db_processing < 100.0 {
        println!("   👍 GOOD: <100ms DB processing time");
    } else {
        println!("   ⚠️  MODERATE: >100ms DB processing time");
    }

    if result.queries_per_second > 100.0 {
        println!("   🔥 HIGH THROUGHPUT: >100 QPS achieved");
    } else if result.queries_per_second > 50.0 {
        println!("   ✅ GOOD THROUGHPUT: >50 QPS achieved");
    } else {
        println!("   ⚠️  MODERATE THROUGHPUT: <50 QPS");
    }

    if result.connection_efficiency > 80.0 {
        println!(
            "   ⚡ EFFICIENT: {}% query vs connection time",
            result.connection_efficiency as i32
        );
    } else {
        println!(
            "   📊 Connection overhead detected: {}% efficiency",
            result.connection_efficiency as i32
        );
    }

    println!("\n💡 Operational Insights:");
    println!(
        "   • Database handles {} concurrent operational sessions",
        result.concurrent_connections
    );
    println!(
        "   • Sustained {} queries/second under load",
        format_float_with_commas(result.queries_per_second)
    );

    if result.baseline_network_latency_ms > 0.0 {
        println!(
            "   • Pure database performance: {:.1}ms average processing",
            result.database_processing_time_ms
        );
        println!(
            "   • Network accounts for {:.0}% of total latency",
            (result.baseline_network_latency_ms / result.average_latency_ms) * 100.0
        );
    }

    println!(
        "   • 99% of queries complete within {:.1}ms",
        result.p99_latency_ms
    );
    println!("===============================================\n");
}

fn mask_password(url: &str) -> String {
    if let Some(at_pos) = url.find('@') {
        if let Some(colon_pos) = url[..at_pos].rfind(':') {
            let mut masked = url.to_string();
            masked.replace_range(colon_pos + 1..at_pos, "***");
            return masked;
        }
    }
    url.to_string()
}
