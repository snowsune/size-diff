# Use Debian as the base image
FROM debian:latest

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="$VIRTUAL_ENV/bin:$PATH"

# Set the working directory inside the container
WORKDIR /app

# Install necessary system dependencies for Python and pip
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment
RUN python3 -m venv $VIRTUAL_ENV

# Copy requirements.txt and install dependencies in virtual environment
COPY requirements.txt .
RUN $VIRTUAL_ENV/bin/pip install --upgrade pip && $VIRTUAL_ENV/bin/pip install -r requirements.txt

# Copy the app code to the container
COPY . .

# Expose port 5000 for the Flask app
EXPOSE 5000

# Bake the git commit into the env
ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT

# Healthcheck to ensure the service is up
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl --fail http://localhost:5000/version || exit 1

# Expose the service port
EXPOSE 5000

# Run our WSGI (gunicorn)   
ENTRYPOINT ["sh", "-c", "$VIRTUAL_ENV/bin/flask db upgrade && $VIRTUAL_ENV/bin/gunicorn -b 0.0.0.0:5000 wsgi:app"]

