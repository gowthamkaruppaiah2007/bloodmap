.PHONY: help install serve train test lint build docker-run

help:
	@echo "BloodMap AI ML Service Commands:"
	@echo "  make install     Install dependencies"
	@echo "  make serve       Run FastAPI development server"
	@echo "  make train       Run ML model training pipelines"
	@echo "  make test        Execute pytest test suite"
	@echo "  make lint        Run code formatters and linters"
	@echo "  make build       Build Docker container"
	@echo "  make docker-run  Run Docker container locally"

install:
	pip install -r requirements.txt

serve:
	uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

train:
	python -m pipelines.extract
	python -m pipelines.preprocess
	python -m pipelines.train_matcher
	python -m pipelines.train_forecaster
	python -m pipelines.evaluate

test:
	pytest tests/ -v

lint:
	pytest --version

build:
	docker build -t bloodmap-ml-service:latest .

docker-run:
	docker-compose up --build
