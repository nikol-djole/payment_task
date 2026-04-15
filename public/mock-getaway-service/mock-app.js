const express = require("express")
const path = require("path")
const app = express()
const crypto = require("crypto");
const { check_signatures, secrets } = require("../shared_functions");
//*******************************************************************************************************************

app.use(express.json())
app.use(express.static(path.join(__dirname, "..", "mock-getaway-service")))
const PORT = process.env.PORT || 3001
const app_url = process.env.APP_URL || "http://localhost:3000"
const mock_url = process.env.MOCK_URL || "http://localhost:3001"
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});

//*******************************************************************************************************************


//*******************************************************************************************************************

app.post("/mock/checkout", (req, res) => {

    console.log("\x1b[33mRecived URL and GATEWAY payment id request from backend.\n\x1b[0m");
    try{
        check_signatures(req.get("X-Signature"),req.body);
        const paymentId = req.body.paymentId;
        console.log(`x1b[33m Signature is valid, paymentId is ${paymentId} \n\x1b[0m`);

         const gatewayPaymentId = crypto.randomUUID();

         const updated_body = {
              checkoutUrl: `${mock_url}/?paymentId=${encodeURIComponent(req.body.paymentId)}&gatewayPaymentId=${encodeURIComponent(gatewayPaymentId)}`,
              gatewayPaymentId: gatewayPaymentId
          };

        res.json(updated_body);
        console.log(`\x1b[33m checkoutUrl and gatewayPaymentId sent for payment ${paymentId} \n\x1b[0m`);

    }
    catch(err){
        console.log(`\x1b[33m An error ocured. Unable to send the requested information. Error:\n${err.message} \n\x1b[0m`);
        res.json({error: err.message});
    }

});


