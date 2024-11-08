import os
import json
import logging
from datetime import datetime
from typing import Dict
from filelock import FileLock

# Default location
DEFAULT_PATH = "/tmp/size-diff/stats.json"
LOCK_PATH = "/tmp/size-diff/stats.lock"  # Lock file path

# Default statistics structure
DEFAULT_STATS = {
    "unique_visitors": 0,
    "images_generated": 0,
    "visitor_ips": set(),  # Temporary in-memory storage of IPs for counting unique visitors
    "date": datetime.now().strftime("%Y-%m-%d"),  # Track the date for daily reset
}


class StatsManager:
    def __init__(self, file_path=DEFAULT_PATH):
        if os.getenv("GIT_COMMIT"):
            self.file_path = file_path
        else:
            # Else we're running default/debug mode
            self.file_path = DEFAULT_PATH
        self.lock = FileLock(LOCK_PATH)
        self.stats = self.load_stats()

    def load_stats(self) -> Dict:
        """Load stats from the JSON file, creating it with default values if it doesn't exist."""
        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)

        if os.path.exists(self.file_path):
            with self.lock:  # Lock during file read to prevent concurrent writes
                with open(self.file_path, "r") as f:
                    data = json.load(f)
                    data["visitor_ips"] = set(data.get("visitor_ips", []))
                    return data
        else:
            return DEFAULT_STATS.copy()

    def save_stats(self):
        """Save stats to the JSON file."""
        stats_copy = self.stats.copy()
        stats_copy["visitor_ips"] = list(stats_copy["visitor_ips"])

        with self.lock:  # Lock during file write to prevent concurrent writes
            with open(self.file_path, "w") as f:
                json.dump(stats_copy, f, indent=4)

    def increment_images_generated(self):
        """Increment the number of images generated."""
        self.check_and_reset_stats()
        self.stats["images_generated"] += 1
        self.save_stats()

    def register_visitor(self, ip_address: str):
        """Register a unique visitor based on IP."""
        self.check_and_reset_stats()

        if ip_address not in self.stats["visitor_ips"]:
            logging.debug(f"New visitor with IP {ip_address} registered.")
            self.stats["visitor_ips"].add(ip_address)
            self.stats["unique_visitors"] += 1
            self.save_stats()

    def check_and_reset_stats(self):
        """Reset stats if the date has changed since the last check."""
        current_date = datetime.now().strftime("%Y-%m-%d")
        if self.stats["date"] != current_date:
            # Reset stats for a new day
            self.stats = {
                "unique_visitors": 0,
                "images_generated": 0,
                "visitor_ips": set(),
                "date": current_date,
            }

    def get_stats(self) -> Dict:
        """Get current statistics (excluding visitor IPs)."""

        self.load_stats()  # Is doing a file operation the best use of our time? :/

        self.check_and_reset_stats()

        return {
            "unique_visitors": self.stats["unique_visitors"],
            "images_generated": self.stats["images_generated"],
        }
