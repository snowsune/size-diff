import os
import sqlite3
import logging
from datetime import datetime

# Default database location
DEFAULT_DB_PATH = "/tmp/size-diff/stats.db"


class StatsManager:
    def __init__(self, db_path=DEFAULT_DB_PATH):
        if os.getenv("GIT_COMMIT"):
            self.db_path = db_path
        else:
            # Else we're running default/debug mode
            self.db_path = DEFAULT_DB_PATH

        self._initialize_db()

    def _initialize_db(self):
        """Initialize the database and table if it doesn't already exist."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS stats (
                    date TEXT PRIMARY KEY,
                    unique_visitors INTEGER,
                    images_generated INTEGER
                )
            """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS visitors (
                    ip TEXT PRIMARY KEY,
                    date TEXT
                )
            """
            )
            today = datetime.now().strftime("%Y-%m-%d")
            cursor.execute(
                """
                INSERT OR IGNORE INTO stats (date, unique_visitors, images_generated)
                VALUES (?, 0, 0)
            """,
                (today,),
            )
            conn.commit()

    def register_visitor(self, ip_address: str):
        try:
            today = datetime.now().strftime("%Y-%m-%d")
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                try:
                    cursor.execute(
                        "INSERT INTO visitors (ip, date) VALUES (?, ?)",
                        (ip_address, today),
                    )
                    cursor.execute(
                        """
                        UPDATE stats SET unique_visitors = unique_visitors + 1
                        WHERE date = ?
                    """,
                        (today,),
                    )
                except sqlite3.IntegrityError as e:
                    logging.warn(f"Integrity error {e} when recording IP")
                    pass
                conn.commit()
        except Exception as e:
            logging.warn(f"Got uncaught exception {e} when saving visitor stat!")

    def get_stats(self):
        """Retrieve current statistics for today."""
        today = datetime.now().strftime("%Y-%m-%d")
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT unique_visitors FROM stats WHERE date = ?",
                (today,),
            )
            stats = cursor.fetchone()
            if stats:
                return {"unique_visitors": stats[0]}
            return {"unique_visitors": 0}
