'use strict';

process.env.NODE_ENV = 'test';
const { describe, it, beforeEach, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');

const config = require('../src/config/env');
const { pool } = require('../src/config/db');
const { redis, authRedis } = require('../src/config/redis');

const Api = require('../src/models/Api');
const Category = require('../src/models/Category');
const ApiVersion = require('../src/models/ApiVersion');
const ApiEndpoint = require('../src/models/ApiEndpoint');
const ApiDocumentation = require('../src/models/ApiDocumentation');
const ProviderConfig = require('../src/models/ProviderConfig');

const { encryptAuthConfig, decryptAuthConfig, sanitizeProviderConfig } = require('../src/utils/crypto');
const { validateTargetUrl } = require('../src/utils/ssrf');

const categoryService = require('../src/services/categoryService');
const catalogService = require('../src/services/catalogService');
const providerConfigService = require('../src/services/providerConfigService');
const routeCacheService = require('../src/services/routeCacheService');
const app = require('../src/app');

const PROVIDER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_PROVIDER_ID = '22222222-2222-2222-2222-222222222222';
const ADMIN_ID = '99999999-9999-9999-9999-999999999999';
const API_ID = '33333333-3333-3333-3333-333333333333';
const CATEGORY_ID = '44444444-4444-4444-4444-444444444444';
const VERSION_ID = '55555555-5555-5555-5555-555555555555';
const ENDPOINT_ID = '66666666-6666-6666-6666-666666666666';
const DOC_ID = '77777777-7777-7777-7777-777777777777';

function signTestJwt({ userId = PROVIDER_ID, email = 'provider@apicircle.com', roles = ['provider'] } = {}) {
  return jwt.sign({ email, roles }, config.jwt.secret, {
    subject: userId,
    issuer: config.jwt.issuer,
    expiresIn: '15m',
  });
}

async function requestApp(method, path, { headers = {}, body } = {}) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    return { status: res.status, body: json };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('AES-256-GCM Provider Config Encryption', () => {
  it('encrypts and decrypts auth_config with 128-bit GCM auth tag', () => {
    const secretPayload = { apiKey: 'sk_live_super_secret_123', headerName: 'X-Upstream-Key' };
    const envelope = encryptAuthConfig(secretPayload);

    assert.equal(envelope.alg, 'aes-256-gcm');
    assert.ok(envelope.iv);
    assert.ok(envelope.tag);
    assert.ok(envelope.encrypted);
    assert.equal(Buffer.from(envelope.tag, 'base64').length, 16);

    const decrypted = decryptAuthConfig(envelope);
    assert.deepEqual(decrypted, secretPayload);
  });

  it('redacts encrypted credentials in sanitizeProviderConfig', () => {
    const envelope = encryptAuthConfig({ token: 'my-secret-token' });
    const sanitized = sanitizeProviderConfig({
      id: 'cfg-1',
      api_id: API_ID,
      auth_type: 'bearer',
      auth_config: envelope,
      timeout_ms: 5000,
      retry_count: 1,
      custom_headers: { 'X-Custom': '1' },
    });

    assert.equal(sanitized.has_credentials, true);
    assert.equal(sanitized.auth_config, undefined);
    assert.equal(JSON.stringify(sanitized).includes('my-secret-token'), false);
  });
});

describe('SSRF URL Defense', () => {
  it('allows valid public HTTPS URLs and strips trailing slash', () => {
    const normalized = validateTargetUrl('https://api.weather.example.com/v1/');
    assert.equal(normalized, 'https://api.weather.example.com/v1');
  });

  it('blocks localhost, loopback, metadata, and private RFC1918 ranges', () => {
    const blocked = [
      'http://localhost:3000',
      'http://127.0.0.1:8080/internal',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.5/admin',
      'http://172.16.0.10/secret',
      'http://192.168.1.1/router',
      'http://[::1]:8000',
      'https://db.internal/query',
      'https://user:pass@api.example.com',
    ];

    for (const url of blocked) {
      assert.throws(() => validateTargetUrl(url), (err) => err.statusCode === 400);
    }
  });
});

describe('CategoryService', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  it('builds hierarchical category tree and caches it in Redis', async () => {
    const rows = [
      { id: 'c1', name: 'AI & ML', slug: 'ai-ml', parent_id: null },
      { id: 'c2', name: 'NLP', slug: 'nlp', parent_id: 'c1' },
    ];
    mock.method(redis, 'get', async () => null);
    mock.method(Category, 'findAll', async () => rows);
    const setSpy = mock.method(redis, 'set', async () => 'OK');

    const tree = await categoryService.listCategories();
    assert.equal(tree.length, 1);
    assert.equal(tree[0].children.length, 1);
    assert.equal(tree[0].children[0].slug, 'nlp');
    assert.equal(setSpy.mock.calls.length, 1);
  });
});

