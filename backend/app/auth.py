import os
from typing import Optional, Dict, Any
from databricks.sdk import WorkspaceClient
from databricks.sdk.core import Config
from app.config import app_config
from app.logging_config import get_logger

# Setup logger for this module
log = get_logger(__name__)


class DatabricksAuth:
    """Authentication handler for Databricks Apps and local development"""

    def __init__(self):
        self.config = app_config
        self._workspace_client: Optional[WorkspaceClient] = None

    @property
    def workspace_client(self) -> WorkspaceClient:
        """Get or create workspace client with lazy initialization"""
        if self._workspace_client is None:
            self._workspace_client = self.config.get_workspace_client()
        return self._workspace_client

    def get_user_context(self, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """
        Extract user context from request headers (Databricks Apps only)

        Args:
            headers: Request headers dictionary

        Returns:
            User context dict or None if not available
        """
        if not self.config.is_databricks_app:
            log.debug("🖥️ Local environment - no user context extraction")
            return None

        # In Databricks Apps, user information is passed via headers
        user_token = headers.get("x-forwarded-access-token")
        user_id = headers.get("x-forwarded-user-id")
        user_email = headers.get("x-forwarded-user-email")

        if user_token:
            log.info(f"👤 User context extracted for: {user_email}")
            return {
                "access_token": user_token,
                "user_id": user_id,
                "user_email": user_email,
                "is_authenticated": True,
            }

        log.warning("⚠️ No user context found in Databricks Apps headers")
        return None

    def get_service_principal_token(self) -> Optional[str]:
        """Get service principal OAuth token for API calls"""
        try:
            token = self.config.get_oauth_token()
            if token:
                log.debug("🔑 Service principal token retrieved successfully")
            return token
        except Exception as e:
            log.error(f"❌ Failed to get service principal token: {e}")
            return None

    def verify_databricks_connection(self) -> bool:
        """Verify that Databricks connection is working"""
        try:
            client = self.workspace_client
            # Try to get current user info as a simple test
            current_user = client.current_user.me()
            log.info(
                f"✅ Databricks connection verified for user: {current_user.user_name}"
            )
            return True
        except Exception as e:
            log.error(f"❌ Databricks connection failed: {e}")
            return False

    def get_database_auth_config(
        self, user_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Get database authentication configuration

        Args:
            user_context: Optional user context for user-specific auth

        Returns:
            Database connection parameters
        """
        base_config = self.config.database_config.copy()

        # For now, we'll use the existing username/password authentication
        # In a production setup, you might want to:
        # 1. Use OAuth tokens if your PostgreSQL supports it
        # 2. Use different credentials based on user context
        # 3. Implement role-based database access

        if self.config.is_databricks_app:
            log.info("🔐 Running in Databricks Apps - using service principal context")
            # Could potentially modify credentials here based on service principal

        if user_context and user_context.get("is_authenticated"):
            user_email = user_context.get("user_email", "unknown")
            log.info(f"👤 User authenticated: {user_email}")
            # Could modify database access based on user context

        return base_config


# Global authentication instance
databricks_auth = DatabricksAuth()
