const express = require('express');
const crypto = require('crypto');
const app = express();
app.use(express.json());

const HMAC_SECRET = process.env.HMAC_SECRET || 'changethislater';
const keys = {}; // temporary storage, replace with DB later

function generateKey() {
    const raw = crypto.randomBytes(32).toString('base64url');
    const checksum = crypto.createHmac('sha256', HMAC_SECRET).update(raw).digest('hex').slice(0, 8);
    return `app_${raw}_${checksum}`;
}

function hashKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

// SellHub hits this when someone buys
app.post('/webhook/sellhub', (req, res) => {
    const { event, customer } = req.body;
    if (event !== 'order:completed') return res.sendStatus(400);

    const key = generateKey();
    const hash = hashKey(key);
    keys[hash] = { email: customer.email, activated: false };

    console.log(`Key generated for ${customer.email}: ${key}`);
    // TODO: email key to buyer
    res.json({ success: true, key });
});

// Your app hits this to validate a key
app.post('/activate', (req, res) => {
    const { key } = req.body;
    const hash = hashKey(key);

    if (!keys[hash]) return res.json({ success: false, message: 'Key not found' });
    if (keys[hash].activated) return res.json({ success: false, message: 'Key already used' });

    keys[hash].activated = true;
    res.json({ success: true, message: 'Activated!' });
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