describe('CatalogService & RouteCacheService', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  it('rejects duplicate API slug with 409', async () => {
    mock.method(Api, 'findBySlug', async () => ({ id: API_ID, slug: 'weather-api' }));

    await assert.rejects(
      () => catalogService.createApi(PROVIDER_ID, { name: 'Weather', slug: 'weather-api' }),
      (err) => err.statusCode === 409 && err.code === 'SLUG_TAKEN'
    );
  });

  it('hides draft/private APIs from non-owners', async () => {
    mock.method(Api, 'findById', async () => ({
      id: API_ID,
      provider_id: PROVIDER_ID,
      slug: 'secret-api',
      status: 'draft',
      visibility: 'private',
    }));

    await assert.rejects(
      () => catalogService.getApiDetails(API_ID, { id: OTHER_PROVIDER_ID, roles: ['provider'] }),
      (err) => err.statusCode === 404 && err.code === 'API_NOT_FOUND'
    );
  });

  it('encrypts provider config and syncs decrypted route to Redis for published API', async () => {
    const api = {
      id: API_ID,
      provider_id: PROVIDER_ID,
      slug: 'weather-api',
      status: 'published',
      visibility: 'public',
      category_id: CATEGORY_ID,
    };
    const version = {
      id: VERSION_ID,
      api_id: API_ID,
      version: 'v1',
      base_url: 'https://upstream.weather.example.com',
      status: 'active',
      is_default: true,
    };

    let storedEncrypted;
    mock.method(Api, 'findById', async () => api);
    mock.method(ProviderConfig, 'upsert', async (data) => {
      storedEncrypted = data.authConfig;
      return {
        id: 'cfg-1',
        api_id: API_ID,
        auth_type: data.authType,
        auth_config: data.authConfig,
        timeout_ms: data.timeoutMs,
        retry_count: data.retryCount,
        custom_headers: data.customHeaders,
      };
    });
    mock.method(ApiVersion, 'findByApi', async () => [version]);
    mock.method(ProviderConfig, 'findByApiId', async () => ({
      id: 'cfg-1',
      api_id: API_ID,
      auth_type: 'bearer',
      auth_config: storedEncrypted,
      timeout_ms: 15000,
      retry_count: 2,
      custom_headers: {},
    }));

    const redisWrites = [];
    mock.method(redis, 'del', async () => 1);
    mock.method(redis, 'set', async (key, val) => {
      redisWrites.push({ key, val: JSON.parse(val) });
      return 'OK';
    });

    const res = await providerConfigService.upsertProviderConfig(
      API_ID,
      { id: PROVIDER_ID, roles: ['provider'] },
      {
        auth_type: 'bearer',
        auth_config: { token: 'upstream-secret-999' },
        timeout_ms: 15000,
        retry_count: 2,
      }
    );

    assert.equal(res.has_credentials, true);
    assert.equal(res.auth_config, undefined);
    assert.ok(storedEncrypted.encrypted);
    assert.equal(redisWrites.length, 1);
    assert.equal(redisWrites[0].key, 'route:weather-api:v1');
    assert.equal(redisWrites[0].val.targetBaseUrl, 'https://upstream.weather.example.com');
    assert.equal(redisWrites[0].val.secret, 'upstream-secret-999');
  });

  it('evicts Redis route cache when API is soft-deleted', async () => {
    mock.method(Api, 'findById', async () => ({
      id: API_ID,
      provider_id: PROVIDER_ID,
      slug: 'weather-api',
      category_id: CATEGORY_ID,
    }));
    mock.method(ApiVersion, 'findByApi', async () => [{ version: 'v1' }]);
    const delCalls = [];
    mock.method(redis, 'del', async (...keys) => {
      delCalls.push(...keys);
      return keys.length;
    });
    const softDeleteSpy = mock.method(Api, 'softDelete', async () => {});

    await catalogService.deleteApi(API_ID, { id: PROVIDER_ID, roles: ['provider'] });
    assert.equal(softDeleteSpy.mock.calls.length, 1);
    assert.ok(delCalls.includes('route:weather-api:v1'));
  });
});

