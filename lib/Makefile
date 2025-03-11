SHELL := /bin/bash

build: install
	@rm -rf dist

	@# Don't bundle so internal CDK constructs continue working on clients
	pnpm exec tsc --outDir dist

	@# remove all tests from distribution
	@-find -E ./dist -regex '.*\.test\..*|.*__tests.*' -exec rm -rf {} \; 2> /dev/null

	@# Create pack to be used by examples app to simulate real usage of the lib
	pnpm pack --pack-destination dist

lint:
	pnpm exec eslint ./src --ext .ts
	pnpm audit --audit-level high

lint-fix:
	pnpm exec eslint . --ext .ts --fix

test-watch:
	pnpm exec jest -i --watch

test:
	@# can't be in parallel because we use nock that has shared contexts
	pnpm exec jest -i --verbose

clean:
	rm -rf node_modules
	rm -rf dist

all: build lint test

install:
	# corepack enable

	# To circunvent https://github.com/nodejs/corepack/issues/612
	corepack enable pnpm
	corepack use pnpm@8.9.0
	COREPACK_INTEGRITY_KEYS=0 pnpm --version

	pnpm install --frozen-lockfile --config.dedupe-peer-dependents=false

publish:
	@if [ "$${NPM_ACCESS_TOKEN}" == "" ]; then \
		echo "env NPM_ACCESS_TOKEN is required"; \
		exit 1; \
	fi

	# check if tag is current and bump version in package.json to latest tag
	npx -y monotag@1.19.2 current --bump-action=latest

	echo "" >> .npmrc
	echo "//registry.npmjs.org/:_authToken=$${NPM_ACCESS_TOKEN}" >> .npmrc
	pnpm publish --no-git-checks
