# ──────────────────────────────────────────────────────────────────────
# Library Cloud — full-stack multi-tenant Library Management SaaS
# ──────────────────────────────────────────────────────────────────────

SHELL := /bin/bash
COMPOSE := docker compose
COMPOSE_DEV := docker compose -f docker-compose.yml -f docker-compose.dev.yml

.PHONY: help env up dev down logs ps rebuild seed test test-backend test-clean db-dev backend-dev frontend-dev install typecheck build clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

env: ## Create .env with generated secrets (if missing)
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		pg=$$(openssl rand -hex 16); appd=$$(openssl rand -hex 16); jwt=$$(openssl rand -hex 32); \
		sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$$pg|" .env; \
		sed -i "s|^APP_DB_PASSWORD=.*|APP_DB_PASSWORD=$$appd|" .env; \
		sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$$jwt|" .env; \
		echo "Created .env with generated secrets"; \
	else echo ".env already exists"; fi

up: env ## Build + run the full stack (Caddy on :80)
	$(COMPOSE) up -d --build
	@echo ""
	@echo "  Web app:   $(shell grep -s '^PUBLIC_APP_URL=' .env | cut -d= -f2- || echo http://localhost)"
	@echo "  API:       http://localhost/api/v1/health  (via Caddy)"

dev: env ## Run full stack in dev (ports exposed: web :3000 api :4000 pg :5432)
	$(COMPOSE_DEV) up -d --build
	@echo "  Web: http://localhost:3000   API: http://localhost:4000/api/v1   Caddy: http://localhost:8080"

down: ## Stop the stack
	$(COMPOSE) down

logs: ## Tail logs
	$(COMPOSE) logs -f --tail=100

ps: ## Show container status
	$(COMPOSE) ps

rebuild: ## Rebuild images and restart
	$(COMPOSE) build --pull
	$(COMPOSE) up -d

seed: ## Seed demo data (demo library + platform admin)
	$(COMPOSE) run --rm --entrypoint node migrate dist/scripts/seed.js

test: test-backend ## Run all tests

test-backend: ## Run backend tests (spins up disposable postgres on :55432)
	cd backend && pnpm install --silent && pnpm test

test-clean: ## Remove the disposable test database container
	docker rm -f lms-pg-test 2>/dev/null || true

db-dev: env ## Run only postgres + redis locally (for pnpm dev workflows)
	$(COMPOSE) up -d postgres redis

backend-dev: ## Run backend with hot reload (needs db-dev)
	cd backend && pnpm dev

frontend-dev: ## Run frontend with hot reload (needs backend-dev)
	cd frontend && pnpm dev

install: ## Install dependencies for backend + frontend
	cd backend && pnpm install
	cd frontend && pnpm install

typecheck: ## Typecheck backend + frontend
	cd backend && pnpm typecheck
	cd frontend && pnpm typecheck

build: ## Build backend + frontend locally
	cd backend && pnpm build
	cd frontend && pnpm build

psql: ## Open psql shell in the running postgres
	$(COMPOSE) exec postgres psql -U $${POSTGRES_USER:-postgres} -d $${POSTGRES_DB:-library}

clean: ## Remove containers + volumes (DESTROYS DATA)
	$(COMPOSE) down -v
	docker rm -f lms-pg-test 2>/dev/null || true
