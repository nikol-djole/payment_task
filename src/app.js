const express = require("express")
const path = require("path")
const app = express()
const pool = require("./postgres_db");
const crypto = require("crypto");
const {check_signatures, secrets} = require("../public/shared_functions.js")
const bcrypt = require("bcrypt");

//*******************************************************************************************************************
app.use(express.json())
app.use(express.static(path.join(__dirname, "..", "public")))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});
//*******************************************************************************************************************

const mock_url = process.env.MOCK_URL || "http://localhost:3001"

//*******************************************************************************************************************
let li = [];
let last = Date.now();

setInterval(() => {
    const now = Date.now();
    const lag = now - last - 1000;
    last = now;

    li.push(lag);

    if (li.length > 500) {
        li.shift();
    }
}, 1000);

const metrics = {};

function recordMetric(route, durationMs) {
    if (!metrics[route]) metrics[route] = [];
    metrics[route].push(durationMs);

    if (metrics[route].length > 500) {
        metrics[route].shift();
    }
}

function percentile(arr, p) {
    if (!arr || arr.length === 0) return null;

    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}

function measureRoute(routeName) {
    return (req, res, next) => {
        const start = Date.now();

        res.on("finish", () => {
            const duration = Date.now() - start;
            recordMetric(routeName, duration);
            console.log(`${routeName} took ${duration} ms`);
        });

        next();
    };
}


async function processWebhookEventTransaction(x) {

  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const { gateway, eventId, status, paymentId, gatewayPaymentId } = x

    if (!gateway || !eventId || !status || !paymentId || !gatewayPaymentId) {
        await client.query("ROLLBACK");
        console.log(`Webhook evnet for the payment ${paymentId} was not processed, missing required fields.\n`);
      throw new Error("Missing required fields");
    }

    console.log(`Checking if the event ${eventId} already exists in the webhook_events table for the payment ${paymentId}.\n`)
    const existingWebhook = await client.query(
      `
      SELECT *
      FROM "webhook_events"
      WHERE "gateway" = $1 AND "eventId" = $2
      `,
      [gateway, eventId]
    )

    if (existingWebhook.rows.length > 0) {
      await client.query("ROLLBACK");
        console.log(`The event ${eventId} already exists in the webhook_events table for the payment ${paymentId}, returning without db update.\n`);
      return { ok: true, reason: "duplicate_webhook" }
    }

    await client.query(
      `
      INSERT INTO "webhook_events" (
        "gateway",
        "eventId",
        "type",
        "payload",
        "receivedAt"
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [gateway, eventId, status, JSON.stringify(x), new Date()]
    )
    console.log(`Webhook event ${eventId} inserted into webhook_events table. Now checking if payment exists in payments table.\n`);

    const payment_found = await client.query(
      `
      SELECT *
      FROM "payments"
      WHERE "id" = $1
        AND "gatewayPaymentId" = $2
      FOR UPDATE
      `,
      [paymentId, gatewayPaymentId]
    )

    if (payment_found.rows.length === 0) {
      await client.query("COMMIT");
      console.log(`Payment ${paymentId} not found, returning without 'payments' update.\n`);
      throw new Error(`Payment ${paymentId} not found in payments`);
    }

    console.log(`Payment ${paymentId} found, looking at the status now.\n`);

    const currentStatus = payment_found.rows[0].status;

    if (currentStatus === status) {
      await client.query("COMMIT")
        console.log(`The payment ${paymentId} already has the status ${status}, returning without 'payments' update.\n`);
      return { ok: true, reason: "duplicate_status_skipped" }
    }

    if (currentStatus === "CAPTURED" && status === "FAILED") {
      await client.query("COMMIT");
      console.log(` The payment ${paymentId} was already captured, but status is 'FAILED', returning without 'payments' update\n`);
      return { ok: true, reason: "failed_after_captured_ignored" }
    }

    const allowedTransitions = {
      CREATED: ["PENDING", "AUTHORIZED", "FAILED"],
      PENDING: ["AUTHORIZED", "FAILED"],
      AUTHORIZED: ["CAPTURED", "FAILED"],
      CAPTURED: ["REFUNDED"],
      FAILED: [],
      REFUNDED: []
    }

    const allowedNext = allowedTransitions[currentStatus] || []

    if (!allowedNext.includes(status)) {
      await client.query("COMMIT")
        console.log(`Invalid status transition for the payment ${paymentId}, returning without 'payments' update.\n`);
      return {
        ok: true,
        reason: "invalid_transition",
        current_status: currentStatus,
        attempted_status: status
      }
    }

    const updatedPayments = await client.query(
      `
      UPDATE "payments"
      SET "status" = $1,
          "updatedAt" = NOW()
      WHERE "id" = $2
        AND "gatewayPaymentId" = $3
      RETURNING *
      `,
      [status, paymentId, gatewayPaymentId]
    )
    console.log(`Payment status updated in payments table for the payment ${paymentId} with status ${status}.\n Checking if payment is already in ledger table.\n`)

    if (status === "CAPTURED") {
      const type = "PAYMENT_CAPTURE"

      const existing_ledger = await client.query(
        `
        SELECT *
        FROM "ledger_entries"
        WHERE "paymentId" = $1
          AND "type" = $2
        `,
        [paymentId, type]
      )

      if (existing_ledger.rows.length === 0) {
        const ledgerEntryData = await client.query(
            `
            SELECT "userId", "amount", "currency"  FROM "payments" WHERE "id" = $1 AND "gatewayPaymentId" = $2
            `, [paymentId, gatewayPaymentId]
        );
        const userId = ledgerEntryData.rows[0].userId;
        const amount = ledgerEntryData.rows[0].amount;
        const currency = ledgerEntryData.rows[0].currency;
        await client.query(
          `
          INSERT INTO "ledger_entries" (
            "id",
            "paymentId",
            "userId",
            "direction",
            "amount",
            "currency",
            "type",
            "createdAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [crypto.randomUUID(),
            paymentId,
            userId,
            "CREDIT",
            amount,
            currency,
            type,
            new Date()
          ]
        );
        console.log(`Payment ${paymentId} was captured, ledger entry inserted into ledger_entries table.\nNow checking if payment is already in outbox table.\n`);
        const outBoxPayload = await client.query(
            `
            SELECT * FROM "current_buys" WHERE "paymentId" = $1 AND "gatewayPaymentId" = $2
            `, [paymentId, gatewayPaymentId]
        );
        const payload = {
            ...outBoxPayload.rows[0],
            ...x
        }
        await client.query(
          `
          INSERT INTO "outbox" (
            "id",
            "type",
            "payload",
            "status"
          )
          VALUES ($1, $2, $3, $4)
          `,
          [crypto.randomUUID(),
            "RECEIPT_EMAIL",
            JSON.stringify(payload),
            "PENDING"

          ]
        )
          console.log(`Payment ${paymentId} was captured, outbox entry inserted into outbox table, function done.\n`);
      }
    }

    await client.query("COMMIT")
    return { ok: true, reason: "processed"}
  }
  catch (err) {
    throw err

  } finally {
    client.release()
  }
}

