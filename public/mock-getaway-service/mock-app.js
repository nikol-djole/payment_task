const express = require("express")
const path = require("path")
const app = express()
const crypto = require("crypto");

//*******************************************************************************************************************

app.use(express.json())
app.use(express.static(path.join(__dirname, "..", "mock-getaway-service")))
const PORT = process.env.PORT || 3001
const app_url = process.env.APP_URL || "http://localhost:3000"
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});

//*******************************************************************************************************************

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

//*******************************************************************************************************************

let curr_payment = null;

let i = 1;
app.post("/mock/checkout", express.raw({ type: "application/json" }), (req, res) => {

    const req_id = `checkout_request_${i}`
    i++
    console.log(req_id, "\x1b[33mRecived URL and GATEWAY payment id request from backend.\n\x1b[0m");

    const see = check_sig(req.headers["signature"],req.body);
    if (see) {
      console.log(req_id, "\x1b[33mSignature is valid.\n\x1b[0m")


      const updated_body = {
          action: "payment initiated",
          ...req.body,
          payment_url: `http://localhost:3001/?payment_id=${encodeURIComponent(req.body.payment_id)}`,
          gatewayPaymentId: crypto.randomUUID()
      }


      res.json(updated_body);
      console.log(req_id, "\x1b[33mSent URL and GATEWAY payment id to backend.\n\x1b[0m");
      curr_payment = updated_body;
    }
    else {
      res.status(401).send("invalid signature");
  }
});

//*******************************************************************************************************************
app.post("/which_payment", async (req, res) => {
    console.log(`\x1b[33mwhich_payment request received for the payment request${-1}\n\x1b[0m`);

    res.json(curr_payment);
});

//*******************************************************************************************************************

