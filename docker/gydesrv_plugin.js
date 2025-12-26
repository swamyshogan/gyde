import proxy from 'http-proxy-middleware';

export default (app, protect) => {
    app.use(
        '/v1/biology',
        protect,
        proxy.createProxyMiddleware({
            target: 'https://health.api.nvidia.com/',
            changeOrigin: true,
            secure: false
        })
    );
};


export function environment(baseEnv) {
    return {
        ...baseEnv,
        featureFlags: {
            ...(baseEnv?.featureFlags ?? {}),
            nimStructurePredictions: true,
            collabServerMSAs: true
        }
    };
}
