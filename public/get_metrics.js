const crypto = require("crypto")

const APP_URL = process.env.APP_URL || "http://localhost:3000"
const MOCK_URL = process.env.MOCK_URL || "http://localhost:3001"
const RUNS = Number(process.env.RUNS || 100)
const PRODUCT_ID = process.env.PRODUCT_ID || "PROD001"
const USERNAME = process.env.TEST_USERNAME || "luca-meier"
const PASSWORD = process.env.TEST_PASSWORD || "cust001"

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function getCustomer() {
    const res = await fetch(`${APP_URL}/customers`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username: USERNAME,
            password: PASSWORD
        })
    })

    const data = await res.json()

    if (!res.ok || data.error) {
        throw new Error(`customers failed: ${data.error || res.status}`)
    }

    return data
}

async function getProduct() {
    const res = await fetch(`${APP_URL}/products`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prod_id: PRODUCT_ID
        })
    })

    const data = await res.json()

    if (!res.ok || data.error) {
        throw new Error(`products failed: ${data.error || res.status}`)
    }

    return data
}

async function createPayment(userId, amount, currency) {
    const res = await fetch(`${APP_URL}/payments`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID()
        },
        body: JSON.stringify({
            userId,
            amount,
            currency
        })
    })

    const data = await res.json()

    if (!res.ok || data.error) {
        throw new Error(`payments failed: ${data.error || res.status}`)
    }

    if (!data.checkoutUrl) {
        throw new Error("payments failed: missing checkoutUrl")
    }

    if (!data.paymentId) {
        throw new Error("payments failed: missing paymentId")
    }

    return data
}

function extractGatewayPaymentId(checkoutUrl) {
    const urlObj = new URL(checkoutUrl)
    const gatewayPaymentId =
        urlObj.searchParams.get("gatewayPaymentId") ||
        urlObj.searchParams.get("gateway_payment_id")

    if (!gatewayPaymentId) {
        throw new Error("checkoutUrl missing gatewayPaymentId")
    }

    return gatewayPaymentId
}

async function sendMockPaymentDetails(paymentId, gatewayPaymentId) {
    const res = await fetch(`${MOCK_URL}/payment_data_colected`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            action: "following_payment_details_for_the_following_payment_target",
            paymentId,
            gatewayPaymentId,
            card_number: "4111111111111111",
            card_holder_name: "Luca Meier",
            expiry_date: "12/28",
            cvv: "123"
        })
    })

    let data
    try {
        data = await res.json()
    } catch {
        data = await res.text()
    }

    if (!res.ok) {
        throw new Error(`mock failed: ${res.status} ${JSON.stringify(data)}`)
    }

    return data
}

async function waitForTerminalStatus(paymentId, maxAttempts = 60, delayMs = 1000) {
    for (let i = 0; i < maxAttempts; i++) {
        const res = await fetch(`${APP_URL}/payments/${paymentId}`)
        const data = await res.json()

        if (!res.ok || data.error) {
            throw new Error(`poll failed: ${data.error || res.status}`)
        }

        const status = data.payment_data?.status

        if (status === "CAPTURED" || status === "FAILED" || status === "REFUNDED") {
            return status
        }

        await sleep(delayMs)
    }

    throw new Error("poll timeout")
}

async function runOne(i) {
    console.log(`RUN ${i + 1}/${RUNS}`)

    const customer = await getCustomer()
    const product = await getProduct()
    const payment = await createPayment(
        customer.userId,
        parseInt(product.price, 10),
        product.currency
    )

    const gatewayPaymentId = extractGatewayPaymentId(payment.checkoutUrl)

    console.log("payment target:", {
        paymentId: payment.paymentId,
        gatewayPaymentId
    })

    const mockResult = await sendMockPaymentDetails(payment.paymentId, gatewayPaymentId)
    console.log("mock fetch result:", mockResult)

    const finalStatus = await waitForTerminalStatus(payment.paymentId)
    console.log(`final status for ${payment.paymentId}: ${finalStatus}`)

    return finalStatus
}

async function main() {
    const results = []

    for (let i = 0; i < RUNS; i++) {
        try {
            const result = await runOne(i)
            results.push(result)
        } catch (err) {
            console.error(`run ${i + 1} failed:`, err.message)
            results.push("ERROR")
        }

        await sleep(250)
    }

    const summary = results.reduce((acc, item) => {
        acc[item] = (acc[item] || 0) + 1
        return acc
    }, {})

    console.log("DONE")
    console.log("SUMMARY:", summary)
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})