FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

COPY pyproject.toml requirements.lock ./
COPY neuroinsight_api ./neuroinsight_api
RUN pip install --no-cache-dir -r requirements.lock && pip install --no-cache-dir --no-deps .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn neuroinsight_api.app:app --host 0.0.0.0 --port ${PORT}"]
