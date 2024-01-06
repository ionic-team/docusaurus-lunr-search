const path = require('path')
const fs = require('fs')
const lunr = require('lunr')
const minimatch = require('minimatch')

/**
 * Based on code from https://github.com/cmfcmf/docusaurus-search-local/
 * by Christian Flach, licensed under the MIT license.
 */
function generateLunrClientJS(outDir, language = "en") {
    if (Array.isArray(language) && language.length === 1) {
        language = language[0];
    }
    let lunrClient =
        "// THIS FILE IS AUTOGENERATED\n" +
        "// DO NOT EDIT THIS FILE!\n\n" +
        'import * as lunr from "lunr";\n';

    if (language !== "en") {
        require("lunr-languages/lunr.stemmer.support")(lunr);
        lunrClient += 'require("lunr-languages/lunr.stemmer.support")(lunr);\n';
        if (Array.isArray(language)) {
            language
                .filter(code => code !== "en")
                .forEach(code => {
                    if (code === 'ja' || code === 'jp') {
                        require("lunr-languages/tinyseg")(lunr);
                        lunrClient += 'require("lunr-languages/tinyseg")(lunr);\n';
                    }
                    require(`lunr-languages/lunr.${code}`)(lunr);
                    lunrClient += `require("lunr-languages/lunr.${code}")(lunr);\n`;
                });
            require("lunr-languages/lunr.multi")(lunr);
            lunrClient += `require("lunr-languages/lunr.multi")(lunr);\n`;
        } else {
            require(`lunr-languages/lunr.${language}`)(lunr);
            lunrClient += `require("lunr-languages/lunr.${language}")(lunr);\n`;
        }
    }
    lunrClient += `export default lunr;\n`;

    const lunrClientPath = path.join(outDir, "lunr.client.js");
    fs.writeFileSync(lunrClientPath, lunrClient);

    if (language !== "en") {
        if (Array.isArray(language)) {
            return lunr.multiLanguage(...language);
        } else {
            return lunr[language];
        }
    }
    return null;
}

function getFilePaths(routesPaths, outDir, baseUrl, options = {}) {
    const files = []
    const addedFiles = new Set();
    const { excludeRoutes = [], includeRoutes = [], indexBaseUrl = false } = options
    const meta = {
        excludedCount: 0,
    }

    routesPaths.forEach((route) => {
        if (route === `${baseUrl}404.html`) return

        const isBaseUrl = route === baseUrl

        if (isBaseUrl && !indexBaseUrl) {
            return;
        }

        const relativePath = route.replace(baseUrl, '')
        const candidatePaths = [route, relativePath].flatMap(route => {
            return [
                path.join(outDir, `${route}.html`),
                path.join(outDir, route, "index.html")
            ]
        });

        const filePath = candidatePaths.find(fs.existsSync);
        if(filePath && !fs.existsSync(filePath)) {
            // if this error occurs, likely docusaurus changed some file generation aspects
            // and we need to update the candidates above
            console.warn(`docusaurus-lunr-search: could not resolve file for route '${route}', it will be missing in the search index`);
        }

        // if we already added this file, skip it
        if(filePath && addedFiles.has(filePath)) return

        // if we have include routes, skip if this route doesn't match any of them
        if(includeRoutes.length > 0 && !(includeRoutes.some((includePattern) => minimatch(route, includePattern) || minimatch(relativePath, includePattern)))) {
            meta.excludedCount++
            return
        }

        // if we have exclude routes, skip if this route matches any of them
        if (excludeRoutes.some((excludePattern) => minimatch(route, excludePattern) || minimatch(relativePath, excludePattern))) {
            meta.excludedCount++
            return
        }

        files.push({
            path: filePath,
            url: route,
        });
        addedFiles.add(filePath);
    })
    return [files, meta]
}

module.exports = {
    generateLunrClientJS,
    getFilePaths,
}
