const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Example: https://live-server-328913.wati.io/api/v1/sendTemplateMessage?whatsappNumber=919500365660
const WATI_BASE = 'https://live-server-328913.wati.io/api/v1/sendTemplateMessage';
// Use a new, fresh Bearer Token from API Docs!
const WATI_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5ZDJkMGQyMC02NTFjLTQzMDMtODdlYi05MTFjNzBjNDYyM2EiLCJ1bmlxdWVfbmFtZSI6Im1hcmllc3dhckBnZXRsb2thbGFwcC5jb20iLCJuYW1laWQiOiJtYXJpZXN3YXJAZ2V0bG9rYWxhcHAuY29tIiwiZW1haWwiOiJtYXJpZXN3YXJAZ2V0bG9rYWxhcHAuY29tIiwiYXV0aF90aW1lIjoiMTEvMDkvMjAyNSAxMzoyNzoxOCIsInRlbmFudF9pZCI6IjMyODkxMyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.oqImoZ3eVsAU78DZOOlcXOVubiuXAXS9pwKZkmjVhYY';

const otpStore = {};

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Normalize as "91XXXXXXXXXX" (phone must be 10 digits from users)
function normalizeIndianPhone(number) {
  let s = String(number).replace(/\D/g, "");
  if (s.length === 10) return "91" + s;
  if (s.length === 12 && s.startsWith("91")) return s;
  return null;
}

app.post('/send-otp', async (req, res) => {
  let { phoneNumber } = req.body;
  phoneNumber = normalizeIndianPhone(phoneNumber);
  console.log('User sent:', req.body.phoneNumber, '| Normalized:', phoneNumber);
  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: 'Invalid mobile number. Enter 10 digits.' });
  }
  const otp = generateOTP();
  // The payload does NOT include whatsappNumber for this version
  const payload = {
    template_name: 'dostt_certification_otp',
    broadcast_name: 'DOSTT OTP',
    parameters: [
      { name: '1', value: otp }
    ]
  };
  const url = `${WATI_BASE}?whatsappNumber=${phoneNumber}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': WATI_TOKEN,
        'Content-Type': 'application/json-patch+json'
      },
      body: JSON.stringify(payload)
    });
    const status = response.status;
    const raw = await response.text();
    console.log('Status:', status, '| Raw:', raw);
    let data;
    try { data = raw ? JSON.parse(raw) : {}; } catch (err) { data = {}; }
    console.log('Parsed response:', data);
    if (status === 200 && data && data.result) {
      otpStore[phoneNumber] = { otp, expires: Date.now() + 5 * 60 * 1000 };
      res.json({ success: true, message: 'OTP sent successfully' });
    } else if (status === 401) {
      res.status(401).json({ success: false, message: 'Unauthorized - Check Bearer Token (expired or for wrong tenant)' });
    } else if (status === 405) {
      res.status(405).json({ success: false, message: 'Check endpoint and HTTP method. Must POST to endpoint EXACTLY as per API Docs.' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send OTP', error: data });
    }
  } catch (error) {
    console.log('❌ Network or server error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/verify-otp', (req, res) => {
  let { phoneNumber, otp } = req.body;
  phoneNumber = normalizeIndianPhone(phoneNumber);
  const stored = otpStore[phoneNumber];
  if (!stored)
    return res.json({ success: false, message: 'OTP not found or expired' });
  if (Date.now() > stored.expires) {
    delete otpStore[phoneNumber];
    return res.json({ success: false, message: 'OTP expired' });
  }
  if (stored.otp === otp) {
    delete otpStore[phoneNumber];
    return res.json({ success: true, message: 'OTP verified successfully' });
  } else {
    return res.json({ success: false, message: 'Invalid OTP' });
  }
});

app.listen(3000, () => {
  console.log('Backend running at http://localhost:3000');
});
