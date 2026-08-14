# Use the official Python slim image as the base image
FROM python:3.10-slim

WORKDIR /app

# Install js deps, fonts
RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm git fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Install JS deps first (painters-canvas from git) so this layer caches nicely
COPY package.json package-lock.json .npmrc ./
RUN npm install --omit=dev

COPY . .

EXPOSE 5000

ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT

# HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
#     CMD curl --fail http://localhost:5000/ || exit 1

ENTRYPOINT ["gunicorn", "-b", "0.0.0.0:5000", "-w", "4", "-t", "120", "wsgi:app"]
