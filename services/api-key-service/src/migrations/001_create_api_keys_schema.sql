-- API Key service: create schema and enable extensions
CREATE SCHEMA IF NOT EXISTS api_keys;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