//*******************************************************************************************************************
async function createWebhook(status, paymentId, eventId, gatewayPaymentId, time = null) {
    if (time) {
        await new Promise(resolve => setTimeout(resolve, time));
    }
    const messageBody = {
        status: status,
        paymentId: paymentId,
        gateway: "mock",
        eventId: eventId,
        gatewayPaymentId: gatewayPaymentId
    };
    const messageBodyencoded = secrets(messageBody);
    const sendWebHook = await fetch(`${app_url}/webhooks/mock`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Signature": messageBodyencoded
        },
        body: JSON.stringify(messageBody)
    });


}
app.post("/payment_data_colected", async (req, res) => {
    if (req.body.action === "abort") {

        console.log(`\x1b[33mABORTED PAYMENT with id: ${req.body.paymentId}.\n\x1b[0m.`);
        await createWebhook("FAILED", req.body.paymentId, crypto.randomUUID(), req.body.gatewayPaymentId);
        res.json({status: "FAILED"});
        return;
    }

    const probabilityI = Math.random();
    if (probabilityI > 0.95) {
        const probabilityII = Math.random();
        if (probabilityII < 0.5) {
            console.log("\x1b[33m LONG WAITING THAN FIALED.\n\x1b[0m");
            await createWebhook("FAILED",req.body.paymentId,crypto.randomUUID(),req.body.gatewayPaymentId, 15000);
            console.log(req.body.paymentId, "\x1b[33m sent status: FAILED\n\x1b[0m");

        } else {
            console.log("\x1b[33mFIRST STATUS: PENDING THANN FAILED.\n\x1b[0m");
            await createWebhook("PENDING",req.body.paymentId,crypto.randomUUID(),req.body.gatewayPaymentId,5000);
            console.log(req.body.paymentId,"\x1b[33m sent status: PENDING\n\x1b[0m");

            await createWebhook("FAILED",req.body.paymentId,crypto.randomUUID(),req.body.gatewayPaymentId,5000);
            console.log(req.body.paymentId, "\x1b[33m sent status: FAILED\n\x1b[0m");
            res.json({status: "FAILED"});
        }
    } else if (probabilityI < 0.7) {
        console.log(req.body.paymentId, "\x1b[33mNORMAL PAYMENT. FIRST STATUS: PENDING THAN AUTHORIZED, THAN CAPTURED.\n\x1b[0m");

        await createWebhook("PENDING",req.body.paymentId,crypto.randomUUID(),req.body.gatewayPaymentId,5000);
        console.log(req.body.paymentId, "\x1b[33m sent status: PENDING\n\x1b[0m");

        await createWebhook("AUTHORIZED",req.body.paymentId,crypto.randomUUID(),req.body.gatewayPaymentId,5000);
        console.log(req.body.paymentId, "\x1b[33m sent status: AUTHORIZED\n\x1b[0m");

        await createWebhook("CAPTURED",req.body.paymentId,crypto.randomUUID(),req.body.gatewayPaymentId,5000);
        console.log(req.body.paymentId, "\x1b[33m sent status: CAPTURED\n\x1b[0m");
        res.json({status: "CAPTURED"});

    }
    else if (probabilityI >= 0.7 && probabilityI < 0.825) {
        const probabilityIII = Math.floor(Math.random() * 3) + 2
        const probabilityIV = Math.random()

        console.log(req.body.paymentId, "\x1b[33mDUPLICATE PAYMENT. FIRST STATUS: PENDING THAN AUTHORIZED, THAN CAPTURED. EITHER AUTHORIZED OR CAPTURED WILL BE SENT SEVERAL TIMES.\n\x1b[0m");
        await createWebhook("PENDING",req.body.paymentId,crypto.randomUUID(),req.body.gatewayPaymentId,5000);
        console.log(req.body.paymentId, "\x1b[33m sent status: PENDING\n\x1b[0m");

        if (probabilityIV <= 0.5) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const duplicateEventId = crypto.randomUUID();
            for (let i = 0; i < probabilityIII; i++) {
                await createWebhook("AUTHORIZED",req.body.paymentId,duplicateEventId,req.body.gatewayPaymentId,5000);
                console.log(req.body.paymentId, "\x1b[33m sent status: AUTHORIZED\n\x1b[0m");
            }

            await createWebhook("CAPTURED",req.body.paymentId,crypto.randomUUID(),req.body.gatewayPaymentId,5000);
            console.log(req.body.paymentId, "\x1b[33m sent status: CAPTURED\n\x1b[0m");
            res.json({status: "CAPTURED"});

        } else {
            await new Promise(resolve => setTimeout(resolve, 5000));
            await createWebhook("AUTHORIZED",req.body.paymentId,crypto.randomUUID(),req.body.gatewayPaymentId,5000);
            console.log(req.body.paymentId, "\x1b[33m sent status: AUTHORIZED\n\x1b[0m");

            const duplicateEventId = crypto.randomUUID();
            for (let i = 0; i < probabilityIII; i++) {
                await createWebhook("CAPTURED",req.body.paymentId,duplicateEventId,req.body.gatewayPaymentId,5000);
                console.log(req.body.paymentId, "\x1b[33m sent status: CAPTURED\n\x1b[0m");

            };
            res.json({status: "CAPTURED"});

        }
    } else if (probabilityI >= 0.825 && probabilityI < 0.95) {
        console.log(req.body.paymentId, "\x1b[33mINVALID PAYMENT. STAUS FAILED WILL BE SENT AFTER CAPTURED HAS BEEN RECIVED.\n\x1b[0m");

        await createWebhook("PENDING",req.body.paymentId,crypto.randomUUID(),req.body.gatewayPaymentId,5000);
        console.log(req.body.paymentId, "\x1b[33m sent status: PENDING\n\x1b[0m");

        await createWebhook("AUTHORIZED",req.body.paymentId,crypto.randomUUID(),req.body.gatewayPaymentId,5000);
        console.log(req.body.paymentId, "\x1b[33m sent status: AUTHORIZED\n\x1b[0m");

        await createWebhook("CAPTURED",req.body.paymentId,crypto.randomUUID(),req.body.gatewayPaymentId,5000);
        console.log(req.body.paymentId, "\x1b[33m sent status: CAPTURED\n\x1b[0m");
        res.json({status: "CAPTURED"});

        await createWebhook("FAILED",req.body.paymentId,crypto.randomUUID(),req.body.gatewayPaymentId,5000);
        console.log(req.body.paymentId, "\x1b[33m sent status: FAILED\n\x1b[0m");
    }
})


//*******************************************************************************************************************


