# ליאל אורגד, עורכת דין: אתר

אתר סטטי שנפרס ב Cloudflare Workers (חשבון Cloudflare של ליאל), עם Worker קטן ב `src/worker.js`:

* `POST /api/contact`: טופס יצירת קשר. בדיקת שדות בשרת, honeypot, זמן מילוי מינימלי, הגבלת קצב, ושליחה במייל דרך Cloudflare Email Service (binding בשם `EMAIL`).
* הפניית `www` ל `lielorgad.com`, והפניית כתובות `.html` לכתובות נקיות.
* כל host שאינו `lielorgad.com` (workers.dev, preview) מקבל `X-Robots-Tag: noindex`.

## הגדרות בחשבון Cloudflare

* Custom Domains: `lielorgad.com` ו `www.lielorgad.com` (מוגדרים ב `wrangler.jsonc`).
* Email Sending מופעל לדומיין `lielorgad.com`; השולח: `website@lielorgad.com`.
* Secret בשם `FORM_TO`: רשימת נמענים מופרדת בפסיקים. בלי ה secret הפניות נשלחות ל `lielorgad@outlook.com` בלבד.
