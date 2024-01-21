SHELL := /bin/bash

%:
	@echo 'Running /lib:$@...'
	@cd lib; make $@

	@echo ''
	@echo 'Running /examples:$@...'
	@cd examples; make $@

publish:
	cd lib; make publish
