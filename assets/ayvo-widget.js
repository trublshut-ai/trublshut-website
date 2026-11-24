/*!
 * AYVO receptionist widget (DEMO / PREVIEW)
 * AYVO, a brand of Trublshut AI Limited.
 *
 * Embed with one tag:
 *   <script src="ayvo-widget.js" defer
 *           data-endpoint=""            (optional: lead form POST URL; empty = preview, saved in localStorage only)
 *           data-sample-href="#sample"  (optional: where "Get 2 of your listing photos tidied, free" points)
 *           data-position="right"     (optional: right | left, floating button side)
 *           data-mount="#ayvo-receptionist-demo"  (optional: CSS selector of an inline slot; default
 *                                       auto-detects #ayvo-receptionist-demo. If found, the chat renders
 *                                       inline in that slot and the floating button is off by default.)
 *           data-launcher="auto"></script>   (optional: auto | on | off)
 *
 * Lead endpoint: a Formspree URL (https://formspree.io/f/XXXX) is posted as JSON with
 * Accept: application/json (CORS supported). Any other URL (e.g. Apps Script) gets a
 * no-cors form-encoded POST.
 *
 * No dependencies, no API keys, no LLM: the conversation is a fixed script, so it costs $0 to run.
 * All markup and CSS live inside a Shadow DOM under <div id="ayvo-w-root">, so host-page styles
 * cannot leak in and widget styles cannot leak out. Every class is also prefixed "ayvo-w-".
 *
 * Events for simple metrics: window receives CustomEvent "ayvo:event" with detail {name, ts}.
 * Names: widget_open, demo_start, demo_complete, takeover, trial_form_open, trial_submit, sample_click.
 * Counts are also kept in localStorage key "ayvo_w_metrics" (preview only), and pushed to
 * window.dataLayer if it exists.
 */