describe('HTTP API Integration', () => {
  beforeEach(() => {
    mock.restoreAll();
    mock.method(authRedis, 'get', async () => null);
  });

  it('GET /health returns 200 when Postgres and Redis are up', async () => {
    mock.method(pool, 'query', async () => ({ rows: [{ '?column?': 1 }] }));
    mock.method(redis, 'ping', async () => 'PONG');

    const res = await requestApp('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.checks.postgres, 'up');
    assert.equal(res.body.checks.redis, 'up');
  });

  it('POST /api/v1/apis rejects consumers with 403 and allows providers with 201', async () => {
    const consumerToken = signTestJwt({ roles: ['consumer'] });
    const consumerRes = await requestApp('POST', '/api/v1/apis', {
      headers: { Authorization: `Bearer ${consumerToken}` },
      body: { name: 'Weather', slug: 'weather' },
    });
    assert.equal(consumerRes.status, 403);

    mock.method(Api, 'findBySlug', async () => null);
    mock.method(Api, 'create', async (data) => ({
      id: API_ID,
      provider_id: data.providerId,
      name: data.name,
      slug: data.slug,
      status: 'draft',
      visibility: 'private',
    }));
    mock.method(Api, 'getTags', async () => ['weather']);
    mock.method(Api, 'addTags', async () => {});
    mock.method(redis, 'del', async () => 1);

    const providerToken = signTestJwt({ roles: ['provider'] });
    const providerRes = await requestApp('POST', '/api/v1/apis', {
      headers: { Authorization: `Bearer ${providerToken}` },
      body: { name: 'Weather API', slug: 'weather-api', tags: ['weather'] },
    });
    assert.equal(providerRes.status, 201);
    assert.equal(providerRes.body.slug, 'weather-api');
  });

  it('POST /api/v1/apis/:id/versions blocks SSRF URLs with 400 and creates valid version with 201', async () => {
    const providerToken = signTestJwt({ roles: ['provider'] });

    const ssrfRes = await requestApp('POST', `/api/v1/apis/${API_ID}/versions`, {
      headers: { Authorization: `Bearer ${providerToken}` },
      body: { version: 'v1', base_url: 'http://169.254.169.254/latest/meta-data' },
    });
    assert.equal(ssrfRes.status, 400);
    assert.equal(ssrfRes.body.code, 'SSRF_BLOCKED');

    mock.method(Api, 'findById', async () => ({
      id: API_ID,
      provider_id: PROVIDER_ID,
      slug: 'weather-api',
      status: 'published',
      visibility: 'public',
      category_id: CATEGORY_ID,
    }));
    mock.method(ApiVersion, 'findByApiAndVersion', async () => null);
    mock.method(ApiVersion, 'clearDefaultForApi', async () => {});
    mock.method(ApiVersion, 'create', async (data) => ({
      id: VERSION_ID,
      api_id: data.apiId,
      version: data.version,
      base_url: data.baseUrl,
      status: 'active',
      is_default: true,
    }));
    mock.method(ApiVersion, 'findByApi', async () => []);
    mock.method(ProviderConfig, 'findByApiId', async () => null);
    mock.method(redis, 'del', async () => 1);

    const validRes = await requestApp('POST', `/api/v1/apis/${API_ID}/versions`, {
      headers: { Authorization: `Bearer ${providerToken}` },
      body: { version: 'v1', base_url: 'https://api.weather.example.com', is_default: true },
    });
    assert.equal(validRes.status, 201);
    assert.equal(validRes.body.version, 'v1');
  });

  it('POST /api/v1/apis/:id/endpoints creates endpoint and validates HTTP method', async () => {
    const providerToken = signTestJwt({ roles: ['provider'] });

    const badRes = await requestApp('POST', `/api/v1/apis/${API_ID}/endpoints`, {
      headers: { Authorization: `Bearer ${providerToken}` },
      body: { path: '/forecast', method: 'INVALID' },
    });
    assert.equal(badRes.status, 400);

    mock.method(Api, 'findById', async () => ({
      id: API_ID,
      provider_id: PROVIDER_ID,
      slug: 'weather-api',
      category_id: CATEGORY_ID,
    }));
    mock.method(ApiVersion, 'findDefault', async () => ({ id: VERSION_ID, api_id: API_ID }));
    mock.method(ApiEndpoint, 'create', async (data) => ({
      id: ENDPOINT_ID,
      api_version_id: data.apiVersionId,
      path: data.path,
      method: data.method,
    }));
    mock.method(redis, 'del', async () => 1);

    const okRes = await requestApp('POST', `/api/v1/apis/${API_ID}/endpoints`, {
      headers: { Authorization: `Bearer ${providerToken}` },
      body: { path: 'forecast', method: 'get', summary: 'Get forecast' },
    });
    assert.equal(okRes.status, 201);
    assert.equal(okRes.body.path, '/forecast');
    assert.equal(okRes.body.method, 'GET');
  });

  it('GET /api/v1/internal/routes/:slug/:version resolves route from Redis', async () => {
    const cachedRoute = {
      apiId: API_ID,
      slug: 'weather-api',
      version: 'v1',
      targetBaseUrl: 'https://api.weather.example.com',
      authType: 'bearer',
      secret: 'secret-123',
    };
    mock.method(redis, 'get', async () => JSON.stringify(cachedRoute));

    const res = await requestApp('GET', '/api/v1/internal/routes/weather-api/v1');
    assert.equal(res.status, 200);
    assert.equal(res.body.targetBaseUrl, 'https://api.weather.example.com');
  });

  it('POST /api/v1/marketplace/categories requires admin role', async () => {
    const providerToken = signTestJwt({ roles: ['provider'] });
    const forbiddenRes = await requestApp('POST', '/api/v1/marketplace/categories', {
      headers: { Authorization: `Bearer ${providerToken}` },
      body: { name: 'DevTools', slug: 'devtools' },
    });
    assert.equal(forbiddenRes.status, 403);

    mock.method(Category, 'findBySlug', async () => null);
    mock.method(Category, 'create', async (data) => ({ id: CATEGORY_ID, ...data }));
    mock.method(redis, 'del', async () => 1);

    const adminToken = signTestJwt({ userId: ADMIN_ID, roles: ['admin'] });
    const createdRes = await requestApp('POST', '/api/v1/marketplace/categories', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { name: 'DevTools', slug: 'devtools' },
    });
    assert.equal(createdRes.status, 201);
    assert.equal(createdRes.body.slug, 'devtools');
  });

  after(async () => {
    await Promise.allSettled([redis.quit(), authRedis.quit()]);
  });
});
