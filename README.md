# ליאל אורגד, עורכת דין: אתר

אתר סטטי שנפרס ב Cloudflare Workers (חשבון Cloudflare של ליאל), עם Worker קטן ב `src/worker.js`:

* `POST /api/contact`: טופס יצירת קשר. בדיקת שדות בשרת, honeypot, זמן מילוי מינימלי, הגבלת קצב, ושליחה במייל דרך Cloudflare Email Service (binding בשם `EMAIL`).
* הפניית `www` ל `lielorgad.com`, והפניית כתובות `.html` לכתובות נקיות.
* כל host שאינו `lielorgad.com` (workers.dev, preview) מקבל `X-Robots-Tag: noindex`.

## הגדרות בחשבון Cloudflare

* Custom Domains: `lielorgad.com` ו `www.lielorgad.com` (מוגדרים ב `wrangler.jsonc`).
* Email Sending מופעל לדומיין `lielorgad.com`; השולח: `website@lielorgad.com`.
* Secret בשם `FORM_TO`: רשימת נמענים מופרדת בפסיקים. בלי ה secret הפניות נשלחות ל `lielorgad@outlook.com` בלבד.

## ניהול תוכן (Pages CMS)

הטקסטים והתמונות של כל עמוד יושבים בקבצי JSON, והמאמרים בבלוג בקבצים נפרדים. ליאל עורכת אותם דרך Pages CMS (app.pagescms.org), שנכנסים אליו עם הזמנה במייל, בלי חשבון GitHub.

* `templates/*.html`: העמודים עצמם, עם מקומות שמורים כמו `{{h:s02.f03}}` במקום כל טקסט שניתן לעריכה. עיצוב ומבנה משנים כאן.
* `content/pages/*.json`: הטקסטים, התמונות, וכותרת ותיאור לגוגל של כל עמוד. זה מה שנערך ב CMS.
* `content/blog/*.json`: מאמרים (כותרת, כתובת באנגלית, תאריך, תקציר, תמונה, תוכן HTML, טיוטה).
* `.pages.yml`: הגדרות ה CMS, כולל התוויות בעברית. שמות השדות (`s02`, `f03`) מחוברים למקומות השמורים בתבניות, ולכן לא משנים אותם.
* `scripts/build.mjs`: מרכיב את האתר לתיקייה `dist`: ממלא את התבניות, בונה את רשימת המאמרים, עמוד לכל מאמר ומפת אתר. הוא רץ אוטומטית בכל `wrangler deploy` (מוגדר ב `wrangler.jsonc` תחת `build`). אם החבילה `sharp` מותקנת, תמונות JPG ו PNG מומרות ל WebP ברוחב של עד 1600 פיקסלים.

בנייה מקומית: `npm install` ואז `npm run build`. אם חסר שדה בקובץ תוכן, הבנייה נכשלת וגרסת האתר הקודמת נשארת באוויר.
