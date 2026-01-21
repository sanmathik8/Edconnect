import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / '.env')

def reset_db():
    dbname = os.environ.get('POSTGRES_DB', 'recom')
    user = os.environ.get('POSTGRES_USER', 'postgres')
    password = os.environ.get('POSTGRES_PASSWORD', 'postgres')
    host = os.environ.get('POSTGRES_HOST', 'localhost')
    port = os.environ.get('POSTGRES_PORT', '5432')

    try:
        # Connect to default postgres db to drop/create
        conn = psycopg2.connect(
            dbname='postgres',
            user=user,
            password=password,
            host=host,
            port=port
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        print(f"Terminating connections to {dbname}...")
        cur.execute(f"""
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = '{dbname}'
              AND pid <> pg_backend_pid();
        """)

        print(f"Dropping database {dbname}...")
        cur.execute(f"DROP DATABASE IF EXISTS {dbname};")
        
        print(f"Creating database {dbname}...")
        cur.execute(f"CREATE DATABASE {dbname};")
        
        cur.close()
        conn.close()
        print("Done!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    reset_db()
