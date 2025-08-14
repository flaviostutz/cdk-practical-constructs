SHELL := /bin/bash

%:
	@echo ''
	@echo '>>> Running /lib:$@...'
	@cd lib; make $@
	@echo ''

	@# Building /examples is important as it simulates the usage of the lib as external
	@# so that is get problems with Lambda bundling, which is sensitive when distributing libs
	@echo ''
	@echo '>>> Running /examples:$@...'
	@echo ''
	@cd examples; STAGE=dev make $@

	@# While building the examples with local lib, pnpm-lock is updated with latest hash of the lib, which creates problems. This can be ignored
	@cd examples; git reset --hard

publish:
	cd lib; make publish

prepare:
	@echo "Run 'nvm use; corepack enable'"
