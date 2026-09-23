"""Test-only staff token. Set before app import (get_settings is cached)."""
import os

os.environ.setdefault("ADMIN_API_TOKEN", "test-staff-token")
