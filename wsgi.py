import os
import logging

from app import create_app

app = create_app()

if __name__ == "__main__":
    # Setup logging
    logging.basicConfig()
    logging.info(f"Starting server, version {os.getenv('GIT_COMMIT', 'unknown')}")

    # Run app
    app.run(host="0.0.0.0")
