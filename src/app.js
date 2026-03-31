const express = require("express")
const path = require("path")
const app = express()
const pool = require("./postgres_db");
const crypto = require("crypto");

//*******************************************************************************************************************
app.use(express.json())
app.use(express.static(path.join(__dirname, "..", "public")))
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});
//*******************************************************************************************************************

//LAG CALCULATION
const mock_url = process.env.MOCK_URL || "http://localhost:3001"

let li =[]
let last = Date.now();
setInterval(() => {
    const now = Date.now();
    const lag = now - last - 1000;
    last = now;
    li.push(lag);
    if (li.length > 500) li.shift();
    //lag=${lag}ms`);
}, 1000);
//console.log(`mean lag=${li.reduce((a, b) => a + b, 0) / li.length}ms`);
//*******************************************************************************************************************

//SECRET KEY AND CHECKING THE SIGNATURE
const secret_key = "wouldn't you like to know?"
function secrets(raw_body) {
    const y = typeof raw_body === "string" ? raw_body : JSON.stringify(raw_body);
  return crypto.createHmac("sha256", secret_key).update(y).digest("hex")
}

function check_sig(new_sig,raw_body){
    const want_sig = secrets(raw_body)
    const a = Buffer.from(new_sig, "hex")
    const b = Buffer.from(want_sig, "hex")
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)){
        return false;
    }else return true;
}

async function update_the_dbs(x) {
    const pi = `payments_entry_${i-1}`
    const we = `webhook_entry_${j-1}`
    console.log(`data base update/insert is started based on payments req ${i-1} and webhook req ${j-1}\n`)
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const { gateway, eventID, status, payment_id, idempotency_key, gatewayPaymentId } = x

    if (!gateway || !eventID || !status || !payment_id || !idempotency_key || !gatewayPaymentId) {
        await client.query("ROLLBACK")
        console.log(pi,we,"missing required fields, returning 400")
      return { ok: false, reason: "missing_required_fields" }
    }

    console.log(pi,we,"checking if webhook already exists\n")
    const existingWebhook = await client.query(
      `
      SELECT *
      FROM webhook_events
      WHERE gateway = $1 AND event_id = $2
      `,
      [gateway, eventID]
    )

    if (existingWebhook.rows.length > 0) {
      await client.query("ROLLBACK")
        console.log(pi,we,"webhook event already exists, returning without db update\n")
      return { ok: true, reason: "duplicate_webhook" }
    }

    await client.query(
      `
      INSERT INTO webhook_events (
        gateway,
        event_id,
        type,
        payload,
        received_at
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [gateway, eventID, status, JSON.stringify(x), new Date()]
    )
    console.log(pi,we,"new webhook event inserted into webhook_events table\n Now checking if payment exists in payments table.")

    const found = await client.query(
      `
      SELECT *
      FROM payments
      WHERE id = $1
        AND idempotency_key = $2
        AND gateway_payment_id = $3
      FOR UPDATE
      `,
      [payment_id, idempotency_key, gatewayPaymentId]
    )

    if (found.rows.length === 0) {
      await client.query("COMMIT")
        console.log(pi,we,"payment not found, returning without 'payments' update\n")
      return { ok: false, reason: "payment_not_found_continue" }
    }

    console.log(pi,we,"payment found, looking at status now.\n")
    const payment = found.rows[0]
    const currentStatus = payment.status

    if (currentStatus === status) {
      await client.query("COMMIT")
        console.log(pi,we,"status is the same, returning without 'payments' update\n")
      return { ok: true, reason: "duplicate_status_skipped" }
    }

    if (currentStatus === "CAPTURED" && status === "FAILED") {
      await client.query("COMMIT");
      console.log(pi,we,"payment was already captured, but status is 'FAILED', returning without 'payments' update\n")
      return { ok: true, reason: "failed_after_captured_ignored", row: payment }
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
        console.log(pi,we,"invalid status transition, returning without 'payments' update\n")
      return {
        ok: false,
        reason: "invalid_transition",
        current_status: currentStatus,
        attempted_status: status
      }
    }

    const updated = await client.query(
      `
      UPDATE payments
      SET status = $1,
          updated_at = NOW()
      WHERE id = $2
        AND idempotency_key = $3
        AND gateway_payment_id = $4
      RETURNING *
      `,
      [status, payment_id, idempotency_key, gatewayPaymentId]
    )
    console.log(pi,we,"payment status updated in payments table\nChecking if payment is already in ledger table.")

    if (status === "CAPTURED") {
      const type = "PAYMENT_CAPTURE"

      const existing_ledger = await client.query(
        `
        SELECT *
        FROM ledger_entries
        WHERE payment_id = $1
          AND type = $2
        `,
        [payment_id, type]
      )

      if (existing_ledger.rows.length === 0) {
        const user_id_q = await client.query(
            `
            SELECT user_id FROM payments WHERE id = $1 AND idempotency_key = $2 AND gateway_payment_id = $3
            `, [payment_id, idempotency_key, gatewayPaymentId]
        );
        const user_id = user_id_q.rows[0].user_id;
        await client.query(
          `
          INSERT INTO ledger_entries (
            id,
            payment_id,
            user_id,
            direction,
            amount,
            currency,
            type,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [crypto.randomUUID(),
            payment_id,
            user_id,
            "CREDIT",
            x.amount,
            x.currency,
            type,
            new Date()
          ]
        );
        console.log(pi,we,"payment was captured, ledger entry inserted into ledger_entries table\nNow checking if payment is already in outbox table.");
        const out_box_payload = await client.query(
            `
            SELECT * FROM current_buys WHERE payment_id = $1 AND idempotency_key = $2 AND gateway_payment_id = $3
            `, [payment_id, idempotency_key, gatewayPaymentId]
        );
        const pl = {
            ...out_box_payload.rows[0],
            ...x
        }
        await client.query(
          `
          INSERT INTO outbox (
            id,
            type,
            payload,
            status
          )
          VALUES ($1, $2, $3, $4)
          `,
          [crypto.randomUUID(),
            "RECEIPT_EMAIL",
            JSON.stringify(pl),
            "PENDING"

          ]
        )
          console.log(pi,we,"payment was captured, outbox entry inserted into outbox table, function done.\n");
      }
    }

    await client.query("COMMIT")
    return { ok: true, reason: "processed"}
  } catch (err) {
    await client.query("ROLLBACK")
    console.log(pi,we,`error occurred during update/insert, returning error\n${err}`)
  } finally {
    client.release()
  }
}

