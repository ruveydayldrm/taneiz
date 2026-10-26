FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 MODEL_DIR=/models

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY grading_rules.yaml .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
