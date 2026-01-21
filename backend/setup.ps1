# PowerShell setup script for local development
# Usage: Right-click -> Run with PowerShell, or run in terminal

$ErrorActionPreference = 'Stop'

Write-Host "Creating virtual environment .venv..."
python -m venv .venv

Write-Host "Activating virtual environment..."
.\.venv\Scripts\Activate.ps1

Write-Host "Upgrading pip and installing requirements..."
python -m pip install --upgrade pip
pip install -r requirements.txt

Write-Host "Copying .env.example to .env if not present..."
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "Created .env (edit it if you need to change DB credentials)"
} else {
    Write-Host ".env already exists"
}

Write-Host "Starting local services with docker-compose (Postgres, Redis, MinIO)..."
Write-Host "If you don't have Docker installed, skip this step and ensure a DB is available."
if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker-compose up -d
} else {
    Write-Host "Docker not found - skipping docker-compose. Ensure Postgres is running if USE_POSTGRES=true in .env"
}

Write-Host "Running migrations and collecting static files..."
python manage.py makemigrations
python manage.py migrate
python manage.py collectstatic --noinput

Write-Host "Create a superuser now?"
python manage.py createsuperuser

Write-Host "Done. Start the dev server with: python manage.py runserver"
