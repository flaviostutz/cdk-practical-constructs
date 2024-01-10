SHELL := /bin/bash

build: install
	rm -rf dist
	pnpm exec esbuild src/index.ts --bundle --platform=node --minify --outfile=dist/index.js
	pnpm exec tsc --emitDeclarationOnly --outDir dist

lint:
	pnpm exec eslint . --ext .ts
	pnpm exec tsc -noEmit --skipLibCheck
	pnpm audit

test: unit-tests

unit-tests:
	pnpm exec jest --verbose

clean:
	rm -rf node_modules
	rm -rf dist

all: build lint test

install:
	corepack enable
	pnpm install --frozen-lockfile --config.dedupe-peer-dependents=false

publish:
	@if [ "$${NPM_ACCESS_TOKEN}" == "" ]; then \
		echo "env NPM_ACCESS_TOKEN is required"; \
		exit 1; \
	fi

	git config --global user.email "flaviostutz@gmail.com"
	git config --global user.name "Flávio Stutz"
	npm version from-git --no-git-tag-version

	echo "" >> .npmrc
	echo "//registry.npmjs.org/:_authToken=$${NPM_ACCESS_TOKEN}" >> .npmrc
	pnpm publish --no-git-checks
