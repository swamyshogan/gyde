const webpack = require('webpack');

module.exports = {
    eslint: {
      enable: false
    }, 

    webpack: {
        configure: webpackConfig => {
            const scopePluginIndex = webpackConfig.resolve.plugins.findIndex(
                ({ constructor }) => constructor && constructor.name === 'ModuleScopePlugin'
            );

            webpackConfig.resolve.plugins.splice(scopePluginIndex, 1);
            webpackConfig['resolve'] = {
                fallback: {
                    crypto: require.resolve("crypto-browserify"),
                    stream: require.resolve("stream-browserify"),
                    path: require.resolve("path-browserify"),
                    zlib: require.resolve("browserify-zlib"),
                    util: require.resolve("util/"),
                    assert: require.resolve("assert/"),
                    fs: false,
                    vm: false
                }
            }

            webpackConfig.plugins.push(
               new webpack.ProvidePlugin({
                   Buffer: ['buffer', 'Buffer'],
                   process: 'process/browser.js'
               })
            );
 
            return webpackConfig;
        }
    },

    babel: {
        plugins: ['preval'],
        /*loaderOptions: (babelLoaderOptions, {env, paths}) => {
            console.log(babelLoaderOptions);
            babelLoaderOptions.plugins = ['babel-plugin-preval'];
            return babelLoaderOptions;
        }*/
    }
}
