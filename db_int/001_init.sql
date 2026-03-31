CREATE TABLE payments (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED')),
  gateway TEXT NOT NULL,
  gateway_payment_id TEXT,
  idempotency_key UUID NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP
);

CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('PAYMENT_CAPTURE')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (payment_id, type)
);

CREATE TABLE webhook_events (
  gateway TEXT NOT NULL,
  event_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (gateway, event_id)
);

CREATE TABLE outbox (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('RECEIPT_EMAIL')),
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  next_attempt_at TIMESTAMP,
  attempts INTEGER NOT NULL DEFAULT 0

);
CREATE TABLE customers (
  user_id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  address TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  town TEXT NOT NULL,
  email TEXT NOT NULL,
  user_name TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

CREATE TABLE products (
  product_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  currency TEXT NOT NULL,
  amount INTEGER NOT NULL,
 updated_at TIMESTAMP
);
CREATE TABLE current_buys (
  payment_id UUID PRIMARY KEY REFERENCES payments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES customers(user_id) ON DELETE CASCADE,
  gateway_payment_id TEXT NOT NULL UNIQUE,
  idempotency_key UUID NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount INTEGER NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  town TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);