
TASK DESCRIPTION

To my understanding, the main task is to build a backend system that processes payments. A payment request comes from
the frontend through `POST /payments`, and from there the backend initiates the payment process by calling the payment
service through a checkout request. The gateway then responds with the checkout URL and the related gateway data. During
this first part, the backend creates or updates the payment row in the database.

Once the process is initiated, the mock gateway sends delayed payment updates back to the backend through webhooks. The
backend receives these events and updates or inserts data into the relevant tables, mainly 'payments', 'webhook_events',
'ledger_entries', and 'outbox'. It also exposes the current payment and ledger status back to the frontend. The mock
service simulates different payment scenarios like duplicate webhooks, delayed events, or invalid event order, so the
backend has to stay correct under those cases too. I also built a small shop frontend that creates the buy and payment
attempts, as well as a frontend for the mock gateway where the buyer can enter payment details. There is no account
creation in the frontend, but as I understood the task, that was not really the important part here.


THE CODE

The main app serves the shop page, handles customer and product lookups, creates payments, exposes payment status,
receives webhook events from the mock gateway, and updates the database.

The mock gateway acts like a fake payment provider. It accepts checkout creation requests from
the main app, returns a hosted payment page, and then sends webhook events back to the app. It can simulate several
difficult cases such as duplicate webhooks, delayed events, failed payments, aborted payments, and invalid ordering like
'FAILED' arriving after ^^CAPTURED'.

The database acts as the source of truth. Payments, webhook events, ledger entries, current buys, customers, products,
and outbox records are all stored there.

There is also a worker process that reads pending entries from the outbox table and handles side effects outside the
main payment flow. In my case it looks for `PENDING` outbox rows, creates a PDF receipt, and sends it by email to the
customer, then marks the row as `SENT` or `FAILED` depending on the result.

Altogether i hope it matches the task description.


PAYMENT PROCESS

A user opens the storefront and clicks **Pay** on a product.The frontend asks for login credentials. These are checked
against the seeded `customers` table. Once the user is identified, product data is loaded from the `products` table.
The frontend then sends a `POST /payments` request to the backend with user data, product amount and currency, plus an
`Idempotency-Key` header. The backend creates the payment, stores it in Postgres, and contacts the mock gateway.
The mock gateway verifies the request signature and returns a `payment_url` together with a `gatewayPaymentId`.

The frontend opens that payment URL in a separate window. The user enters card details on the mock payment page. After
that, the mock gateway simulates one of several scenarios and sends signed webhook events back to `POST /webhooks/mock`
on the main app. The backend processes those events, updates the relevant tables, prevents unnecessary or wrond updates.
If the payment reaches `CAPTURED`, the system can create the corresponding ledger entry and queue the receipt side
effect through the outbox table. Meanwhile, the storefront polls `GET /payments/:id` and updates the UI once the payment
reaches a final state.


PROJECT STRUCTURE


{
  "db_int": {
    "001_init.sql": "creates all core tables",
    "fill_tables.sql": "seeds demo customers and demo products"
  },
  "public": {
    "index.html": "storefront UI",
    "mock-getaway-service": {
      "index.html": "hosted mock payment page",
      "mock-app.js": "mock gateway service"
    }
  },
  "src": {
    "app.js": "main backend application",
    "out_box_worker.js": "background worker for outbox processing",
    "postgres_db.js": "Postgres connection setup"
  },
  "docker-compose.yml": "runs postgres, app, worker, and mock gateway",
  "Dockerfile": "container build definition",
  "package.json": "node dependencies and scripts",
  ".env": "local environment variables"
}

HOW TO RUN

go to the root folder of the project in terminal and run `docker-compose up`

open http://localhost:3000 in your browser this will open the storefront
http://localhost:3001 is the mock gateway frontend, though you do not need to open it, ince it will open automatically

Once in store just try to buy something and pay with a card. So you chose a product and click on the pay button.
Then you will be asked to login. Use any of the usernames and passwords from the seed data. For Example:
username: lucas-meier
password: cust001

then you will be redirected to the payment page.
enter whatever card details you want and click pay.
You will wait for the payment to be processed. When processed you will be redirected to the storefront.

Right now the mock gateway operats with a 70% probability of a normal payment.

"if (c > 0.95) {...",
"else if (c < 0.7) {...",
"else if (c >= 0.7 && c < 0.825) {...",
"else if (c >= 0.825 && c < 0.95) {..."

change the probability to see the different scenarios more often or less often.
