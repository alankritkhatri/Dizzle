# app/upstash_redis.py
"""
Upstash Redis REST API client wrapper
Provides a simple interface for publish operations using Upstash REST API
"""
import json
import requests
from typing import Dict, Any
from .config import settings


class UpstashRedisClient:
    """
    Lightweight client for Upstash Redis REST API
    Supports basic operations needed for pub/sub messaging
    """

    def __init__(self, url: str = None, token: str = None):
        self.url = url or settings.UPSTASH_REDIS_REST_URL
        self.token = token or settings.UPSTASH_REDIS_REST_TOKEN

        if not self.url or not self.token:
            raise ValueError(
                "Upstash Redis REST URL and TOKEN must be provided either "
                "as arguments or via UPSTASH_REDIS_REST_URL and "
                "UPSTASH_REDIS_REST_TOKEN environment variables"
            )

        # Remove trailing slash from URL if present
        self.url = self.url.rstrip("/")

        # Set up headers for authentication
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def _execute_command(self, command: list) -> Any:
        """
        Execute a Redis command via REST API

        Args:
            command: List of command parts (e.g., ["SET", "key", "value"])

        Returns:
            Response from Redis
        """
        try:
            response = requests.post(
                self.url,
                headers=self.headers,
                json=command,
                timeout=10,
            )
            response.raise_for_status()
            result = response.json()
            return result.get("result")
        except requests.exceptions.RequestException as e:
            print(f"Error executing Redis command {command}: {e}")
            return None

    def publish(self, channel: str, message: str) -> int:
        """
        Publish a message to a Redis channel

        Args:
            channel: The channel name
            message: The message to publish (string)

        Returns:
            Number of subscribers that received the message
        """
        # Ensure message is a string
        if isinstance(message, dict):
            message = json.dumps(message)

        result = self._execute_command(["PUBLISH", channel, message])
        return result if result is not None else 0

    def set(self, key: str, value: str, ex: int = None) -> bool:
        """
        Set a key-value pair

        Args:
            key: The key name
            value: The value to set
            ex: Optional expiration time in seconds

        Returns:
            True if successful, False otherwise
        """
        if ex:
            result = self._execute_command(["SET", key, value, "EX", str(ex)])
        else:
            result = self._execute_command(["SET", key, value])
        return result == "OK"

    def get(self, key: str) -> str:
        """
        Get a value by key

        Args:
            key: The key name

        Returns:
            The value or None if key doesn't exist
        """
        return self._execute_command(["GET", key])

    def delete(self, *keys: str) -> int:
        """
        Delete one or more keys

        Args:
            keys: One or more key names to delete

        Returns:
            Number of keys deleted
        """
        result = self._execute_command(["DEL"] + list(keys))
        return result if result is not None else 0

    def incr(self, key: str) -> int:
        """
        Increment a key's value

        Args:
            key: The key name

        Returns:
            The new value after increment
        """
        result = self._execute_command(["INCR", key])
        return result if result is not None else 0


# Global instance
_upstash_client = None


def get_upstash_client() -> UpstashRedisClient:
    """
    Get or create the global Upstash Redis client instance

    Returns:
        UpstashRedisClient instance
    """
    global _upstash_client
    if _upstash_client is None:
        _upstash_client = UpstashRedisClient()
    return _upstash_client