//*******************************************************************************************************************

app.get("/metrics-data", (req, res) => {
    function safeRoute(arr) {
        if (!arr || arr.length === 0) {
            return {
                count: null,
                p95_ms: null,
                p99_ms: null
            };
        }

        return {
            count: arr.length,
            p95_ms: percentile(arr, 95),
            p99_ms: percentile(arr, 99)
        };
    }

    res.json({
        lag: {
            samples: li.length || null,
            avgLagMs: li.length ? Math.round(li.reduce((a, b) => a + b, 0) / li.length) : null,
            p95LagMs: li.length ? percentile(li, 95) : null,
            p99LagMs: li.length ? percentile(li, 99) : null,
            maxLagMs: li.length ? Math.max(...li) : null
        },
        routes: {
            payments: safeRoute(metrics["/payments"]),
            customers: safeRoute(metrics["/customers"]),
            products: safeRoute(metrics["/products"]),
            webhooksMock: safeRoute(metrics["/webhooks/mock"]),
            paymentById: safeRoute(metrics["/payments/:id"])
        }
    });
});
app.post("/payments",measureRoute("/payments"), async (req, res) => {

    const paymentId = crypto.randomUUID();

    console.log( `Payment with payment id: ${paymentId} was initiated.\n`);
    try {
    const { userId, amount, currency } = req.body;

    const idempotencyKey = req.header("Idempotency-Key");

     if (!userId || !amount || !currency || !idempotencyKey ) {
         console.log(userId,amount,currency,idempotencyKey);
     console.log(`Webhook evnet for the payment ${paymentId} misses a required field.\n`);
      throw new Error("Missing required fields");
    }
    const payments_entry = await pool.query(
      `
      INSERT INTO "payments" (
        "id",
        "userId",
        "amount",
        "currency",
        "status",
        "gateway",
        "idempotencyKey",
        "createdAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT ("idempotencyKey") DO NOTHING
      RETURNING *
      `,
      [paymentId, userId, amount, currency, "CREATED", "mock", idempotencyKey, new Date()]
    );
   if (payments_entry.rows.length === 0) {
       console.log(`Payment with  payment id: ${paymentId} was not inserted into payments table. The key already exists.\n`);
       throw new Error("Payment already exists.");
   }
   console.log(`Payment with payment id: ${paymentId} was inserted into payments table.\n`);

    const webhook_body = {
              action: "create_payment",
              amount: amount,
              currency: currency,
              paymentId: paymentId

          };

    const init_webhook = await fetch(`${mock_url}/mock/checkout`, {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              "X-Signature": secrets(webhook_body)
          },
          body: JSON.stringify(webhook_body)
      });

    const initial_gateway_response = await init_webhook.json();

    console.log(`gatewayPaymentId and checkoutUrl were received from the gateway for the payment with payment id: ${paymentId}.\n`);

    const gatewayPaymentId = initial_gateway_response.gatewayPaymentId;
    console.log(`gatewayPaymentId: ${gatewayPaymentId}\n`);
    const client = await pool.connect();

    try {
          await client.query("BEGIN");

          const update_payments = await client.query(
            `
            UPDATE "payments"
            SET "gatewayPaymentId" = $1,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "idempotencyKey" = $2
              AND "id" = $3
            RETURNING *
            `, [gatewayPaymentId, idempotencyKey, paymentId]
          );

          if (update_payments.rows.length === 0) {
            await client.query("ROLLBACK");
            console.log(`For the payment with payment id: ${paymentId}, the gatewayPaymentId was not inserted into payments table.\n`);
            throw new Error("Payment not found in payments table in order to update the gatewayPaymentId.");
          }

          const payment_row = update_payments.rows[0];

          const customer_row = await client.query(
              `
              SELECT * FROM "customers" WHERE "userId" = $1
              `, [userId]
          );
          if (customer_row.rows.length === 0) {
              await client.query("ROLLBACK");
              console.log(`For the payment with payment id:  ${paymentId},  customer info was not found in customers table.\n`);
              throw new Error("Customer not found in customers table in order to update the customer info.");
          }
          const customer_info = customer_row.rows[0];
          await client.query(
            `
            INSERT INTO "current_buys" (
              "paymentId",
              "userId",
              "gatewayPaymentId",
              "idempotencyKey",
              "currency",
              "amount",
              "email",
              "address",
              "zipCode",
              "town",
              "firstName",
              "lastName"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `,
            [
              payment_row.id,
              payment_row.userId,
              payment_row.gatewayPaymentId,
              payment_row.idempotencyKey,
              payment_row.currency,
              payment_row.amount,
              customer_info.email,
              customer_info.address,
              customer_info.zipCode,
              customer_info.town,
              customer_info.firstName,
              customer_info.lastName
            ]
          );

          await client.query("COMMIT");
        }
        catch (err) {
          await client.query("ROLLBACK");
          throw err;
        }
        finally {
          client.release();
        }
        console.log(`For the payment with payment id: ${paymentId} gatewayPaymentId was inserted into payments table.\n`)
        res.json({
            paymentId:paymentId,
            checkoutUrl: initial_gateway_response.checkoutUrl

          });
        console.log(`For the payment with payment id: ${paymentId} paymentId and checkoutUrl was sent to the frontend, payments call is done!\n`)
      }
      catch (err) {
    console.error(`For the payment with payment id: ${paymentId}, error occurred during payment creation, returning error:\n${err.message}\n`);
    res.json({ error: err.message });
  }
});

