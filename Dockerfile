# Production image for the Isnad API and its served interfaces.
# The Next.js interface is already exported into src/isnad_core/api/web, so no
# Node build runs here.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080

WORKDIR /app
COPY pyproject.toml README.md LICENSE NOTICE.md ./
COPY src ./src
RUN pip install . && rm -rf /app/src

RUN useradd --create-home --uid 10001 isnad
USER isnad

EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn isnad_core.api.app:app --host 0.0.0.0 --port ${PORT} --no-server-header"]
