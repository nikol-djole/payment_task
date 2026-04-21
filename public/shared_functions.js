const crypto = require("crypto");


const secret_key = process.env.SECRET_KEY;


function secrets(raw_body) {
    const y = typeof raw_body === "string" ? raw_body : JSON.stringify(raw_body);
  return crypto.createHmac("sha256", secret_key).update(y).digest("hex")
}
function check_signatures(new_sig, raw_body) {
    const want_sig = secrets(raw_body);
    const a = Buffer.from(new_sig, "hex");
    const b = Buffer.from(want_sig, "hex");

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        throw new Error("Signatures do not match");
    }
}

const schemas = {
    payments: {
        userId: "string",
        amount: "positiveInteger",
        currency: "currency"
    },

    customers: {
        username: "string",
        password: "string"
    },

    products: {
        prod_id: "string"
    },

    webhook: {
        paymentId: "uuid",
        gatewayPaymentId: "uuid",
        status: "status",
        eventId: "uuid",
        gateway: "string"
    },

    paymentResponse: {
        gatewayPaymentId: "uuid",
        checkoutUrl: "checkoutUrl"
    }

};

function isUuid(v) {
    return typeof v === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function isCheckoutUrl(v) {
    if (typeof v !== "string" || v.length === 0) return false;

    try {
        const url = new URL(v);
        const paymentId = url.searchParams.get("paymentId");
        const gatewayPaymentId = url.searchParams.get("gatewayPaymentId");

        return isUuid(paymentId) && isUuid(gatewayPaymentId);
    } catch {
        return false;
    }
}

function validateValue(value, rule) {
    switch (rule) {
        case "string":
            return typeof value === "string" && value.trim().length > 0;

        case "positiveInteger":
            return Number.isInteger(value) && value > 0;

        case "currency":
            return typeof value === "string" && ["CHF", "EUR", "USD"].includes(value);

        case "uuid":
            return isUuid(value);

        case "status":
            return typeof value === "string" &&
                ["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "REFUNDED"].includes(value);

        case "checkoutUrl":
            return isCheckoutUrl(value);

        default:
            throw new Error(`Unknown validation rule: ${rule}`);
    }
}

function validateBody(body, schemaKey) {
    const schema = schemas[schemaKey];

    if (!schema) {
        throw new Error(`Unknown schema: ${schemaKey}`);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new Error("Body must be an object");
    }

    const allowedKeys = Object.keys(schema);
    const bodyKeys = Object.keys(body);

    for (const key of allowedKeys) {
        if (!(key in body)) {
            throw new Error(`Missing field: ${key}`);
        }
    }

    for (const key of bodyKeys) {
        if (!allowedKeys.includes(key)) {
            throw new Error(`Unexpected field: ${key}`);
        }
    }

    for (const [key, rule] of Object.entries(schema)) {
        if (!validateValue(body[key], rule)) {
            throw new Error(`Invalid field: ${key}`);
        }
    }

    return true;
}


module.exports = { check_signatures, secrets, validateBody, isUuid};