SHELL := /bin/bash

build: install
	rm -rf dist

	@# TODO bundle dist after stabilisation
	@# pnpm exec esbuild src/index.ts --bundle --minify --platform=node --outfile=dist/index.js

	@# don't bundle dist for now (helps with debugging in clients)
	pnpm exec esbuild src/*.ts src/**/*.ts --platform=node --outdir=dist

	pnpm exec tsc --emitDeclarationOnly --outDir dist

	-find ./dist -name "*.test.js" -exec rm -rf {} \;
	-find ./dist -name "*.test.d.ts" -exec rm -rf {} \;
	-find ./dist -name "__tests__" -exec rm -rf {} \;

lint:
	pnpm exec eslint ./src --ext .ts
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
