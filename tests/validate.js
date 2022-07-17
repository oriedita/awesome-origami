// USAGE:
// node validate.js -r README.md  (Checks whole file)
// node validate.js -r README.md -d temp.md  (Checks just the diff)

const fs = require("fs");

const LCERROR = '\x1b[31m%s\x1b[0m'; //red
const LCWARN = '\x1b[33m%s\x1b[0m'; //yellow
const LCINFO = '\x1b[36m%s\x1b[0m'; //cyan
const LCSUCCESS = '\x1b[32m%s\x1b[0m'; //green

const logger = class {
    static error(message, ...optionalParams) { console.error(LCERROR, message, ...optionalParams) }
    static warn(message, ...optionalParams) { console.warn(LCWARN, message, ...optionalParams) }
    static info(message, ...optionalParams) { console.info(LCINFO, message, ...optionalParams) }
    static success(message, ...optionalParams) { console.info(LCSUCCESS, message, ...optionalParams) }
}

const ALLOWED_LINK_TYPES = ['Demo', 'Source Code']

let pr = false;
let readme;
let diff;

// Detect if we find an entry: - [asdf](http://asdf) - Description
const ENTRY_DETECT = /^\s{0,2}[-*]\s\[.+\).*-/
const ENTRY_SELECT = /^\s{0,2}-\s(?<link>\[[^\]]+\]\([^)]+\))\s*(?<tag>`.+`)?\s*-\s+(?<description>[^)]{0,250}?)\s?(?<links>\(.+\))?$/
const ENTRY_NAME_SELECT = /^\s{0,2}[-*]\s\[([^\]]+)\]/
const LINK_SELECT = /\[(?<name>[^\]]+)]\((?<url>[^)]+)\)/g;

//Parse the command options and set the pr var
function parseArgs(args) {
    if (args.indexOf('-r', 2) > 0) {
        readme = fs.readFileSync(args[args.indexOf('-r', 2) + 1], 'utf8')
    }
    if (args.indexOf('-d', 2) > 0) {
        pr = true;
        diff = fs.readFileSync(args[args.indexOf('-d', 2) + 1], 'utf8');
    }
    if (pr === true) {
        logger.info(`Running on PR. README.md: ${args[args.indexOf('-r', 2) + 1]} diff: ${args[args.indexOf('-d', 2) + 1]}`)
    }
}

const findSections = (lines) => {
    const sections = { 'None': [] }
    let latestSection = 'None';

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        let headerMatch = /^##\s(.+)$/.exec(line);

        if (headerMatch) {
            latestSection = headerMatch[1];
            sections[latestSection] = []
        } else if (entryFilter(line)) {
            sections[latestSection].push(ENTRY_NAME_SELECT.exec(line)[1])
        }
    }

    return sections
}

// Function to find lines with entries
function entryFilter(md) {
    return ENTRY_DETECT.test(md);
}

// Function to split lines into array
function split(text) {
    return text.split(/\r?\n/);
}

//Test '- [Name](http://homepage/)'
function testMainLink(text) {
    let link = text.split('-')[1].trim();

    if (!/^\[[^\]]+]\([^)]+\)$/.test(link)) {
        logger.error(text + " Link part is not formatted like [...](...)")
        return false;
    }

    return true;
}

//Test  '`⚠` - Short description, less than 250 characters.'
function testDescription(text) {
    const descPart = text.split('-')[2].trim()

    if (descPart.length > 250) {
        logger.error("Description too long");
        return false;
    }

    return true;
}

//If present, tests '([Demo](http://url.to/demo), [Source Code](http://url.of/source/code), [Clients](https://url.to/list/of/related/clients-or-apps))'
function testLinks(line, entry) {

    let links = entry.links
    if (links) {
        let parsedLinks = [...links.matchAll(LINK_SELECT)]
        for (let i = 0; i < parsedLinks.length; i++) {
            if (!ALLOWED_LINK_TYPES.includes(parsedLinks[i].groups.name)) {
                logger.error(`${line}: Link name '${parsedLinks[i].groups.name}' not in ${ALLOWED_LINK_TYPES.join(", ")}`)

                return false;
            }
        }
    }


    return true;
}

//Runs all the syntax tests...
function findError(text) {
    testMainLink(text);
    testDescription(text);
}

const checkEntry = (e) => {
    let entry = ENTRY_SELECT.exec(e.raw)

    if (!entry) {
        logger.error(`Errors for line ${e.line}:`)
        findError(e.raw);

        return false;
    }

    if (!testLinks(e.line, entry.groups)) {
        return false;
    }

    return true;
}

function entryErrorCheck() {
    const lines = split(readme); // Inserts each line into the entries array
    let totalFail = 0;
    let totalPass = 0;
    let total = 0;
    let entries = [];
    let diffEntries = [];

    if (lines[0] === "") {
        logger.error("0 Entries Found, check your commandline arguments")
        process.exit(0)
    }

    const sections = findSections(lines);

    logger.info("Checking order in sections")
    for (let [name, value] of Object.entries(sections)) {
        let sortedValue = [...value].sort((a, b) => a.localeCompare(b))

        for (let i = 0; i < value.length; i++) {
            if (value[i] != sortedValue[i]) {
                logger.error(`Order is invalid in section ${name}:`)
                logger.error(`  - expected: ${sortedValue[i]}`)
                logger.error(`  - got:      ${value[i]}`)
                process.exit(0);
            }
        }
    }

    logger.success("Order of sections is valid")


    for (let i = 0; i < lines.length; i++) { // Loop through array of lines
        if (entryFilter(lines[i]) === true) { // filter out lines that don't start with * [)
            let e = {};
            e.raw = lines[i];
            e.line = i + 1
            entries.push(e);
        }
    }

    if (pr === true) {
        logger.info("Only testing the diff from the PR.\n")
        const diffLines = split(diff); // Inserts each line of diff into an array
        for (let l of diffLines) {
            if (entryFilter(l) === true) { // filter out lines that don't start with * [)
                let e = {};
                e.raw = l;
                diffEntries.push(e);
            }
        }
        if (diffEntries.length === 0) {
            console.log("No entries changed in README.md, Exiting...")
            process.exit(0)
        }
        total = diffEntries.length
        for (let e of diffEntries) {
            let pass = checkEntry(e);

            if (pass) {
                totalPass++
            } else {
                totalFail++
            }
        }
    } else {
        logger.info("Testing entire README.md\n")
        total = entries.length
        for (let e of entries) {
            let pass = checkEntry(e);

            if (pass) {
                totalPass++
            } else {
                totalFail++
            }
        }
    }
    if (totalFail > 0) {
        logger.info(`\n-----------------------------\n`)
        console.log(LCERROR + LCSUCCESS + LCINFO, `${totalFail} Failed, `, `${totalPass} Passed, `, `of ${total}`)
        logger.info(`\n-----------------------------\n`)
        process.exit(1);
    } else {
        logger.info(`\n-----------------------------\n`)
        logger.success(`${totalPass} Passed of ${total}`)
        logger.info(`\n-----------------------------\n`)
        process.exit(0)
    }
}

parseArgs(process.argv)
entryErrorCheck();