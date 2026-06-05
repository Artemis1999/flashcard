FROM python:3.13-slim

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/ /app/

ENV QUERY2CARD_HOST=0.0.0.0
ENV QUERY2CARD_PORT=22333
ENV QUERY2CARD_DB=/data/query2card.db

EXPOSE 22333

CMD ["python", "app.py"]
