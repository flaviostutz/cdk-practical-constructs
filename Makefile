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
	@cd examples; make $@

publish:
	cd lib; make publish
