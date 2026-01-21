from pathlib import Path
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env if present
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ.get('SECRET_KEY', 'change-me-in-production')
DEBUG = os.environ.get('DEBUG', 'True').lower() in ('1', 'true', 'yes')
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '*').split(',') if DEBUG else os.environ.get('ALLOWED_HOSTS', 'yourdomain.com').split(',')

CHAT_MESSAGE_ENCRYPTION_KEY = os.environ.get('CHAT_MESSAGE_ENCRYPTION_KEY')
CHAT_MESSAGE_KEYS = os.environ.get('CHAT_MESSAGE_KEYS', CHAT_MESSAGE_ENCRYPTION_KEY)

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'channels',
    'corsheaders',
    'core.apps.CoreConfig',
    'chat',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Must be first
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'project.wsgi.application'
ASGI_APPLICATION = 'project.asgi.application'

# Channel Layers - Explicitly use In-Memory to avoid Redis dependency
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer"
    }
}

# Default SQLite config for development
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Optional Postgres configuration via environment variables
if os.environ.get('USE_POSTGRES', '').lower() in ('1', 'true', 'yes'):
    # only switch to Postgres if the configured host resolves; this avoids
    # failing imports when docker-compose is not running locally.
    pg_host = os.environ.get('POSTGRES_HOST', 'localhost')
    try:
        import socket
        socket.gethostbyname(pg_host)
        DATABASES['default'] = {
            'ENGINE': 'django.db.backends.postgresql_psycopg2',
            'NAME': os.environ.get('POSTGRES_DB', 'recom'),
            'USER': os.environ.get('POSTGRES_USER', 'postgres'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'postgres'),
            'HOST': pg_host,
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        }
    except Exception:
        # host does not resolve; keep default sqlite
        pass

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 8,  # Minimum 8 characters
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]
LOGIN_URL = 'core:login'
LOGIN_REDIRECT_URL = 'core:discover-page'

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
# settings.py
AI_FEATURES_ENABLED = True  # Set to False to disable AI features
# ===========================================
# CRITICAL CORS & AUTHENTICATION SETTINGS
# ===========================================

# CORS Configuration
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

CORS_ALLOW_CREDENTIALS = True  # Essential for session auth

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

CORS_EXPOSE_HEADERS = ['Set-Cookie']
CORS_ALLOW_CREDENTIALS = True
# Optional: For development, you can be less restrictive
# CAUTION: CORS_ALLOW_ALL_ORIGINS cannot be True if CORS_ALLOW_CREDENTIALS is True
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = False

# CSRF Settings for Session Authentication
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = False  # Must be accessible from JavaScript for AJAX
CSRF_COOKIE_SECURE = False  # Set to True in production with HTTPS
CSRF_USE_SESSIONS = False

# Session Settings
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = False  # Set to True in production with HTTPS
SESSION_COOKIE_AGE = 3600  # 1 hour in seconds
SESSION_SAVE_EVERY_REQUEST = True
SESSION_EXPIRE_AT_BROWSER_CLOSE = True

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
    'EXCEPTION_HANDLER': 'core.utils.exception_handler.custom_exception_handler',
}

# Create logs directory if it doesn't exist
LOGS_DIR = BASE_DIR / 'logs'
LOGS_DIR.mkdir(exist_ok=True)

# Logging configuration - FIXED
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'level': 'DEBUG',
            'class': 'logging.FileHandler',
            'filename': str(LOGS_DIR / 'django_debug.log'),  # Convert Path to string
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'core': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}


# ===========================================
# ADDITIONAL SECURITY SETTINGS (Optional)
# ===========================================

if DEBUG:
    # Development settings
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
else:
    # Production settings
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    X_FRAME_OPTIONS = 'DENY'