//*******************************************************************************************************************

app.post("/customers",measureRoute("/customers"), async (req, res) => {

    const { username, password } = req.body;

    console.log( `Customer data request was received for ${username}.\n`);
    try {
         const full_customer_data = await pool.query(
        `
       SELECT "userId", "firstName", "lastName","phoneNumber", "address","zipCode","town", "email", "password"
        FROM "customers"
        WHERE "userName" = $1
        `, [username]
    );
    if (full_customer_data.rows.length === 0) {
        console.log(`Customer data request was not found for ${username}.\n`);
        throw new Error(`Customer not found for the username: ${username}`);
    }
    const customer = full_customer_data.rows[0];

    const passwordMatch = await bcrypt.compare(password, customer.password);

    if(!passwordMatch) {
        console.log(`Password for the username: ${username} is incorrect.\n`);
        throw new Error("Incorrect password");
    }
    const { password: _, ...customerWithoutPassword } = customer;
    res.json(customerWithoutPassword);
    console.log(`Customer data request was found for ${username}, customer data was sent to the frontend.\n`);
    }
    catch (err){
        console.error(`Error occurred during customer data request for ${username}, returning error:\n${err.message}\n`);
        res.json({ error: err.message });
    }

});

//*******************************************************************************************************************

app.post("/products", measureRoute("/products"),async (req, res) => {

    const {prod_id} = req.body;

    console.log(`Product data fetch was initiated for the product: ${prod_id}.\n`);

    try {
        const prod_data = await pool.query(
        `
        SELECT "productId", "name", "price", "currency"
         FROM "products"
         WHERE "productId" = $1;
        `, [prod_id]);

    if (prod_data.rows.length === 0) {
        console.log(`The product: ${prod_id} does not exist in the database.\n`);
        throw new Error(`Product not found for the product id: ${prod_id}`);
    }
    res.json(prod_data.rows[0]);
    console.log(`Product data for ${prod_id} sent to the frontend.\n`)

    }
    catch (err) {
        console.log(`Error occurred during product data fetch for the product: ${prod_id}, returning error:\n${err.message}\n`);
        res.json({ error: err.message });
    }

});

