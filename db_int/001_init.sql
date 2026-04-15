CREATE TABLE "payments" (
  "id" UUID PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED')),
  "gateway" TEXT NOT NULL,
  "gatewayPaymentId" TEXT,
  "idempotencyKey" UUID NOT NULL UNIQUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP
);

CREATE TABLE "ledger_entries" (
  "id" UUID PRIMARY KEY,
  "paymentId" UUID NOT NULL REFERENCES "payments"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL,
  "direction" TEXT NOT NULL CHECK ("direction" IN ('CREDIT', 'DEBIT')),
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "type" TEXT NOT NULL CHECK ("type" IN ('PAYMENT_CAPTURE')),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE ("paymentId", "type")
);

CREATE TABLE "webhook_events" (
  "gateway" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE ("gateway", "eventId")
);

CREATE TABLE "outbox" (
  "id" UUID PRIMARY KEY,
  "type" TEXT NOT NULL CHECK ("type" IN ('RECEIPT_EMAIL')),
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('PENDING', 'SENT', 'FAILED')),
  "nextAttemptAt" TIMESTAMP,
  "attempts" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "customers" (
  "userId" TEXT PRIMARY KEY,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "zipCode" TEXT NOT NULL,
  "town" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "userName" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL
);

CREATE TABLE "products" (
  "productId" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "updatedAt" TIMESTAMP
);

CREATE TABLE "current_buys" (
  "paymentId" UUID PRIMARY KEY REFERENCES "payments"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "customers"("userId") ON DELETE CASCADE,
  "gatewayPaymentId" TEXT NOT NULL UNIQUE,
  "idempotencyKey" UUID NOT NULL UNIQUE,
  "currency" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "email" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "zipCode" TEXT NOT NULL,
  "town" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);