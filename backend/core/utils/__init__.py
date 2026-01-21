# core/utils/__init__.py
"""
Utility functions for the core app
"""

from .avatar_utils import (
    generate_default_avatar_url,
    get_avatar_url_from_profile,
    ensure_avatar_for_profile
)

__all__ = [
    'generate_default_avatar_url',
    'get_avatar_url_from_profile',
    'ensure_avatar_for_profile',
]
