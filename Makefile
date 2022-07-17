#!/usr/bin/make -f
SHELL = /bin/bash
AWESOME_BOT_OPTIONS = --allow-redirect --request-delay 1 --skip-save-results --allow 202 

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
	vendor/bin/awesome_bot -f temp.md $(AWESOME_BOT_OPTIONS)

# check dead links
# sudo apt install ruby && install --user-install awesome_bot
awesome_bot:
	vendor/bin/awesome_bot -f README.md $(AWESOME_BOT_OPTIONS)
