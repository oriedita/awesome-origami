#!/usr/bin/make -f
SHELL = /bin/bash
AWESOME_BOT_OPTIONS = --allow-redirect --request-delay 0.1 --allow 202 

ifeq ($(OS),Windows_NT)
	AB = awesome_bot
else
	AB = vendor/bin/awesome_bot
endif

all: check_all

# run all checks
check_all: check_syntax_full awesome_bot 

# check pull requests
check_pr: check_syntax_diff

# check syntax in whole file
check_syntax_full:
	node tests/validate.js -r README.md

# check syntax in the diff from master to current branch
check_syntax_diff:
	git diff --ignore-cr-at-eol origin/main -U0 README.md | grep --perl-regexp --only-matching "(?<=^\+).*" > temp.md && \
	node tests/validate.js -r README.md -d temp.md && \
	$(AB) -f temp.md $(AWESOME_BOT_OPTIONS)

# check dead links
# sudo apt install ruby && gem install --user-install awesome_bot
awesome_bot:
	$(AB) -f README.md $(AWESOME_BOT_OPTIONS)
