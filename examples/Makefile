SHELL := /bin/bash

build: install
	pnpm exec tsc --outDir dist

lint:
	pnpm exec eslint ./src --ext .ts

lint-fix:
	pnpm exec eslint . --ext .ts --fix

test: unit-tests

unit-tests:
	# pnpm exec jest --verbose

clean:
	rm -rf node_modules
	rm -rf dist

all: build lint test

install:
	pnpm install --frozen-lockfile --config.dedupe-peer-dependents=false
