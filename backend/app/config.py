import os
from typing import Optional
from databricks.sdk import WorkspaceClient
from databricks.sdk.core import Config
from dotenv import load_dotenv

from app.logging_config import get_logger

# Load environment variables
load_dotenv()

# Setup logger for this module
log = get_logger(__name__)


class AppConfig:
    """Configuration class to handle both local and Databricks Apps environments"""

    def __init__(self):
        self.is_databricks_app = self._detect_databricks_app_environment()
        self.databricks_config = self._get_databricks_config()

    def _detect_databricks_app_environment(self) -> bool:
        """Detect if running in Databricks Apps environment"""
        # Databricks Apps runtime sets these environment variables
        return bool(
            os.getenv("DATABRICKS_CLIENT_ID") and os.getenv("DATABRICKS_CLIENT_SECRET")
        )

    def _get_databricks_config(self) -> Config:
        """Get Databricks configuration based on environment"""
        if self.is_databricks_app:
            # Running in Databricks Apps - use service principal credentials
            log.info(
                "🔐 Configuring Databricks Apps authentication with service principal"
            )
            return Config(
                host=os.getenv("DATABRICKS_HOST"),
                client_id=os.getenv("DATABRICKS_CLIENT_ID"),
                client_secret=os.getenv("DATABRICKS_CLIENT_SECRET"),
            )
        else:
            # Running locally - use CLI authentication or manual config
            databricks_host = os.getenv("DATABRICKS_HOST")
            databricks_token = os.getenv("DATABRICKS_TOKEN")

            if databricks_host and databricks_token:
                # Manual token configuration
                log.info("🔑 Configuring Databricks authentication with manual token")
                return Config(host=databricks_host, token=databricks_token)
            else:
                # Use CLI authentication (default)
                log.info("🖥️ Configuring Databricks authentication with CLI")
                return Config()

    def get_workspace_client(self) -> WorkspaceClient:
        """Get authenticated Databricks workspace client"""
        return WorkspaceClient(config=self.databricks_config)

    def get_oauth_token(self) -> Optional[str]:
        """Get OAuth token for database connections"""
        try:
            if self.is_databricks_app:
                # In Databricks Apps, get token using service principal
                client = self.get_workspace_client()
                # Use the service principal's access token
                token = client.config.authenticate()
                if token:
                    log.debug("🎫 Retrieved OAuth token from service principal")
                    return str(token)  # Ensure we return a string
                else:
                    log.warning("⚠️ OAuth token is None from service principal")
                    return None
            else:
                # For local development, use CLI token or manual token
                if os.getenv("DATABRICKS_TOKEN"):
                    log.debug("🎫 Using manual OAuth token from environment")
                    return os.getenv("DATABRICKS_TOKEN")
                else:
                    # Use CLI authentication
                    client = self.get_workspace_client()
                    token = client.config.authenticate()
                    if token:
                        log.debug("🎫 Retrieved OAuth token from CLI authentication")
                        return str(token)  # Ensure we return a string
                    else:
                        log.warning("⚠️ OAuth token is None from CLI authentication")
                        return None
        except Exception as e:
            log.error(f"❌ Failed to get OAuth token: {e}")
            return None

    @property
    def database_config(self) -> dict:
        """Get database configuration with OAuth token if available"""
        base_config = {
            "host": os.getenv("DB_HOST", "localhost"),
            "port": os.getenv("DB_PORT", "5432"),
            "database": os.getenv("DB_NAME", "store_flow_analytics"),
            "user": os.getenv("DB_USER"),
            "password": os.getenv("DB_PASSWORD"),
        }

        # If we have an OAuth token, we could potentially use it for authentication
        # This depends on your PostgreSQL setup and whether it supports OAuth
        oauth_token = self.get_oauth_token()
        if oauth_token and self.is_databricks_app and isinstance(oauth_token, str):
            # Note: Using OAuth for PostgreSQL would require specific setup
            # For now, we'll keep the existing username/password authentication
            # but log that OAuth is available
            log.info(
                f"✅ OAuth token available for potential use: {oauth_token[:20]}..."
            )

        return base_config

    @property
    def cors_origins(self) -> list:
        """Get CORS origins based on environment"""
        if self.is_databricks_app:
            # In Databricks Apps, allow the workspace domain
            databricks_host = os.getenv("DATABRICKS_HOST", "")
            if databricks_host:
                origins = [
                    databricks_host,
                    f"{databricks_host}/*",
                    "https://*.cloud.databricks.com",
                    "https://*.databricksapps.com",
                ]
                log.info(f"🌐 CORS configured for Databricks Apps: {origins}")
                return origins

        # Local development origins
        origins = [
            "http://localhost:8080",
            "http://localhost:3000",
            "http://localhost:5173",
        ]
        log.info(f"🌐 CORS configured for local development: {origins}")
        return origins


# Global config instance
app_config = AppConfig()