//*******************************************************************************************************************

let i = 1

app.post("/payments", async (req, res) => {
    const req_id = `payments_request_${i}`;
    i++
    console.log(req_id, "was initiated\n");
    try {
    const { userId, amount, currency, email, product_name, zip_code, town, first_name, last_name, address } = req.body;

    const idempotencyKey = req.header("Idempotency-Key");
    const check_idempotency = await pool.query(
        `
        SELECT * FROM payments WHERE idempotency_key = $1`, [idempotencyKey]
    );
    if (check_idempotency.rows.length !== 0) return res.status(409).json({error: "idempotency key already used"});

    const paymentId = crypto.randomUUID();

    console.log(req_id, "initial payment was inserted into payments table\n")

    const result = await pool.query(
      `
      INSERT INTO payments (
        id,
        user_id,
        amount,
        currency,
        status,
        gateway,
        idempotency_key,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [paymentId, userId, amount, currency, "CREATED", "mock", idempotencyKey, new Date()]
    );

    console.log(req_id, "payment id and url request was sent to the mock payment service\n")

    const load = {
              action: "create_payment",
              amount: amount,
              currency: currency,
              payment_id: paymentId,
              idempotency_key: idempotencyKey
          };
    const sig = secrets(load);

    const init_webhook = await fetch(`${mock_url}/mock/checkout`, {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              "signature": sig,
          },
          body: JSON.stringify(load)
      });

    const data = await init_webhook.json();

    console.log(req_id, "gate way payment id and url received\n");

    const gatewayPaymentId = data.gatewayPaymentId;
    const payment_id = data.payment_id;
    const idm_ey = data. idempotency_key;

    const client = await pool.connect();

    try {
          await client.query("BEGIN");

          const updated = await client.query(
            `
            UPDATE payments
            SET gateway_payment_id = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE idempotency_key = $2
              AND id = $3
            RETURNING *
            `, [gatewayPaymentId, idm_ey, payment_id]
          );

          if (updated.rows.length === 0) {
            await client.query("ROLLBACK")

            return res.status(404).json({ error: "Payment not found" })
          }

          const p = updated.rows[0];

          await client.query(
            `
            INSERT INTO current_buys (
              payment_id,
              user_id,
              gateway_payment_id,
              idempotency_key,
              product_name,
              currency,
              amount,
              email,
              address,
              zip_code,
              town,
              first_name,
              last_name
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `,
            [
              p.id,
              p.user_id,
              p.gateway_payment_id,
              p.idempotency_key,
              product_name,
              p.currency,
              p.amount,
              email,
              address,
              zip_code,
              town,
              first_name,
              last_name
            ]
          );

          await client.query("COMMIT");
        }
        catch (err) {
          await client.query("ROLLBACK");
          console.error(err)
          res.status(500).json({ error: "failed to create payment" })
        }
        finally {
          client.release()
        }
        console.log(req_id, "gate way payment inserted into payments table\n")

        res.json({
            ...data
          });
        console.log(req_id, "payment data sent to the frontend, pyments call is done!\n")
      }
      catch (err) {
    console.error(err)
    res.status(500).json({ error: "failed to create payment" })
  }
});

//*******************************************************************************************************************

app.post("/customers", async (req, res) => {

    const req_id = `customer_data_request_${i}`;
    console.log(req_id, "was initiated to get customer data\n");

    const { username, password } = req.body;
    const full_customer_data = await pool.query(
        `
       SELECT user_id, first_name, last_name,phone_number, address,zip_code,town, email, phone_number
        FROM customers
        WHERE user_name = $1 AND password = $2
        `, [username, password]
    );
    if (full_customer_data.rows.length === 0) {
        res.status(404).json({ error: "Customer not found" })
    }
    else {
        res.json(full_customer_data.rows[0])
        console.log(req_id, "customer data sent to the frontend this request is done!\n")
    }
});

//*******************************************************************************************************************

app.post("/products", async (req, res) => {

    const req_id = `product_data_request_${i}`;
    console.log(req_id, "was initiated to get product data\n")

    const {prod_id} = req.body;

    const prod_data = await pool.query(
        `
        SELECT product_id, name, price, currency, price
         FROM products
         WHERE product_id = $1;
        `, [prod_id]
    );

    const update = await pool.query(
        `
        UPDATE products SET amount = amount - 1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $1;
        `, [prod_id]);

    if (prod_data.rows.length === 0) {
        res.status(404).json({ error: "Product not found" })
    }
    else {
        res.json(prod_data.rows[0]);
        console.log(req_id, "product data sent to the frontend this request is done!\n")

    }
});

//*******************************************************************************************************************
let j = 1;
app.post("/webhooks/mock",  express.raw({ type: "application/json" }), async (req,res) => {

    const req_id = `webhook_mock_request_${j}`
    console.log(req_id, "was initiated gateway payment data was provided\n")
    j++

    const see = check_sig(req.headers["signature"],req.body);
    if (see) {

        if (req.body.action === "abort") {
            console.log(req_id, "payment was aborted here. The user exited the pay service page.\n")

            const first = await pool.query(
            `SELECT * FROM payments WHERE id = $1`,
            [req.body.payment_id]
            );
            const curr_status = first.rows[0]?.status;

             if (curr_status === "CAPTURED" || curr_status === "FAILED") {
            return res.status(200).json({ status: "ignored" });
            }
            await pool.query(
                `
                UPDATE payments
                SET status = 'FAILED',
                updated_at = CURRENT_TIMESTAMP
                WHERE id = $1;
                `, [ req.body.payment_id]
            );
            res.status(200).json({status: "aborted"});
            console.log(req_id, "payment was aborted\n")
            return;
        }

        console.log(req_id, "signature is correct\n")
        console.log(req_id, `the payment id is ${req.body.payment_id}\n and the status is ${req.body.status}\n`)

        const in_goes = {
            action: "processing_payment",
            ...req.body
        }

        await update_the_dbs(in_goes);
        console.log(req_id, "payment data was processed\n")
        res.json({status: "roger that!"});
        console.log(req_id, "process is beed confirmed to the frontend.\n")
    }

})
let ii = 1;

//*******************************************************************************************************************

app.get("/payments/:id", async (req, res) => {

    const payment_id = req.params.id;
    const req_id = `frontend payment_id_request_${ii}`;
    ii++
    console.log(req_id, `was initiated to update on the status of payment ${payment_id}\n`)

    const client = await pool.connect();

    try {
        console.log(req_id,"looking up payment in DB")
        await client.query("BEGIN");

        const payment_status = await client.query(
            `
            SELECT *
            FROM payments
            WHERE id = $1
            `, [payment_id]
        );

        if (payment_status.rows.length === 0) {
            await client.query("ROLLBACK");
            res.json({ payment_status: "FAILED" });

            return;
        }

        const payment = payment_status.rows[0];

        const ledger_status = await client.query(
            `
            SELECT *
            FROM ledger_entries
            WHERE payment_id = $1
            `, [payment_id]
        );

        await client.query("COMMIT");

        console.log(req_id,"payment status has been looked up and ledger and payment status were sent to the frontend")

        return res.json({
            payment_status: payment.status,
            ledger_status: ledger_status.rows.length > 0? "PAYMENT_CAPTURED" : "PAYMENT_NOT_ENTERED"
        });
    }
    catch (err) {
        await client.query("ROLLBACK");
        console.log(req_id,`error occurred during update/insert, returning error\n${err}`);
        return res.json({ payment_status: "FAILED" });
    }
    finally {
        client.release();
    }

    })