//*******************************************************************************************************************

app.post("/webhooks/mock", measureRoute("/webhooks/mock"),  async (req,res) => {
    console.log("Webhook request was received.\n")

    try {
        check_signatures(req.get("X-Signature"),req.body);
        console.log("Signature is correct.\n");
         const paymentId = req.body.paymentId;

         if (paymentId === undefined) {
             console.log("Payment ID is missing in the request body.\n");
             throw new Error("Payment ID is missing in the request body.");
         }

        console.log("Payment id is ",req.body.paymentId,".\n");

        const payment_information = {
            action: "processing_payment",
            ...req.body
        };

        await processWebhookEventTransaction(payment_information);
        console.log(`Payment data was processed for the payment with id: ${paymentId}\n`);
        res.json({status: "roger that!"});
        console.log(`Process has been confirmed to the frontend for the payment with id: ${paymentId}\n.`);

    }
    catch (err) {
     res.json({ error: err.message });
    }

})


//*******************************************************************************************************************

app.get("/payments/:id",measureRoute("/payments/:id"), async (req, res) => {

    const paymentId = req.params.id;

    console.log(`A request was initiated to update on the status of payment the payment: ${paymentId}.\n`)

    const client = await pool.connect();

    try {
        console.log(`Looking up the ${paymentId} payment in DB.\n`)
        await client.query("BEGIN");

        const payment_data = await client.query(
            `
            SELECT *
            FROM "payments"
            WHERE "id" = $1
            `, [paymentId]
        );

        if (payment_data.rows.length !== 1) {
            await client.query("ROLLBACK");
            console.log(`Payment with id: ${paymentId} not found or there is more than one payment with the same id in the DB.\n`);
            throw new Error("Payment not found or there is more than one payment with the same id in DB.");
        }


        const ledger_data = await client.query(
            `
            SELECT *
            FROM "ledger_entries"
            WHERE "paymentId" = $1
            `, [paymentId]
        );

        await client.query("COMMIT");

        res.json({
            payment_data: payment_data.rows[0],
            ledger_data: ledger_data.rows.length > 0? ledger_data.rows[0] : null
        });

         console.log(`Payment and Ledger data was found for the payment with id: ${paymentId} and sent to the frontend.\n`);
    }
    catch (err) {
        await client.query("ROLLBACK");
        res.json({ error: err.message });
        console.log(`An error occurred during update/insert of the payment: ${paymentId}, returning error\n${err}\n`);
    }
    finally {
        client.release();
    }

    })


