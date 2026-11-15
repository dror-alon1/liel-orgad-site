(function () {
  var f = document.querySelector('form[aria-describedby="form-note"]');
  if (!f) return;
  var started = Date.now();
  var sel = f.querySelector('select');
  var tp = new URLSearchParams(location.search).get('topic');
  if (tp && sel) sel.value = tp;

  var live = f.querySelector('[aria-live]');
  var btn = f.querySelector('button[type="submit"]');
  var btnText = btn ? btn.textContent : '';

  function say(html, ok) {
    live.innerHTML = '<p class="m-0 rounded-xl p-4 font-semibold ' +
      (ok ? 'bg-white text-ink ring-1 ring-mid/40' : 'bg-white text-[#9b1c1c] ring-1 ring-[#9b1c1c]/40') +
      '">' + html + '</p>';
    live.focus();
  }

  function mark(errors) {
    ['topic', 'name', 'phone', 'email', 'consent'].forEach(function (k) {
      var el = f.querySelector('[name="' + k + '"]');
      if (!el) return;
      var bad = !!(errors && errors[k]);
      el.setAttribute('aria-invalid', String(bad));
      var old = document.getElementById('err-' + k);
      if (old) old.remove();
      if (bad) {
        var p = document.createElement('p');
        p.id = 'err-' + k;
        p.className = 'mt-1.5 mb-0 text-[0.92rem] text-[#9b1c1c]';
        p.textContent = errors[k];
        (k === 'consent' ? el.closest('label') : el).after(p);
        var d = el.getAttribute('aria-describedby') || '';
        if (d.indexOf('err-' + k) < 0) el.setAttribute('aria-describedby', (d + ' err-' + k).trim());
      }
    });
  }

  function validate(d) {
    var e = {};
    if (!d.topic) e.topic = 'יש לבחור נושא';
    if ((d.name || '').trim().length < 2) e.name = 'יש למלא שם';
    var digits = (d.phone || '').replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 13) e.phone = 'מספר הטלפון לא תקין';
    if (d.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(d.email)) e.email = 'כתובת המייל לא תקינה';
    if (d.consent !== 'yes') e.consent = 'יש לאשר את מדיניות הפרטיות';
    return e;
  }

  f.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var fd = new FormData(f);
    var d = {
      topic: fd.get('topic') || '',
      name: fd.get('name') || '',
      phone: fd.get('phone') || '',
      email: fd.get('email') || '',
      message: fd.get('message') || '',
      consent: fd.get('consent') || '',
      company: fd.get('company') || '',
      ts: started
    };
    var errors = validate(d);
    mark(errors);
    if (Object.keys(errors).length) {
      say('יש כמה שדות שצריך לתקן.', false);
      var first = f.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }
    btn.disabled = true;
    btn.textContent = 'שולחים...';
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(d)
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { r: r, j: j }; }); })
      .then(function (x) {
        if (x.r.ok && x.j.ok) {
          mark(null);
          f.reset();
          say('תודה, הפנייה התקבלה. עו״ד אורגד תחזור אליכם בהקדם.', true);
          try { if (window.gtag) gtag('event', 'lead_submit_success', { topic: d.topic }); } catch (e) {}
        } else if (x.j.error === 'validation') {
          mark(x.j.fields);
          say('יש כמה שדות שצריך לתקן.', false);
        } else if (x.j.error === 'rate') {
          say('נשלחו כמה פניות ברצף. אפשר לנסות שוב בעוד דקה, או להתקשר ל <a href="tel:+972508899844" dir="ltr">050-8899844</a>.', false);
        } else {
          throw new Error(x.j.error || 'send');
        }
      })
      .catch(function () {
        say('השליחה לא הצליחה. אפשר לנסות שוב, או לפנות ישירות בטלפון <a href="tel:+972508899844" dir="ltr">050-8899844</a> או ב<a href="https://wa.me/972508899844" target="_blank" rel="noopener">וואטסאפ</a>.', false);
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = btnText;
      });
  });
})();
