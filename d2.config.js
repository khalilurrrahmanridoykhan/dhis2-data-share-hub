/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    name: 'data-share-hub',
    title: 'Data Share Hub',
    description:
        'Define a data slice once (dataset + data elements + org units + period range), then either export it as CSV immediately, or provision a scoped, revocable external API account for it -- with every share tracked in one registry.',

    coreCompatibility: '>=2.40',

    entryPoints: {
        app: './src/App.tsx',
    },

    dataStoreNamespace: 'dataShareHub',

    direction: 'auto',
}

module.exports = config