(function () {
  'use strict';
  if (window.AYVOWidget) return;

  var script = document.currentScript || (function () {
    var s = document.querySelectorAll('script[src*="ayvo-widget"]');
    return s[s.length - 1];
  })();
  var cfg = {
    endpoint: (script && script.getAttribute('data-endpoint')) || '',
    sampleHref: (script && script.getAttribute('data-sample-href')) || '#sample',
    position: (script && script.getAttribute('data-position')) === 'left' ? 'left' : 'right',
    mount: (script && script.getAttribute('data-mount')) || '#ayvo-receptionist-demo',
    launcher: (script && script.getAttribute('data-launcher')) || 'auto'
  };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- metrics ---------- */
  function track(name) {
    try {
      var m = JSON.parse(localStorage.getItem('ayvo_w_metrics') || '{}');
      m[name] = (m[name] || 0) + 1;
      localStorage.setItem('ayvo_w_metrics', JSON.stringify(m));
    } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('ayvo:event', { detail: { name: name, ts: Date.now() } })); } catch (e) {}
    if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: 'ayvo_' + name });
  }

  /* ---------- sample data ---------- */
  var LISTING = { title: '2-bed flat, Harbour Street', price: '£1,250 pcm', avail: 'Available 1 Dec', ref: 'SAMPLE-0142' };
  function nextSlots() {
    var out = [], d = new Date(), times = ['10:00', '17:30', '12:30'], i = 0;
    while (out.length < 3) {
      d = new Date(d.getTime() + 86400000);
      var day = d.getDay();
      if (day === 0) continue; // no Sunday viewings
      out.push({ label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + times[i], i: i });
      i++;
    }
    return out;
  }

  /* ---------- styles (scoped to shadow root) ---------- */
  var CSS = [
    ':host{all:initial}',
    '*,*::before,*::after{box-sizing:border-box}',
    '.ayvo-w{--bg:#0A0A0B;--panel:#141316;--panel2:#1C1B1F;--ink:#F4ECDD;--ink2:#BDB6AA;--line:#2E2D30;--orange:#FF8A3D;--purple:#B476F0;--ok:#7BD88F;',
    'font-family:"Hanken Grotesk","Helvetica Neue",Arial,sans-serif;font-size:15px;line-height:1.45;color:var(--ink);-webkit-font-smoothing:antialiased}',
    '.ayvo-w-launch{position:fixed;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:10px;padding:12px 18px 12px 14px;border:1px solid var(--line);border-radius:999px;background:var(--bg);color:var(--ink);font:600 15px/1 "Sora","Helvetica Neue",Arial,sans-serif;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.35)}',
    '.ayvo-w-launch:hover{background:#1A191C}',
    '.ayvo-w-launch:focus-visible,.ayvo-w button:focus-visible,.ayvo-w a:focus-visible,.ayvo-w input:focus-visible,.ayvo-w select:focus-visible{outline:3px solid var(--orange);outline-offset:2px}',
    '.ayvo-w-dot{width:10px;height:10px;border-radius:50%;background:var(--orange);box-shadow:0 0 0 4px rgba(255,138,61,.2)}',
    '.ayvo-w-tag{font:700 10px/1 "Hanken Grotesk",Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;padding:4px 6px;border-radius:4px;background:var(--purple);color:#140A1F}',
    '.ayvo-w-panel{position:fixed;bottom:84px;z-index:2147483001;width:380px;max-width:calc(100vw - 24px);height:600px;max-height:calc(100vh - 110px);display:flex;flex-direction:column;background:var(--bg);border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.45)}',
    '.ayvo-w-panel[hidden]{display:none}',
    '.ayvo-w-r{right:20px}.ayvo-w-l{left:20px}',
    '.ayvo-w-inline .ayvo-w-panel{position:relative;left:auto;right:auto;bottom:auto;z-index:auto;width:100%;max-width:100%;height:600px;max-height:none;box-shadow:none}',
    '.ayvo-w-inline .ayvo-w-x{display:none}',
    '.ayvo-w-restart{flex:none;min-height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--ink);font:600 13px/1 "Hanken Grotesk",Arial,sans-serif;cursor:pointer}',
    '.ayvo-w-float .ayvo-w-restart{display:none}',
    '.ayvo-w-start{margin:auto 0;align-self:center;width:100%;max-width:420px;display:flex;flex-direction:column;gap:12px;text-align:left}',
    '.ayvo-w-start h3{margin:0;font:600 18px/1.3 "Sora",Arial,sans-serif;color:var(--ink)}',
    '.ayvo-w-start ol{margin:0;padding-left:20px;color:var(--ink2);font-size:14px}',
    '.ayvo-w-start li{margin:3px 0}',
    '.ayvo-w-head{display:flex;align-items:center;gap:10px;padding:14px 14px 12px 16px;border-bottom:1px solid var(--line);background:var(--panel)}',
    '.ayvo-w-mark{font:800 18px/1 "Sora","Helvetica Neue",Arial,sans-serif;letter-spacing:.06em;color:var(--ink)}',
    '.ayvo-w-mark span{color:var(--orange)}',
    '.ayvo-w-htext{flex:1;min-width:0}',
    '.ayvo-w-title{font:600 14px/1.2 "Sora","Helvetica Neue",Arial,sans-serif;display:flex;align-items:center;gap:8px}',
    '.ayvo-w-sub{font-size:12px;color:var(--ink2);margin-top:3px}',
    '.ayvo-w-x{flex:none;width:36px;height:36px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--ink);font-size:20px;line-height:1;cursor:pointer}',
    '.ayvo-w-x:hover{background:var(--panel2)}',
    '.ayvo-w-log{flex:1;min-height:0;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}',
    '.ayvo-w-log>*{flex-shrink:0}',
    '.ayvo-w-note{align-self:center;max-width:92%;text-align:center;font-size:12.5px;color:var(--ink2);border:1px dashed var(--line);border-radius:10px;padding:8px 10px}',
    '.ayvo-w-msg{max-width:84%;padding:10px 12px;border-radius:14px;white-space:pre-line;word-wrap:break-word}',
    '.ayvo-w-bot{align-self:flex-start;background:var(--panel2);border-bottom-left-radius:4px}',
    '.ayvo-w-me{align-self:flex-end;background:var(--ink);color:#1A1612;border-bottom-right-radius:4px}',
    '.ayvo-w-who{display:block;font-size:11px;color:var(--ink2);margin-bottom:3px}',
    '.ayvo-w-card{align-self:stretch;border:1px solid var(--line);border-radius:14px;padding:12px;background:var(--panel)}',
    '.ayvo-w-card h4{margin:0 0 6px;font:600 13px/1.3 "Sora",Arial,sans-serif;display:flex;align-items:center;gap:8px}',
    '.ayvo-w-card p{margin:2px 0;font-size:13.5px;color:var(--ink2)}',
    '.ayvo-w-card strong{color:var(--ink)}',
    '.ayvo-w-ok{border-color:rgba(123,216,143,.45)}.ayvo-w-ok h4{color:var(--ok)}',
    '.ayvo-w-hand{border-color:rgba(255,138,61,.55)}.ayvo-w-hand h4{color:var(--orange)}',
    '.ayvo-w-chips{display:flex;flex-wrap:wrap;gap:8px;align-self:flex-start}',
    '.ayvo-w-chip{min-height:38px;padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--ink);font:500 14px/1.2 "Hanken Grotesk",Arial,sans-serif;cursor:pointer;text-align:left}',
    '.ayvo-w-chip:hover{border-color:var(--ink2);background:var(--panel2)}',
    '.ayvo-w-chip[disabled]{opacity:.45;cursor:default}',
    '.ayvo-w-cta{display:flex;flex-direction:column;gap:8px;align-self:stretch}',
    '.ayvo-w-btn{display:block;width:100%;min-height:44px;padding:11px 14px;border-radius:12px;border:0;background:var(--orange);color:#1A0E05;font:700 15px/1.2 "Sora","Helvetica Neue",Arial,sans-serif;text-align:center;text-decoration:none;cursor:pointer}',
    '.ayvo-w-btn:hover{background:#FF9C5C}',
    '.ayvo-w-btn2{background:transparent;color:var(--ink);border:1px solid var(--line);font-weight:600}',
    '.ayvo-w-btn2:hover{background:var(--panel2)}',
    '.ayvo-w-link{background:none;border:0;padding:4px;color:var(--ink2);font:500 13px/1.3 "Hanken Grotesk",Arial,sans-serif;text-decoration:underline;cursor:pointer}',
    '.ayvo-w-form{display:flex;flex-direction:column;gap:10px;align-self:stretch;border:1px solid var(--line);border-radius:14px;padding:14px;background:var(--panel)}',
    '.ayvo-w-form label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--ink2)}',
    '.ayvo-w-form input,.ayvo-w-form select{width:100%;min-height:42px;padding:9px 10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:400 15px/1.2 "Hanken Grotesk",Arial,sans-serif}',
    '.ayvo-w-form [aria-invalid=true]{border-color:#FF6B6B}',
    '.ayvo-w-err{color:#FF8F8F;font-size:12.5px;min-height:0}',
    '.ayvo-w-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}',
    '.ayvo-w-input{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line);background:var(--panel)}',
    '.ayvo-w-input input{flex:1;min-width:0;min-height:42px;padding:9px 12px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:400 15px/1.2 "Hanken Grotesk",Arial,sans-serif}',
    '.ayvo-w-send{flex:none;min-width:64px;border-radius:12px;border:0;background:var(--ink);color:#1A1612;font:700 14px/1 "Sora",Arial,sans-serif;cursor:pointer}',
    '.ayvo-w-foot{padding:8px 14px 10px;font-size:11.5px;color:var(--ink2);background:var(--panel);text-align:center}',
    '.ayvo-w-foot a{color:var(--ink2)}',
    '.ayvo-w-typing{align-self:flex-start;display:flex;gap:4px;padding:12px;background:var(--panel2);border-radius:14px}',
    '.ayvo-w-typing i{width:6px;height:6px;border-radius:50%;background:var(--ink2);animation:ayvo-w-b 1s infinite}',
    '.ayvo-w-typing i:nth-child(2){animation-delay:.15s}.ayvo-w-typing i:nth-child(3){animation-delay:.3s}',
    '@keyframes ayvo-w-b{0%,80%,100%{opacity:.3}40%{opacity:1}}',
    '.ayvo-w-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '@media (max-width:520px){.ayvo-w-float .ayvo-w-panel{left:0!important;right:0!important;top:0;bottom:0;width:100vw;max-width:100vw;height:100vh;height:100dvh;max-height:none;border-radius:0;border:0}.ayvo-w-inline .ayvo-w-panel{height:540px}.ayvo-w-mark{display:none}.ayvo-w-launch{bottom:14px}.ayvo-w-r.ayvo-w-launch{right:14px}.ayvo-w-l.ayvo-w-launch{left:14px}}',
    '@media (prefers-reduced-motion:reduce){.ayvo-w-log{scroll-behavior:auto}.ayvo-w-typing i{animation:none}}'
  ].join('\n');

  /* ---------- DOM ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var slot = null;
  try { slot = cfg.mount ? document.querySelector(cfg.mount) : null; } catch (e) { slot = null; }
  var inline = !!slot;
  var showLauncher = cfg.launcher === 'on' || (cfg.launcher === 'auto' && !inline);
  var host = el('div'); host.id = 'ayvo-w-root';
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  var style = el('style'); style.textContent = CSS; root.appendChild(style);
  var wrap = el('div', 'ayvo-w ' + (inline ? 'ayvo-w-inline' : 'ayvo-w-float')); root.appendChild(wrap);
  var side = cfg.position === 'left' ? 'ayvo-w-l' : 'ayvo-w-r';

  var launch = el('button', 'ayvo-w-launch ' + side);
  launch.type = 'button';
  launch.setAttribute('aria-haspopup', 'dialog');
  launch.setAttribute('aria-expanded', 'false');
  launch.setAttribute('aria-controls', 'ayvo-w-panel');
  launch.appendChild(el('span', 'ayvo-w-dot'));
  launch.appendChild(el('span', null, 'Try the after-hours receptionist'));
  launch.appendChild(el('span', 'ayvo-w-tag', 'Demo'));

  var panel = el('div', 'ayvo-w-panel ' + side);
  panel.id = 'ayvo-w-panel';
  panel.hidden = !inline;
  panel.setAttribute('role', inline ? 'region' : 'dialog');
  if (!inline) panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'ayvo-w-title');

  var head = el('div', 'ayvo-w-head');
  var mark = el('div', 'ayvo-w-mark'); mark.innerHTML = 'AYV<span>O</span>'; mark.setAttribute('aria-hidden', 'true');
  var htext = el('div', 'ayvo-w-htext');
  var title = el('div', 'ayvo-w-title'); title.id = 'ayvo-w-title';
  title.appendChild(el('span', null, 'AYVO receptionist'));
  title.appendChild(el('span', 'ayvo-w-tag', 'Demo'));
  htext.appendChild(title);
  htext.appendChild(el('div', 'ayvo-w-sub', 'Out-of-hours enquiries and viewings. Sample data only.'));
  var closeBtn = el('button', 'ayvo-w-x', '\u00d7'); closeBtn.type = 'button'; closeBtn.setAttribute('aria-label', 'Close the AYVO demo');
  var restartBtn = el('button', 'ayvo-w-restart', 'Restart'); restartBtn.type = 'button'; restartBtn.setAttribute('aria-label', 'Restart the demo');
  head.appendChild(mark); head.appendChild(htext); head.appendChild(restartBtn); head.appendChild(closeBtn);

  var log = el('div', 'ayvo-w-log');
  log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite'); log.setAttribute('aria-relevant', 'additions');
  log.tabIndex = 0; log.setAttribute('aria-label', 'Demo conversation');

  var inputBar = el('form', 'ayvo-w-input');
  inputBar.setAttribute('autocomplete', 'off');
  var input = el('input'); input.type = 'text'; input.setAttribute('aria-label', 'Type a message as the tenant'); input.placeholder = 'Type as the tenant, or tap an option';
  var send = el('button', 'ayvo-w-send', 'Send'); send.type = 'submit';
  inputBar.appendChild(input); inputBar.appendChild(send);

  var foot = el('div', 'ayvo-w-foot');
  foot.innerHTML = 'Demo only. No real listing, booking or message. AYVO, a brand of Trublshut AI Limited.';

  panel.appendChild(head); panel.appendChild(log); panel.appendChild(inputBar); panel.appendChild(foot);
  wrap.appendChild(panel); if (showLauncher) wrap.appendChild(launch);

  /* ---------- conversation engine ---------- */
  var state = { step: 'idle', answers: {}, slots: [], timers: [], chips: null, started: false, done: false };

  function scroll() { log.scrollTop = log.scrollHeight; }
  function add(node) { log.appendChild(node); scroll(); return node; }
  function note(text) { return add(el('div', 'ayvo-w-note', text)); }
  function me(text) { var m = el('div', 'ayvo-w-msg ayvo-w-me', text); return add(m); }
  function botNow(text) {
    var m = el('div', 'ayvo-w-msg ayvo-w-bot');
    m.appendChild(el('span', 'ayvo-w-who', 'Receptionist (demo)'));
    m.appendChild(document.createTextNode(text));
    return add(m);
  }
  function later(fn, ms) { var t = setTimeout(fn, reduceMotion ? 0 : ms); state.timers.push(t); }
  /* say several bot lines with a short typing indicator, then run next() */
  function say(lines, next) {
    lines = [].concat(lines);
    var i = 0;
    (function one() {
      if (i >= lines.length) { if (next) next(); return; }
      var t = add(el('div', 'ayvo-w-typing')); t.setAttribute('aria-hidden', 'true');
      t.innerHTML = '<i></i><i></i><i></i>';
      later(function () {
        t.remove();
        var line = lines[i++];
        if (typeof line === 'function') line(); else botNow(line);
        one();
      }, 650);
    })();
  }
  function chips(options) {
    clearChips();
    var box = el('div', 'ayvo-w-chips');
    box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Suggested replies');
    options.forEach(function (o) {
      var b = el('button', 'ayvo-w-chip', o.label); b.type = 'button';
      b.addEventListener('click', function () { clearChips(); me(o.label); o.go(); });
      box.appendChild(b);
    });
    state.chips = { box: box, options: options };
    add(box);
    var first = box.querySelector('button'); if (first && canFocus()) first.focus({ preventScroll: true });
  }
  function clearChips() {
    if (state.chips) { state.chips.box.remove(); state.chips = null; }
  }
  function card(kind, heading, rows) {
    var c = el('div', 'ayvo-w-card ' + (kind || ''));
    c.appendChild(el('h4', null, heading));
    rows.forEach(function (r) {
      var p = el('p');
      if (r[0]) { p.appendChild(el('strong', null, r[0] + ': ')); }
      p.appendChild(document.createTextNode(r[1]));
      c.appendChild(p);
    });
    return add(c);
  }

  /* ---------- the scripted tenant flow ---------- */
  function start() {
    state.started = true; state.done = false; state.handed = false; state.answers = {}; state.step = 'q_rent';
    track('demo_start');
    note('Demo. You are a tenant messaging a letting agency at 9:40 pm on a Saturday. The office is closed. Everything below is sample data.');
    card('', 'Sample listing \u00b7 ' + LISTING.ref, [['Property', LISTING.title], ['Rent', LISTING.price], ['', LISTING.avail]]);
    say(['Hi, thanks for your enquiry about the ' + LISTING.title + '. The office is closed right now, but I can answer the basics and book you a viewing.',
         'When would you like to move in?'], askMove);
  }
  function askMove() {
    state.step = 'move';
    chips([
      { label: 'Within 2 weeks', go: function () { ans('move', 'within 2 weeks'); } },
      { label: 'In about a month', go: function () { ans('move', 'in about a month'); } },
      { label: 'In 2 to 3 months', go: function () { ans('move', 'in 2 to 3 months'); } }
    ]);
  }
  function askPeople() {
    state.step = 'people';
    say('Thanks. How many people would live in the flat?', function () {
      chips([
        { label: 'Just me', go: function () { ans('people', '1'); } },
        { label: '2 people', go: function () { ans('people', '2'); } },
        { label: '3 or more', go: function () { ans('people', '3+'); } }
      ]);
    });
  }
  function askPets() {
    state.step = 'pets';
    say('Any pets?', function () {
      chips([
        { label: 'No pets', go: function () { ans('pets', 'none'); } },
        { label: 'Yes, a cat or a dog', go: function () { ans('pets', 'yes'); } }
      ]);
    });
  }
  function ans(key, val) {
    state.answers[key] = val;
    if (key === 'move') return askPeople();
    if (key === 'people') {
      if (val === '3+') {
        return say('Noted. This one is a 2-bed, so I\u2019ll flag your group size for the team to confirm it suits you.', askPets);
      }
      return askPets();
    }
    if (key === 'pets') {
      var pre = val === 'yes'
        ? 'Thanks. The landlord decides on pets, so I\u2019ve noted it for the team rather than promise anything.'
        : 'Great, thanks.';
      return say([pre, 'Here are the next viewing slots. Which suits you?'], offerSlots);
    }
  }
  function offerSlots() {
    state.step = 'slot';
    state.slots = nextSlots();
    var extra = state.handed
      ? { label: 'No thanks, I\u2019ll wait for the team', go: function () { say('No problem. The team has your details and will be in touch.', finishTenant); } }
      : { label: 'None of these work', go: function () { handover('Viewing time outside the listed slots'); } };
    chips(state.slots.map(function (s) {
      return { label: s.label, go: function () { pickSlot(s); } };
    }).concat([extra]));
  }
  function pickSlot(s) {
    state.answers.slot = s.label;
    state.step = 'name';
    input.placeholder = 'Type a name, e.g. Amina';
    say('Great choice. What name should I put the viewing under?', function () {
      if (canFocus()) input.focus({ preventScroll: true });
    });
  }
  function confirmBooking(name) {
    state.answers.name = name;
    state.step = 'after';
    input.placeholder = 'Type as the tenant, or tap an option';
    say([function () {
      card('ayvo-w-ok', '\u2713 Viewing booked (demo)', [
        ['Who', name], ['Property', LISTING.title], ['When', state.answers.slot],
        ['Calendar', 'Added to the agency diary'], ['Reminder', 'Sent the day before'],
        ['Notes for staff', 'Move-in ' + state.answers.move + ', ' + (state.answers.people === '1' ? '1 person' : state.answers.people + ' people') + ', pets: ' + state.answers.pets]
      ]);
    }, 'You\u2019re booked in, ' + name + '. Is there anything else I can help with?'], function () {
      chips([
        { label: 'Could the rent come down a bit?', go: function () { handover('Rent negotiation'); } },
        { label: 'No, that\u2019s all. Thanks!', go: function () { say('Thanks, ' + name + '. See you at the viewing.', finishTenant); } }
      ]);
    });
  }
  function handover(reason) {
    track('takeover');
    state.step = 'handed'; state.handed = true;
    say(['That\u2019s one for a person at the agency, so I won\u2019t guess. I\u2019ve passed it to the team, and someone will reply when the office opens at 9:00.',
      function () {
        card('ayvo-w-hand', '\u21aa Handed to staff (human takeover)', [
          ['Reason', reason], ['Sent to', 'Lettings team inbox, flagged for the morning'],
          ['Includes', 'Full chat so far' + (state.answers.slot ? ' and the booked viewing' : '')]
        ]);
      }], function () {
      if (!state.answers.slot) {
        say('In the meantime, would one of these viewing slots work?', offerSlots);
      } else {
        finishTenant();
      }
    });
  }
  function finishTenant() {
    if (state.done) return;
    state.done = true; state.step = 'convert';
    track('demo_complete');
    later(function () {
      note('End of demo. That was the AYVO out-of-hours receptionist.');
      say(['That\u2019s what your tenants would see when your office is closed: quick answers, a few qualifying questions, a booked viewing, and a hand-off to your team for anything it shouldn\u2019t answer.',
        'Want this on your agency\u2019s website? It isn\u2019t live for agencies yet. Join the trial list and we\u2019ll contact you when trials open.'], showCta);
    }, 500);
  }
  function showCta() {
    clearChips();
    var box = el('div', 'ayvo-w-cta');
    var join = el('button', 'ayvo-w-btn', 'Join the trial list'); join.type = 'button';
    join.addEventListener('click', function () { box.remove(); showForm(); });
    var sample = el('a', 'ayvo-w-btn ayvo-w-btn2', 'Get 2 of your listing photos tidied, free');
    sample.href = cfg.sampleHref;
    sample.addEventListener('click', function () { track('sample_click'); if (cfg.sampleHref.charAt(0) === '#') close(); });
    var replay = el('button', 'ayvo-w-link', 'Replay the demo'); replay.type = 'button';
    replay.addEventListener('click', reset);
    box.appendChild(join); box.appendChild(sample); box.appendChild(replay);
    add(box);
    if (canFocus()) join.focus({ preventScroll: true });
  }

  /* ---------- trial list form ---------- */
  var COUNTRIES = ['United Kingdom', 'Kenya', 'Nigeria', 'United Arab Emirates', 'Australia', 'Canada', 'Other'];
  var VOLUMES = ['Under 10', '10 to 30', '31 to 100', 'Over 100', 'Not sure'];
  function field(form, label, name, type, opts) {
    var l = el('label');
    l.appendChild(document.createTextNode(label));
    var f;
    if (type === 'select') {
      f = el('select');
      var ph = el('option', null, 'Choose one'); ph.value = ''; f.appendChild(ph);
      opts.forEach(function (o) { var op = el('option', null, o); op.value = o; f.appendChild(op); });
    } else {
      f = el('input'); f.type = type;
      if (type === 'email') f.autocomplete = 'email';
      if (name === 'name') f.autocomplete = 'name';
      if (name === 'agency') f.autocomplete = 'organization';
    }
    f.name = name; f.required = true;
    var err = el('span', 'ayvo-w-err'); err.id = 'ayvo-w-e-' + name;
    f.setAttribute('aria-describedby', err.id);
    l.appendChild(f); l.appendChild(err);
    form.appendChild(l);
    return f;
  }
  function showForm() {
    track('trial_form_open');
    state.step = 'form';
    var form = el('form', 'ayvo-w-form');
    form.noValidate = true;
    form.setAttribute('aria-label', 'Join the AYVO trial list');
    var h = el('div', null, 'Join the trial list'); h.style.cssText = 'font:600 15px/1.2 Sora,Arial,sans-serif;color:#F4ECDD';
    form.appendChild(h);
    form.appendChild(el('div', 'ayvo-w-sub', 'No payment, no commitment. We\u2019ll email you when trials open.'));
    var fName = field(form, 'Your name', 'name', 'text');
    var fAgency = field(form, 'Agency name', 'agency', 'text');
    var fEmail = field(form, 'Work email', 'email', 'email');
    var fCountry = field(form, 'Country', 'country', 'select', COUNTRIES);
    var fVol = field(form, 'Enquiries per week', 'volume', 'select', VOLUMES);
    var hp = el('input', 'ayvo-w-hp'); hp.name = '_gotcha'; hp.tabIndex = -1; hp.setAttribute('aria-hidden', 'true'); hp.autocomplete = 'off';
    form.appendChild(hp);
    var priv = el('div', 'ayvo-w-sub');
    priv.innerHTML = 'We\u2019ll only use these details to contact you about the AYVO trial. Email <a href="mailto:hello@trublshut.com" style="color:#BDB6AA">hello@trublshut.com</a> to have them deleted.';
    form.appendChild(priv);
    var status = el('div', 'ayvo-w-err'); status.setAttribute('role', 'status');
    var submit = el('button', 'ayvo-w-btn', 'Join the trial list'); submit.type = 'submit';
    form.appendChild(submit); form.appendChild(status);
    add(form);
    if (canFocus()) fName.focus({ preventScroll: true });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = null;
      [[fName, 'Enter your name.'], [fAgency, 'Enter your agency name.'], [fEmail, 'Enter a valid email address.'],
       [fCountry, 'Choose a country.'], [fVol, 'Choose a range.']].forEach(function (p) {
        var f = p[0], v = (f.value || '').trim();
        var ok = v.length > 0 && v.length <= 200 && (f !== fEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
        var err = form.querySelector('#ayvo-w-e-' + f.name);
        if (ok) { f.removeAttribute('aria-invalid'); err.textContent = ''; }
        else { f.setAttribute('aria-invalid', 'true'); err.textContent = p[1]; if (!bad) bad = f; }
      });
      if (bad) { bad.focus(); return; }
      var lead = {
        form: 'ayvo-trial-list', name: fName.value.trim(), agency: fAgency.value.trim(), email: fEmail.value.trim(),
        country: fCountry.value, volume: fVol.value, page: location.href.slice(0, 300),
        ts: new Date().toISOString(), _subject: 'AYVO receptionist trial list: ' + fAgency.value.trim().slice(0, 80), _gotcha: hp.value
      };
      submit.disabled = true; submit.textContent = 'Sending\u2026';
      saveLead(lead).then(function () {
        track('trial_submit');
        form.remove();
        card('ayvo-w-ok', '\u2713 You\u2019re on the trial list', [
          ['', 'Thanks, ' + lead.name + '. We\u2019ll email ' + lead.email + ' when AYVO receptionist trials open. Nothing is charged.']
        ]);
        var s = el('a', 'ayvo-w-btn ayvo-w-btn2', 'Get 2 of your listing photos tidied, free');
        s.href = cfg.sampleHref; s.style.alignSelf = 'stretch';
        s.addEventListener('click', function () { track('sample_click'); if (cfg.sampleHref.charAt(0) === '#') close(); });
        add(s);
      }, function () {
        submit.disabled = false; submit.textContent = 'Join the trial list';
        status.innerHTML = 'That didn\u2019t send. Please try again, or email <a href="mailto:hello@trublshut.com" style="color:#FF8F8F">hello@trublshut.com</a>.';
      });
    });
  }
  function saveLead(lead) {
    if (lead._gotcha) return Promise.resolve(); // honeypot: silently drop bots
    if (!cfg.endpoint) {
      // PREVIEW: no backend yet. TODO(backend): set data-endpoint to the Apps Script web app URL (see LEADS.md).
      try {
        var all = JSON.parse(localStorage.getItem('ayvo_trial_list') || '[]');
        all.push(lead); localStorage.setItem('ayvo_trial_list', JSON.stringify(all));
      } catch (e) {}
      if (window.console) console.info('[AYVO demo] Trial-list lead saved locally (preview, not sent):', lead);
      return Promise.resolve();
    }
    if (/^https:\/\/formspree\.io\/f\//.test(cfg.endpoint)) {
      return fetch(cfg.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(lead) })
        .then(function (r) { if (!r.ok) throw new Error('Formspree ' + r.status); return r; });
    }
    // Apps Script web apps don't send CORS headers, so post as a "simple" form-encoded request.
    // The response is opaque; a network failure still rejects.
    var body = new URLSearchParams();
    Object.keys(lead).forEach(function (k) { body.append(k, lead[k]); });
    return fetch(cfg.endpoint, { method: 'POST', mode: 'no-cors', body: body });
  }

  /* ---------- free text (rule-based, no AI model) ---------- */
  var OFF_SCRIPT = /(rent|price|cheaper|discount|reduce|negotiat|deposit|fee|contract|lease|legal|law|evict|landlord|damp|repair|complain|refund|dss|benefit|universal credit|guarantor)/i;
  function onText(text) {
    text = text.trim(); if (!text) return;
    if (!state.started) { interacted = true; if (inline) { log.innerHTML = ''; track('widget_open'); start(); } else open(); }
    me(text.slice(0, 500));
    if (state.step === 'name') {
      var name = text.replace(/[^\p{L}\p{M}' .-]/gu, '').trim().slice(0, 40);
      if (!name) return say('Sorry, what name should I put the viewing under?');
      return confirmBooking(name);
    }
    if (state.step === 'form' || state.step === 'convert') {
      return say('This part is for agencies. Use the buttons above to join the trial list or request free photo samples.');
    }
    // match a visible chip by its words
    if (state.chips) {
      var t = text.toLowerCase();
      var hit = state.chips.options.filter(function (o) {
        var l = o.label.toLowerCase();
        return t === l || l.indexOf(t) === 0 || (/\d/.test(t) && l.indexOf(t.match(/\d+/)[0]) > -1);
      })[0];
      if (!hit && state.step === 'pets') hit = /\b(no|none|nope)\b/i.test(t) ? state.chips.options[0] : (/(yes|cat|dog)/i.test(t) ? state.chips.options[1] : null);
      if (!hit && state.step === 'people') hit = /(just me|alone|myself|one|\b1\b)/i.test(t) ? state.chips.options[0] : (/(two|couple|\b2\b)/i.test(t) ? state.chips.options[1] : null);
      if (!hit && state.step === 'move') hit = /(week|asap|now|soon)/i.test(t) ? state.chips.options[0] : (/month/i.test(t) ? state.chips.options[1] : null);
      if (hit) { clearChips(); return hit.go(); }
    }
    clearChips();
    if (OFF_SCRIPT.test(text)) return handover('Off-script question: \u201c' + text.slice(0, 80) + '\u201d');
    return handover('Question outside the script: \u201c' + text.slice(0, 80) + '\u201d');
  }
  inputBar.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value; input.value = ''; onText(v); });

  /* ---------- open / close ---------- */
  var interacted = false;
  panel.addEventListener('pointerdown', function () { interacted = true; });
  panel.addEventListener('keydown', function () { interacted = true; });
  function panelOpen() { return !panel.hidden; }
  function canFocus() { return panelOpen() && (interacted || !inline); }
  function intro() {
    // Inline mode: wait for the visitor to start, so the page doesn't jump or steal focus on load.
    var box = el('div', 'ayvo-w-start');
    box.appendChild(el('h3', null, 'Play the tenant. See what your enquirers would get at 9:40 pm on a Saturday.'));
    var ol = el('ol');
    ['Answer 3 quick qualifying questions', 'Pick a viewing slot and see it booked', 'Ask something off-script and watch it hand over to staff'].forEach(function (t) { ol.appendChild(el('li', null, t)); });
    box.appendChild(ol);
    box.appendChild(el('div', 'ayvo-w-sub', 'Demo with sample data. Nothing is sent or booked. About 1 minute.'));
    var b = el('button', 'ayvo-w-btn', 'Start the demo'); b.type = 'button';
    b.addEventListener('click', function () { interacted = true; box.remove(); log.innerHTML = ''; track('widget_open'); start(); });
    box.appendChild(b); add(box);
  }
  function open() {
    if (inline) { slot.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' }); interacted = true;
      if (!state.started) { log.innerHTML = ''; track('widget_open'); start(); } return; }
    if (panelOpen()) return;
    panel.hidden = false; launch.setAttribute('aria-expanded', 'true');
    track('widget_open');
    if (!state.started) start();
    later(function () { var c = state.chips && state.chips.box.querySelector('button'); (c || closeBtn).focus({ preventScroll: true }); }, 50);
  }
  function close() {
    if (inline) return;
    if (!panelOpen()) return;
    panel.hidden = true; launch.setAttribute('aria-expanded', 'false'); launch.focus();
  }
  function reset() {
    state.timers.forEach(clearTimeout); state.timers = [];
    clearChips(); log.innerHTML = ''; state.started = false; state.step = 'idle';
    input.placeholder = 'Type as the tenant, or tap an option';
    if (inline && !interacted) intro(); else if (panelOpen()) start();
  }
  restartBtn.addEventListener('click', function () { interacted = true; reset(); });
  launch.addEventListener('click', function () { if (inline) return open(); panelOpen() ? close() : open(); });
  closeBtn.addEventListener('click', close);
  panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } });

  function mount() {
    if (inline) {
      // hide the slot's static fallback (screenshots) only once the widget has loaded
      Array.prototype.forEach.call(slot.children, function (c) { c.hidden = true; c.style.setProperty('display', 'none', 'important'); });
      slot.appendChild(host);
      intro();
    } else {
      document.body.appendChild(host);
    }
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  window.AYVOWidget = { open: open, close: close, reset: reset, version: '0.1.0-demo' };
})();
