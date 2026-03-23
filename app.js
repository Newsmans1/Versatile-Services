const express = require('express');
const crypto = require('crypto');
const { Resend } = require('resend');

const app = express();
app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);
const HMAC_SECRET = process.env.HMAC_SECRET || 'changethislater';
const keys = {};

function generateKey() {
    const raw = crypto.randomBytes(32).toString('base64url');
    const checksum = crypto.createHmac('sha256', HMAC_SECRET).update(raw).digest('hex').slice(0, 8);
    return `app_${raw}_${checksum}`;
}

function hashKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

// SellHub webhook
app.post('/webhook/sellhub', async (req, res) => {
    const { event, customer } = req.body;
    if (event !== 'order:completed') return res.sendStatus(400);

    const key = generateKey();
    const hash = hashKey(key);
    keys[hash] = { email: customer.email, activated: false };

    // Send key to buyer via email
    await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: customer.email,
        subject: 'Your License Key',
        html: `
            <h2>Thank you for your purchase!</h2>
            <p>Your license key is:</p>
            <h3 style="background:#f4f4f4;padding:10px;">${key}</h3>
            <p>Enter this key at our activation page to get started.</p>
        `
    });

    console.log(`Key sent to ${customer.email}`);
    res.json({ success: true });
});

// Activate key
app.post('/activate', (req, res) => {
    const { key } = req.body;
    const hash = hashKey(key);

    if (!keys[hash]) return res.json({ success: false, message: 'Key not found' });
    if (keys[hash].activated) return res.json({ success: false, message: 'Key already used' });

    keys[hash].activated = true;
    res.json({ success: true, message: 'Activated!' });
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
