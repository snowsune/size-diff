import json
import os
from typing import Dict

# Default location
DEFAULT_PATH = "/tmp/size-diff/stats.json"

# Default statistics structure
DEFAULT_STATS = {
    "unique_visitors": 0,
    "images_generated": 0,
    "visitor_ips": set(),  # Temporary in-memory storage of IPs for counting unique visitors
}


class StatsManager:
    def __init__(self, file_path):
        if os.getenv("GIT_COMMIT"):
            self.file_path = file_path
        else:
            # Else we're running default/debug mode
            self.file_path = DEFAULT_PATH

        # Load stats
        self.stats = self.load_stats()

    def load_stats(self) -> Dict:
        """
        Load stats from the JSON file, creating it with default values if it doesn't exist.
        """

        # Ensure the directory exists
        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)

        # Check if the file exists, and load data if it does
        if os.path.exists(self.file_path):
            with open(self.file_path, "r") as f:
                data = json.load(f)
                data["visitor_ips"] = set(
                    data.get("visitor_ips", [])
                )  # Ensure IPs are stored as a set
                return data
        else:
            return DEFAULT_STATS.copy()

    def save_stats(self):
        """
        Save stats to the JSON file.
        """

        # Convert visitor_ips set to a list for JSON serialization
        stats_copy = self.stats.copy()
        stats_copy["visitor_ips"] = list(stats_copy["visitor_ips"])

        # Save the stats to the JSON file
        with open(self.file_path, "w") as f:
            json.dump(stats_copy, f, indent=4)

    def increment_images_generated(self):
        """Increment the number of images generated."""
        self.stats["images_generated"] += 1
        self.save_stats()

    def register_visitor(self, ip_address: str):
        """Register a unique visitor based on IP."""
        if ip_address not in self.stats["visitor_ips"]:
            self.stats["visitor_ips"].add(ip_address)
            self.stats["unique_visitors"] += 1
            self.save_stats()

    def get_stats(self) -> Dict:
        """Get current statistics (excluding visitor IPs)."""
        return {
            "unique_visitors": self.stats["unique_visitors"],
            "images_generated": self.stats["images_generated"],
        }
