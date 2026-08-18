/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    id: 'a572f49c-55d2-4427-8d4c-a84975f61781',
    name: 'data-share-hub',
    title: 'Data Share Hub',
    description:
        "Define a data slice once -- dataset, data elements, org units, a date range -- and either export it as CSV immediately, or provision a scoped, revocable external API account for it. Every share is tracked in one registry. CSV export uses your own already-authenticated session -- no new credential, no new security surface. API sharing creates a brand-new, minimal-permission DHIS2 account scoped to exactly the data you picked, grants it read access, and builds it a dedicated private dashboard containing only that data (not the general Dashboard app, which would show every other dashboard already public on the instance). Built around a real DHIS2 platform constraint, not against it: personal access tokens are self-service only -- there's no API for creating one on behalf of another account. So this app automates everything up to that point (the account, its scoped access, its own dashboard with instructions built in) and is explicit about the one remaining manual step: whoever administers the new account logs in once to generate their own token. Nothing is bundled. On a fresh install there are zero shares -- every dataset, data element, and org unit shown comes live from your own instance's metadata.",

    minDHIS2Version: '2.40',

    entryPoints: {
        app: './src/App.tsx',
    },

    dataStoreNamespace: 'dataShareHub',

    direction: 'auto',
}

module.exports = config
