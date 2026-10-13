FROM postgres:18-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends python3 gnupg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /work
CMD ["python3", "-m", "unittest", "discover", "-s", "tests", "-v"]