app.post("/payment_data_colected", async (req, res) => {
    if (req.body.action === "abort") {

        console.log(req.body.payment_id, "\x1b[33mABORTED PAYMENT.\n\x1b[0m");

         const key_0 = crypto.randomUUID();
            const kk = secrets(
                {
                action: "abort",
                status: "FAILED",
                payment_id:req.body.payment_id,
                gateway: "mock",
                eventID: key_0,
            });
            const reso = await fetch(`${app_url}/webhooks/mock`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "signature": kk
                },
                body: JSON.stringify({
                    action: "abort",
                    status: "FAILED",
                    payment_id:req.body.payment_id,
                    gateway: "mock",
                    eventID:key_0,
                })
            });
        res.json({status: "FAILED"})
        return;
    }
    const req_id = `payment_data_colected_request_${i-1}`
    console.log(req_id, "\x1b[33mRecived payment data from frontend.\n\x1b[0m");

    const c = Math.random();
    if (c > 0.95) {
        const proba = Math.random();
        if (proba < 0.5) {
            console.log(req_id, "\x1b[33m LONG WAITING THAN FIALED.\n\x1b[0m");

            await new Promise(resolve => setTimeout(resolve, 15000));
            res.json({status: "FAILED"})
            const key_0 = crypto.randomUUID();
            const kk = secrets(
                {
                status: "FAILED",
                ...req.body,
                gateway: "mock",
                eventID: key_0,
            });
            const reso = await fetch(`${app_url}/webhooks/mock`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "signature": kk
                },
                body: JSON.stringify({
                    status: "FAILED",
                    ...req.body,
                    gateway: "mock",
                    eventID:key_0,
                })
            });
            console.log(req_id, "\x1b[33m sent status: FAILED\n\x1b[0m");

        } else {
            console.log(req_id, "\x1b[33mFIRST STATUS: PENDING THANN FAILED.\n\x1b[0m");

            const key_0 = crypto.randomUUID();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const kk = secrets({
                status: "PENDING",
                ...req.body,
                gateway: "mock",
                eventID: key_0,
            });
            const reso = await fetch(`${app_url}/webhooks/mock`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "signature": kk
                },
                body: JSON.stringify({
                    status: "PENDING",
                    ...req.body,
                    gateway: "mock",
                    eventID: key_0,
                })
            });
            console.log(req_id, "\x1b[33m sent status: PENDING\n\x1b[0m");

            const key_1 = crypto.randomUUID();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const kk2 = secrets({
                status: "FAILED",
                ...req.body,
                gateway: "mock",
                eventID: key_1,
            });
            const res2o = await fetch(`${app_url}/webhooks/mock`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "signature": kk2
                },
                body: JSON.stringify({
                    status: "FAILED",
                    ...req.body,
                    gateway: "mock",
                    eventID: key_1,
                })
            });
            console.log(req_id, "\x1b[33m sent status: FAILED\n\x1b[0m");
            res.json({status: "FAILED"})
        }
    } else if (c < 0.7) {
        console.log(req_id, "\x1b[33mNORMAL PAYMENT. FIRST STATUS: PENDING THAN AUTHORIZED, THAN CAPTURED.\n\x1b[0m");

        await new Promise(resolve => setTimeout(resolve, 5000));
        const key_0 = crypto.randomUUID();
        const kk = secrets({
            status: "PENDING",
            gateway: "mock",
            eventID: key_0,
            ...req.body
        })
        const reso = await fetch(`${app_url}/webhooks/mock`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "signature": kk
            },
            body: JSON.stringify({
                status: "PENDING",
                gateway: "mock",
                eventID: key_0,
                ...req.body
            })
        });
        console.log(req_id, "\x1b[33m sent status: PENDING\n\x1b[0m");

        const key_1 = crypto.randomUUID();
        await new Promise(resolve => setTimeout(resolve, 5000));
        const kk2 = secrets({
            status: "AUTHORIZED",
            gateway: "mock",
            eventID: key_1,
            ...req.body
        })
        const reso2 = await fetch(`${app_url}/webhooks/mock`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "signature": kk2
            },
            body: JSON.stringify({
                status: "AUTHORIZED",
                gateway: "mock",
                eventID: key_1,
                ...req.body
            })
        });
        console.log(req_id, "\x1b[33m sent status: AUTHORIZED\n\x1b[0m");

        const key_2 = crypto.randomUUID();
        await new Promise(resolve => setTimeout(resolve, 5000));
        const kk3 = secrets({
            status: "CAPTURED",
            gateway: "mock",
            eventID: key_2,
            ...req.body
        })
        const reso3 = await fetch(`${app_url}/webhooks/mock`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "signature": kk3
            },
            body: JSON.stringify({
                status: "CAPTURED",
                gateway: "mock",
                eventID: key_2,
                ...req.body
            })
        });
        console.log(req_id, "\x1b[33m sent status: CAPTURED\n\x1b[0m");
        res.json({status: "CAPTURED"})

    } else if (c >= 0.7 && c < 0.825) {
        const y = Math.floor(Math.random() * 3) + 2
        const yy = Math.random()

        console.log(req_id, "\x1b[33mDUPLICATE PAYMENT. FIRST STATUS: PENDING THAN AUTHORIZED, THAN CAPTURED. EITHER AUTHORIZED OR CAPTURED WILL BE SENT SEVERAL TIMES.\n\x1b[0m");

        await new Promise(resolve => setTimeout(resolve, 5000));
        const key_0 = crypto.randomUUID();
        const kk = secrets({
            status: "PENDING",
            gateway: "mock",
            eventID: key_0,
            ...req.body
        });
        const reso = await fetch(`${app_url}/webhooks/mock`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "signature": kk
            },
            body: JSON.stringify({
                status: "PENDING",
                gateway: "mock",
                eventID: key_0,
                ...req.body
            })
        });
        console.log(req_id, "\x1b[33m sent status: PENDING\n\x1b[0m");

        if (yy <= 0.5) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const evnt = crypto.randomUUID();
            for (let i = 0; i < y; i++) {
                const kk = secrets({
                    status: "AUTHORIZED",
                    gateway: "mock",
                    eventID: evnt,
                    ...req.body
                });
                const reso = await fetch(`${app_url}/webhooks/mock`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "signature": kk
                    },
                    body: JSON.stringify({
                        status: "AUTHORIZED",
                        gateway: "mock",
                        eventID: evnt,
                        ...req.body
                    })
                })
                console.log(req_id, "\x1b[33m sent status: AUTHORIZED\n\x1b[0m");
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
            const key = crypto.randomUUID();
            const kk2 = secrets({
                status: "CAPTURED",
                gateway: "mock",
                eventID: key,
                ...req.body
            });
            const reso2 = await fetch(`${app_url}/webhooks/mock`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "signature": kk2
                },
                body: JSON.stringify({
                    status: "CAPTURED",
                    gateway: "mock",
                    eventID: key,
                    ...req.body
                })
            });
            console.log(req_id, "\x1b[33m sent status: CAPTURED\n\x1b[0m");
            res.json({status: "CAPTURED"})
        } else {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const key = crypto.randomUUID();
            const kk = secrets({
                status: "AUTHORIZED",
                gateway: "mock",
                eventID: key,
                ...req.body
            });
            const reso = await fetch(`${app_url}/webhooks/mock`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "signature": kk
                },
                body: JSON.stringify({
                    status: "AUTHORIZED",
                    gateway: "mock",
                    eventID: key,
                    ...req.body
                })
            });
            console.log(req_id, "\x1b[33m sent status: AUTHORIZED\n\x1b[0m");

            const evnt = crypto.randomUUID();
            for (let i = 0; i < y; i++) {
                const kk = secrets({
                    status: "CAPTURED",
                    gateway: "mock",
                    eventID: evnt,
                    ...req.body
                });
                const reso = await fetch(`${app_url}/webhooks/mock`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "signature": kk
                    },
                    body: JSON.stringify({
                        status: "CAPTURED",
                        gateway: "mock",
                        eventID: evnt,
                        ...req.body
                    })
                })
                console.log(req_id, "\x1b[33m sent status: CAPTURED\n\x1b[0m");
            };
            res.json({status: "CAPTURED"});
        }
    } else if (c >= 0.825 && c < 0.95) {
        console.log(req_id, "\x1b[33mINVALID PAYMENT. STAUS FAILED WILL BE SENT AFTER CAPTURED HAS BEEN RECIVED.\n\x1b[0m");

        await new Promise(resolve => setTimeout(resolve, 5000));
        const key = crypto.randomUUID();
        const kk = secrets({
            status: "PENDING",
            gateway: "mock",
            eventID: key,
            ...req.body
        })
        const reso = await fetch(`${app_url}/webhooks/mock`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "signature": kk
            },
            body: JSON.stringify({
                status: "PENDING",
                gateway: "mock",
                eventID: key,
                ...req.body
            })
        });
        console.log(req_id, "\x1b[33m sent status: PENDING\n\x1b[0m");

        const key_2 = crypto.randomUUID();
        await new Promise(resolve => setTimeout(resolve, 5000));
        const kk2 = secrets({
            status: "AUTHORIZED",
            gateway: "mock",
            eventID: key_2,
            ...req.body
        })
        const reso2 = await fetch(`${app_url}/webhooks/mock`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "signature": kk2
            },
            body: JSON.stringify({
                status: "AUTHORIZED",
                gateway: "mock",
                eventID: key_2,
                ...req.body
            })
        });
        console.log(req_id, "\x1b[33m sent status: AUTHORIZED\n\x1b[0m");

        const key_3 = crypto.randomUUID();
        await new Promise(resolve => setTimeout(resolve, 5000));
        const kk3 = secrets({
            status: "CAPTURED",
            gateway: "mock",
            eventID: key_3,
            ...req.body
        })
        const reso3 = await fetch(`${app_url}/webhooks/mock`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "signature": kk3
            },
            body: JSON.stringify({
                status: "CAPTURED",
                gateway: "mock",
                eventID: key_3,
                ...req.body
            })
        });
        console.log(req_id, "\x1b[33m sent status: CAPTURED\n\x1b[0m");
        res.json({status: "CAPTURED"})

        const key_4 = crypto.randomUUID();
        await new Promise(resolve => setTimeout(resolve, 5000));
        const kk4 = secrets({
            status: "FAILED",
            gateway: "mock",
            eventID: key_4,
            ...req.body
        });
        const reso4 = await fetch(`${app_url}/webhooks/mock`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "signature": kk4
            },
            body: JSON.stringify({
                status: "FAILED",
                gateway: "mock",
                eventID: key_4,
                ...req.body
            })
        });
        console.log(req_id, "\x1b[33m sent status: FAILED\n\x1b[0m");
    }
})


//*******************************************************************************************************************


