from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any

from app.auth import databricks_auth
from app.config import app_config
from app.logging_config import get_logger

# Set up logging for this module
log = get_logger(__name__)

# Optional HTTP Bearer for token-based auth in local development
security = HTTPBearer(auto_error=False)


class DatabricksUserMiddleware:
    """Middleware to handle Databricks user context and authorization"""

    def __init__(self):
        self.auth = databricks_auth
        self.config = app_config

    async def get_user_context(self, request: Request) -> Optional[Dict[str, Any]]:
        """
        Extract and validate user context from request

        Args:
            request: FastAPI request object

        Returns:
            User context dictionary or None
        """
        headers = dict(request.headers)

        if self.config.is_databricks_app:
            # In Databricks Apps environment
            user_context = self.auth.get_user_context(headers)

            if user_context and user_context.get("is_authenticated"):
                log.info(
                    f"👤 Databricks user authenticated: {user_context.get('user_email')}"
                )
                return user_context
            else:
                # In Databricks Apps, requests should always have user context
                # Log this for debugging but don't block the request
                log.warning("⚠️ No user context found in Databricks Apps environment")
                return None
        else:
            # Local development environment
            # Could implement token-based auth here if needed
            log.debug("🖥️ Running in local development mode - no user context")
            return {
                "is_authenticated": False,
                "environment": "local",
                "user_email": "local-dev-user",
                "user_id": "local-dev",
            }

    def require_user_auth(
        self, user_context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Require user authentication for protected endpoints

        Args:
            user_context: User context from get_user_context

        Returns:
            Validated user context

        Raises:
            HTTPException: If user is not authenticated
        """
        if not user_context or not user_context.get("is_authenticated"):
            if self.config.is_databricks_app:
                log.warning("🚫 Authentication required but user context missing")
                raise HTTPException(
                    status_code=401,
                    detail="User authentication required. Please ensure you're accessing this through Databricks Apps.",
                )
            else:
                # In local development, we might be more permissive
                log.warning("⚠️ User authentication not available in local development")
                return {
                    "is_authenticated": False,
                    "environment": "local",
                    "user_email": "local-dev-user",
                    "user_id": "local-dev",
                }

        return user_context

    def check_user_permission(
        self, user_context: Dict[str, Any], required_permission: str
    ) -> bool:
        """
        Check if user has required permission

        Args:
            user_context: User context dictionary
            required_permission: Permission string to check

        Returns:
            True if user has permission, False otherwise
        """
        if not user_context.get("is_authenticated"):
            log.debug(f"🚫 Permission check failed - user not authenticated")
            return False

        # In a real implementation, you would check user permissions
        # against your authorization system (Unity Catalog, custom RBAC, etc.)

        # For now, we'll assume authenticated users have basic permissions
        basic_permissions = [
            "read:stores",
            "read:inventory",
            "read:orders",
            "read:products",
        ]

        if required_permission in basic_permissions:
            log.debug(f"✅ Permission granted: {required_permission}")
            return True

        # For admin permissions, you might check user roles
        admin_permissions = ["write:stores", "write:inventory", "admin:users"]
        if required_permission in admin_permissions:
            # Check if user is admin (implement your logic here)
            user_email = user_context.get("user_email", "")
            is_admin = user_email.endswith("@your-company.com")  # Example logic
            if is_admin:
                log.info(
                    f"🔑 Admin permission granted to {user_email}: {required_permission}"
                )
            else:
                log.warning(
                    f"🚫 Admin permission denied to {user_email}: {required_permission}"
                )
            return is_admin

        log.warning(f"🚫 Unknown permission requested: {required_permission}")
        return False


# Global middleware instance
user_middleware = DatabricksUserMiddleware()


# Dependency functions for FastAPI
async def get_current_user(request: Request) -> Optional[Dict[str, Any]]:
    """FastAPI dependency to get current user context"""
    return await user_middleware.get_user_context(request)


async def require_authenticated_user(request: Request) -> Dict[str, Any]:
    """FastAPI dependency to require authenticated user"""
    user_context = await get_current_user(request)
    return user_middleware.require_user_auth(user_context)


def require_permission(permission: str):
    """
    FastAPI dependency factory to require specific permission

    Args:
        permission: Required permission string

    Returns:
        FastAPI dependency function
    """

    async def permission_dependency(request: Request) -> Dict[str, Any]:
        user_context = await require_authenticated_user(request)

        if not user_middleware.check_user_permission(user_context, permission):
            raise HTTPException(
                status_code=403, detail=f"Permission '{permission}' required"
            )

        return user_context

    return permission_dependency
