/**
 * ════════════════════════════════════════════════════════════════════════
 *  سبحة — حزمة الاختبار بمتصفح حقيقي (Puppeteer)
 * ════════════════════════════════════════════════════════════════════════
 *  لماذا متصفح حقيقي؟ jsdom لا يملك محرّك تخطيط: كل الارتفاعات صفر، فلا
 *  يكشف انزياح الأزرار ولا خروج العناصر عن شاشة الساعة. هذا الاختبار هو
 *  الذي اكتشف عيب `position:relative` الذي كان يدفع الأزرار خارج الشاشة.
 *
 *  التشغيل:
 *     cd tests && npm install puppeteer
 *     node browser-suite.mjs
 *
 *  يفحص:
 *   ① الحدود  : لا عنصر يخرج عن شاشة الساعة (٩ حالات عرض)
 *   ② الثبات  : موضع الأزرار والحلقة والعدّاد عبر كل الأذكار — انزياح ٠ بكسل
 *   ③ الترتيب : الشريط أعلى اسم الذكر · العدّاد أعلى يمين الشاشة
 *   ④ القائمة : تُخفي الشريط والعدّاد عند فتحها
 *   ⑤ التلقين : يتحرك فعلًا · الأثير (AOD) · المجموعات · الودجت
 * ════════════════════════════════════════════════════════════════════════
 */
import puppeteer from './node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SIM = 'file://' + path.join(HERE, '..', 'simulator.html');
const SHOTS = path.join(HERE, '..', 'screenshots');

let pass = 0, fail = 0;
const ok = (cond, label, detail = '') => {
  (cond ? pass++ : fail++);
  console.log(`  ${cond ? '✔' : '✘'} ${label}${detail ? ' → ' + detail : ''}`);
};
const head = t => console.log(`\n${t}`);

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'], protocolTimeout: 180000 });
const page = await browser.newPage();
await page.setViewport({ width: 420, height: 920, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(SIM, { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 500));

// عدد الأذكار الفعلي من الصفحة نفسها (لا رقم مكتوب بخط اليد)
const TOTAL_ITEMS = await page.evaluate(() => SETS.reduce((a, s) => a + s.items.length, 0));

/* ═══════════ ⓪ الشاشة الرئيسية (أيقونات الأذكار) ═══════════ */
head('⓪ الشاشة الرئيسية: أيقونات الأذكار — تُفتح أولًا وتُقاس داخل الشاشة');
const runOnPage = src => page.evaluate(async code => {
  await new Function('return (async()=>{' + code + '})()')();
  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => setTimeout(r, 80));
}, src);
await runOnPage("S.home=true; S.si=1; S.ii=3; S.c=12; S.recent=[1,0,3]; S.done=false; renderHome(); render(); applyLayout();");
const homeFit = await page.evaluate(() => {
  const sc = document.getElementById('screen').getBoundingClientRect();
  const view = document.getElementById('homeView');
  const tiles = [...view.querySelectorAll('[data-open]')];
  const bad = [];
  view.querySelectorAll('*').forEach(e => {
    const st = getComputedStyle(e);
    if (st.display === 'none' || parseFloat(st.opacity) === 0) return;
    const r = e.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const over = Math.max(0, sc.top - r.top, r.bottom - sc.bottom, sc.left - r.left, r.right - sc.right);
    if (over > 1) bad.push((e.id ? '#' + e.id : '.' + String(e.className).split(' ')[0]) + ' ' + over.toFixed(0) + 'px');
  });
  const grid = document.getElementById('hGrid').getBoundingClientRect();
  const tr = tiles.map(t => t.getBoundingClientRect());
  return { bad, tiles: tiles.length,
           scrollable: document.getElementById('hGrid').scrollHeight > document.getElementById('hGrid').clientHeight + 1,
           gridW: Math.round(grid.width),
           minTile: Math.round(Math.min(...tr.map(r => r.width))),
           minH: Math.round(Math.min(...tr.map(r => r.height))),
           contShown: document.getElementById('hCont').classList.contains('on'),
           recent: view.querySelectorAll('[data-recent]').length };
});
ok(homeFit.bad.length === 0, 'لا عنصر يخرج عن شاشة الساعة في الشاشة الرئيسية', homeFit.bad.slice(0, 3).join(' · '));
ok(homeFit.tiles === 8, 'ثماني أيقونات (كل مجموعة أيقونة)', String(homeFit.tiles));
ok(homeFit.minTile >= 60 && homeFit.minH >= 34, 'كل أيقونة كبيرة بما يكفي للضغط بالإصبع', `أصغر عرض ${homeFit.minTile}px · ارتفاع ${homeFit.minH}px`);
ok(homeFit.contShown && homeFit.recent === 0, 'زر «متابعة» ظاهر · و**لا** شرائح «آخرها» (أُلغيت)', `شرائح=${homeFit.recent}`);
ok(!homeFit.scrollable, 'الشبكة تظهر كاملة بلا حاجة لتمرير');
const elHomeShot = await page.$('#screen');
await elHomeShot.screenshot({ path: path.join(SHOTS, '17-الشاشة-الرئيسية.png') });

// 🎛️ طريقة العدّ: صفّ صغير داخل الشاشة + يُحفظ فعلًا (اختبار إعادة تحميل حقيقية)
const modeRow = await page.evaluate(() => {
  const sc = document.getElementById('screen').getBoundingClientRect();
  const chips = [...document.querySelectorAll('#hMode [data-mode]')];
  const bad = [];
  chips.forEach(c => {
    const r = c.getBoundingClientRect();
    const over = Math.max(0, sc.top - r.top, r.bottom - sc.bottom, sc.left - r.left, r.right - sc.right);
    if (over > 1) bad.push(over.toFixed(0) + 'px');
  });
  const h = Math.min(...chips.map(c => Math.round(c.getBoundingClientRect().height)));
  return { n: chips.length, bad, h, on: document.querySelectorAll('#hMode .mchip.on').length };
});
ok(modeRow.n === 3 && modeRow.bad.length === 0, 'صفّ «طريقة العدّ»: ثلاث خيارات داخل حدود الشاشة', `${modeRow.n} خيارًا`);
ok(modeRow.h >= 16, 'وكل خيار كبير بما يكفي للضغط بالإصبع', `${modeRow.h}px ارتفاعًا`);
ok(modeRow.on === 1, 'والطريقة الحالية معلَّمة (واحدة فقط)');
await runOnPage("el.hMode.querySelector('[data-mode=\"1\"]').click();");
ok(await page.evaluate(() => S.cMode) === 1, 'اختيار «حركة» من الشاشة الرئيسية يغيّر طريقة العدّ');
await new Promise(r => setTimeout(r, 400));
await runOnPage("el.toast.classList.remove('on');");          // لقطة نظيفة بلا رسالة عابرة
const elModeShot = await page.$('#screen');
await elModeShot.screenshot({ path: path.join(SHOTS, '19-اختيار-طريقة-العدّ.png') });
await page.reload({ waitUntil: 'load' });          // فتح التطبيق من جديد (إعادة تحميل حقيقية)
await new Promise(r => setTimeout(r, 600));
const afterReload = await page.evaluate(() => ({ mode: S.cMode, home: S.home }));
ok(afterReload.mode === 1, 'وبعد إعادة فتح التطبيق تبقى «حركة» كما اخترتها (محفوظة فعلًا)', `cMode=${afterReload.mode}`);
ok(afterReload.home === true, 'ويفتح التطبيق على الشاشة الرئيسية');
await runOnPage("setCountingMode(0); S.home=false; renderHome(); render(); applyLayout();");   // نُعيد الافتراضي

/* ═══════════ ⓪ب الرموز: متجهة داخل الشاشة (لا إيموجي تُرسم بخطّ صُوري فيضبّها التصغير) ═══════════ */
head('⓪ب الرموز: أيقونات متجهة حادّة في كل أزرار الشاشة');
const icons = await page.evaluate(() => {
  // نفحص كل عناصر الشاشة عدا لوحة القائمة (رموزها تُرسم بأيقونات أبل في التطبيق الحقيقي)
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
  const bad = [];
  const walk = document.createTreeWalker(document.getElementById('screen'), NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    if (n.parentElement.closest('#menu')) continue;
    const txt = n.nodeValue || '';
    if (emoji.test(txt)) bad.push((n.parentElement.id || n.parentElement.className) + ': ' + txt.trim().slice(0, 12));
  }
  // نعدّ الأيقونات الظاهرة فقط (ما كان في طبقة مخفية لا يُقاس)
  const svgs = [...document.querySelectorAll('#screen .sic')].filter(s => {
    const r = s.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const small = svgs.filter(s => {
    const r = s.getBoundingClientRect();
    return r.width < 10 || r.height < 10 || !s.querySelector('path,circle');
  }).map(s => {
    const r = s.getBoundingClientRect();
    return (s.parentElement.id || s.parentElement.className) + ':' + r.width.toFixed(0) + '×' + r.height.toFixed(0);
  });
  const chrome = ['btnReset', 'btnDist', 'btnPrompt', 'btnHome', 'btnMenu', 'pbPlay', 'pbDist', 'hMenu', 'dHome'];
  const missing = chrome.filter(id => !document.getElementById(id)?.querySelector('svg'));
  return { bad, count: svgs.length, small, missing };
});
ok(icons.bad.length === 0, 'لا إيموجي في واجهة العدّاد (كلها أيقونات متجهة)', icons.bad.slice(0, 3).join(' · '));
ok(icons.count >= 6, 'أيقونات العدّاد الظاهرة كلها متجهة (اسم المجموعة · تصفير · رؤية · تلقين · رئيسية · قائمة)', String(icons.count));
ok(icons.small.length === 0, 'كل أيقونة مرسومة بحجم واضح (≥ ١٠px وبها شكل فعلي)', icons.small.slice(0, 4).join(' · '));
ok(icons.missing.length === 0, 'أزرار الشاشة كلها بأيقونات متجهة (تصفير · رؤية · تلقين · رئيسية · قائمة · تشغيل)', icons.missing.join(' · '));

/* ═══════════ ⓪ج زرّ ☰ في الشاشة الرئيسية: يفتح القائمة فوقها ويعود إليها ═══════════ */
head('⓪ج زرّ ☰ في الشاشة الرئيسية (كان بلا أيقونة ⇒ أُصلح)');
const hmenu = await page.evaluate(async () => {
  goHome(); renderHome(); render(); applyLayout();
  await new Promise(r => setTimeout(r, 200));
  const b = document.getElementById('hMenu');
  const r = b.getBoundingClientRect(), sc = document.getElementById('screen').getBoundingClientRect();
  const svg = b.querySelector('svg');
  const before = { homeOn: document.getElementById('homeView').classList.contains('on'), menuOn: document.getElementById('menu').classList.contains('on') };
  b.click();
  await new Promise(r => setTimeout(r, 350));
  const m = document.getElementById('menu').getBoundingClientRect();
  const open = { menuOn: document.getElementById('menu').classList.contains('on'),
                 homeStill: document.getElementById('homeView').classList.contains('on'),
                 title: document.querySelector('#menu .mh .t').textContent.trim(),
                 inside: m.left >= sc.left - 0.5 && m.right <= sc.right + 0.5 && m.top >= sc.top - 0.5 && m.bottom <= sc.bottom + 0.5 };
  closeMenu();
  await new Promise(r => setTimeout(r, 250));
  const closed = { homeBack: document.getElementById('homeView').classList.contains('on'),
                   home: S.home, menuOn: document.getElementById('menu').classList.contains('on'),
                   tab: (document.querySelector('.tab.on') || {dataset:{}}).dataset.v || '-',
                   aod: S.aod, done: S.done, keep: S.keepAlive };
  return { w: r.width, h: r.height, svg: !!svg, tapInside: r.left >= sc.left && r.right <= sc.right, before, open, closed };
});
ok(hmenu.w >= 12 && hmenu.h >= 12 && hmenu.svg, 'زرّ ☰ في الرئيسية ظاهر بحجم واضح وبأيقونة متجهة',
   `${hmenu.w.toFixed(0)}×${hmenu.h.toFixed(0)}${hmenu.svg ? ' · SVG' : ' · بلا أيقونة'}`);
ok(hmenu.before.homeOn && !hmenu.before.menuOn && hmenu.tapInside, 'الشاشة الرئيسية ظاهرة قبل النقر والزرّ داخلها');
ok(hmenu.open.menuOn && hmenu.open.title === 'القائمة', 'النقر يفتح القائمة', hmenu.open.title);
ok(hmenu.open.homeStill, 'والقائمة تُفتح فوق الشاشة الرئيسية (لا تُلغيها)');
ok(hmenu.open.inside, 'والقائمة داخل حدود شاشة الساعة');
ok(hmenu.closed.homeBack && hmenu.closed.home && !hmenu.closed.menuOn, 'وبإغلاق القائمة تعود إلى الشاشة الرئيسية',
   JSON.stringify(hmenu.closed));

/* ═══════════ ① و ② الحدود وثبات التخطيط ═══════════ */
head('① الحدود: هل يخرج أي عنصر عن شاشة الساعة؟');
await runOnPage("S.home=false; renderHome(); render(); applyLayout();");   // ننتقل للعدّاد كما يفعل المستخدم

const press = src => page.evaluate(async s => {
  await new Function('return (async()=>{' + s + '})()')();
  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => setTimeout(r, 60));
}, src);

const bounds = async (label) => {
  const r = await page.evaluate(() => {
    const sc = document.getElementById('screen').getBoundingClientRect();
    const bad = [];
    const inScroller = e => {
      let p = e.parentElement;
      while (p && p.id !== 'screen') {
        const st = getComputedStyle(p);
        if ((st.overflowY === 'auto' || st.overflowY === 'scroll') && p.scrollHeight > p.clientHeight + 1) return true;
        p = p.parentElement;
      }
      return false;
    };
    document.querySelectorAll('#screen *').forEach(e => {
      const st = getComputedStyle(e);
      if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) === 0) return;
      if (inScroller(e)) return;
      if (e.classList.contains('bgimg') || e.classList.contains('bgdim') || e.classList.contains('glow')) return;
      const r = e.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const over = Math.max(0, sc.top - r.top, r.bottom - sc.bottom, sc.left - r.left, r.right - sc.right);
      if (over > 1) bad.push((e.id ? '#' + e.id : '.' + String(e.className).split(' ')[0]) + ' ' + over.toFixed(0) + 'px');
    });
    return bad;
  });
  ok(r.length === 0, label, r.length ? r.slice(0, 4).join(' · ') : '');
};

for (const [label, setup] of [
  ['وضع العدّ — ذكر قصير', "S.si=0;S.ii=3;S.c=12;S.read=false;render();applyLayout();"],
  ['وضع العدّ — آية الكرسي', "S.si=0;S.ii=2;S.c=0;S.read=false;render();applyLayout();"],
  ['وضع العدّ — بلا حد (مفتوح)', "S.si=5;S.ii=0;S.c=340;S.read=false;render();applyLayout();"],
  ['وضع القراءة + تلقين', "S.si=0;S.ii=2;S.read=true;S.prompt=true;render();applyLayout();"],
  ['وضع القراءة — عن بُعد', "S.dist=true;render();applyLayout();"],
  ['صفحة المجموعات', "S.dist=false;S.read=false;render();applyLayout();openMenu('sets');"],
  ['صفحة الودجت', "openMenu('widget');"],
  ['القائمة المنسدلة', "openMenu('main');"],
  ['وضع الجلسة الممتدة (AOD)', "closeMenu();S.aod=true;render();applyLayout();"],
]) { await press(setup); await bounds(label); }
await press("closeMenu();S.aod=false;S.prompt=false;render();applyLayout();");

/* ═══════════ ثبات المواضع عبر كل الأذكار ═══════════ */
head(`② الثبات: مواضع العناصر عبر كل الأذكار (${TOTAL_ITEMS} ذكرًا × وضعان)`);

const drift = await page.evaluate(async () => {
  const box = s => { const e = document.querySelector(s); const r = e.getBoundingClientRect();
    return { y: +r.y.toFixed(1), b: +r.bottom.toFixed(1), x: +r.x.toFixed(1), r: +r.right.toFixed(1) }; };
  const raf = () => new Promise(r => requestAnimationFrame(r));
  const rows = [];
  for (let si = 0; si < SETS.length; si++) for (let ii = 0; ii < SETS[si].items.length; ii++) {
    S.si = si; S.ii = ii; S.c = 0;
    S.read = false; render(); applyLayout(); await raf();
    const a = { btnTop: box('.btnrow').y, ring: box('#ring').y, menu: box('#btnMenu').y };
    S.read = true; render(); applyLayout(); await raf();
    const b = { badgeX: box('#badge').x, badgeY: box('#badge').y, barY: box('.promptbar').y,
                titleY: box('.rdTitle').y, screen: box('#screen') };
    rows.push({ ...a, ...b, name: SETS[si].items[ii].t });
  }
  return rows;
});
const uniq = k => [...new Set(drift.map(r => r[k]))];
const stable = (k, label) => ok(uniq(k).length === 1, label, `قيمة واحدة: ${uniq(k)[0]}`);
stable('btnTop', 'صف الأزرار ثابت في كل الأذكار');
stable('ring', 'الحلقة ثابتة في كل الأذكار');
stable('menu', 'زر القائمة (☰) ثابت');
stable('badgeX', 'العدّاد: موضعه الأفقي ثابت');
stable('badgeY', 'العدّاد: موضعه الرأسي ثابت');
stable('barY', 'شريط التلقين ثابت');
const s0 = drift[0];
ok(s0.badgeX > s0.screen.x + (s0.screen.r - s0.screen.x) / 2, 'العدّاد في النصف الأيمن من الشاشة',
   `x=${s0.badgeX} مقابل المنتصف ${((s0.screen.x + s0.screen.r) / 2).toFixed(1)}`);
ok(s0.badgeY < s0.screen.y + (s0.screen.b - s0.screen.y) / 2, 'العدّاد في النصف الأعلى', `y=${s0.badgeY}`);
ok(s0.barY < s0.titleY, 'شريط التلقين فوق اسم الذكر', `الشريط ${s0.barY} < الاسم ${s0.titleY}`);

/* ═══════════ ③ القائمة تُخفي الطبقات الطافية ═══════════ */
head('③ القائمة المنسدلة: تُخفي الشريط والعدّاد عند فتحها');
const menuVis = await page.evaluate(async () => {
  const raf = () => new Promise(r => requestAnimationFrame(r));
  const vis = id => getComputedStyle(document.getElementById(id)).display !== 'none';
  S.si = 0; S.ii = 2; S.read = true; render(); applyLayout(); await raf();
  const before = vis('promptBar') && vis('badge');
  openMenu('main'); await raf();
  const open = !vis('promptBar') && !vis('badge');
  closeMenu(); await raf();
  const after = vis('promptBar') && vis('badge');
  return { before, open, after };
});
ok(menuVis.before, 'قبل الفتح: الشريط والعدّاد ظاهران');
// 🔒 لا «طبقة خفوت عالقة»: إطفاء الحالة من أي مسار يُخفي الطبقة (كان عطلًا كشفته اللقطات)
const stuck = await page.evaluate(async () => {
  const raf = () => new Promise(r => requestAnimationFrame(r));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  S.cMode = 1; render(); applyLayout();
  if (!S.aod) toggleAOD();
  await sleep(700);                                  // التلاشي ٠٫٤٥ث — ننتظر استقراره
  const wasOn = getComputedStyle(document.getElementById('aod')).opacity;
  S.aod = false; render(); applyLayout();            // إطفاء من مسار لا يلمس الصنف
  await sleep(700);
  return { wasOn, now: getComputedStyle(document.getElementById('aod')).opacity };
});
ok(stuck.wasOn === '1' && stuck.now === '0', 'إطفاء الخفوت من أي مسار يُخفي الطبقة (لا سواد عالق)', `${stuck.wasOn} → ${stuck.now}`);
await page.evaluate(async () => { S.cMode = 0; if (S.aod) toggleAOD(); render(); applyLayout(); });
ok(menuVis.open, 'بعد الفتح: اختفيا (لا طفو فوق القائمة)');
ok(menuVis.after, 'بعد الإغلاق: عادا');

/* ═══════════ ③ب الشاشة الخافتة: النقر عليها = نكزة رسغ ═══════════ */
head('③ب الشاشة الخافتة تُنقر: إصلاح «لا يعدّ أثناء الخفوت»');
await page.evaluate(async () => {
  const raf = () => new Promise(r => requestAnimationFrame(r));
  // نختار «سُبْحَانَ اللَّه» (٣٣) لا ذكرًا بعدّه ١ — وإلا أتمّت النقرةُ الذكرَ وجدولت انتقالًا مؤجّلًا (٦٥٠مث)
  // يقلب حالة الاختبار التالي (كان يفسد فحص التلقين)
  S.cMode = 1; S.motionOn = true; S.si = 0; S.ii = 4; S.c = 5; S.read = false; render(); applyLayout();
  if (!S.aod) toggleAOD();
  await raf();
});
const dimInfo = await page.evaluate(() => {
  const r = document.getElementById('aod').getBoundingClientRect();
  return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, c: S.c,
           hint: document.getElementById('aodHint').textContent,
           dot: !!document.getElementById('aodDot') };
});
await page.mouse.click(dimInfo.cx, dimInfo.cy);
const afterDim = await page.evaluate(() => S.c);
ok(afterDim === dimInfo.c + 1, 'نقرة حقيقية على الشاشة الخافتة زادت العدّ', `${dimInfo.c} → ${afterDim}`);
ok(dimInfo.hint.includes('نكزة'), 'التعليمة الظاهرة تشرح الإيماءة', dimInfo.hint);
ok(dimInfo.dot, 'نقطة كشف الحركة ظاهرة في الشاشة الخافتة');
await page.evaluate(async () => { if (S.aod) toggleAOD(); S.cMode = 0; render(); applyLayout(); });

/* ═══════════ ④ التلقين يتحرك فعلًا ═══════════ */
head('④ التلقين: تمرير فعلي بوتيرة القراءة');
const prompt = await page.evaluate(async () => {
  const raf = () => new Promise(r => requestAnimationFrame(r));
  outer: for (let si = 0; si < SETS.length; si++) for (let ii = 0; ii < SETS[si].items.length; ii++)
    if (SETS[si].items[ii].t.includes('الْكُرْسِيّ')) { S.si = si; S.ii = ii; break outer; }
  S.c = 0; S.done = false; S.read = true; S.fs = 1; S.prompt = false; S.paused = false; render(); applyLayout(); await raf();
  const maxY = promptTotal(), speed = promptSpeed();
  startPrompt();
  await new Promise(r => setTimeout(r, 3000));
  const y = el.rdScroll.scrollTop;
  const badgeBottom = document.getElementById('badge').getBoundingClientRect().bottom;
  const barBottom = document.querySelector('.promptbar').getBoundingClientRect().bottom;
  const screenBottom = document.getElementById('screen').getBoundingClientRect().bottom;
  return { maxY, speed, y, badgeInside: badgeBottom <= screenBottom, barInside: barBottom <= screenBottom };
});
ok(prompt.y > 0.05, 'النص يتحرك فعلًا أثناء التلقين', `scrollTop=${prompt.y.toFixed(1)}px من ${prompt.maxY.toFixed(1)}px بسرعة ${prompt.speed.toFixed(2)}px/ث`);
ok(prompt.badgeInside && prompt.barInside, 'العدّاد والشريط ثابتان داخل الشاشة أثناء التمرير');

/* ═══════════ ⑤ المحتوى: النصوص الكاملة ═══════════ */
head('⑤ المحتوى: نصوص وضع القراءة');
const content = await page.evaluate(async () => {
  const raf = () => new Promise(r => requestAnimationFrame(r));
  const out = { entries: Object.keys(FULL).length, ayat: FULL['آيَةُ الْكُرْسِيّ'].length,
    tahlilNote: FULL['لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ… (تمام المائة)'].includes('تمام المائة'),
    dupRemoved: !('بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا' in FULL) };
  outer: for (let si = 0; si < SETS.length; si++) for (let ii = 0; ii < SETS[si].items.length; ii++)
    if (SETS[si].items[ii].t === 'الْمُعَوِّذَات مَعَ النَّفْث') { S.si = si; S.ii = ii; break outer; }
  S.read = true; render(); applyLayout(); await raf();
  out.multiLine = document.getElementById('rdText').innerHTML.includes('<br>');
  return out;
});
ok(content.entries === 45, 'عدد النصوص الكاملة ٤٥ (مطابق لـ Swift)', String(content.entries));
ok(content.ayat === 462, 'آية الكرسي كاملة (٤٦٢ حرفًا)', String(content.ayat));
ok(content.tahlilNote, 'تفسير الذكر المتمّم للمائة موجود');
ok(content.dupRemoved, 'المدخل المكرّر محذوف (لا تكرار)');
ok(content.multiLine, 'المعوذات تُعرض في أسطر (السور مفصولة)');

/* ═══════════ لقطات ═══════════ */
head('⑥ اللقطات');
const shots = [
  ['01-العد-ذكر-قصير.png', "S.si=0;S.ii=4;S.c=12;S.read=false;render();applyLayout();"],   // سُبْحَانَ اللَّه ×٣٣
  ['02-العد-آية-الكرسي.png', "S.si=0;S.ii=9;S.c=0;S.read=false;render();applyLayout();"],   // آيَةُ الْكُرْسِيّ
  ['03-القراءة-آية-الكرسي.png', "S.si=0;S.ii=9;S.c=1;S.read=true;render();applyLayout();"],
  ['04-القراءة-عن-بعد.png', "closeMenu();S.aod=false;S.read=true;S.c=1;S.si=0;S.ii=9;render();applyLayout();S.dist=false;toggleDist();"],
  ['05-القائمة-المنسدلة.png', "S.dist=false;S.read=false;render();applyLayout();openMenu('main');"],
  ['06-المجموعات.png', "closeMenu();render();applyLayout();openMenu('sets');"],
  // ── شاشات «العدّ بلا نظر» ──
  ['07-وضع-السكون-العد-بالحركة.png', "closeMenu();S.aod=false;S.read=false;S.cMode=1;S.motionOn=true;S.si=0;S.ii=4;S.c=12;render();applyLayout();toggleAOD();"],
  ['08-قائمة-العد-بلا-نظر.png', "closeMenu();S.aod=false;S.cMode=1;render();applyLayout();openMenu('main');", 'العدّ بلا نظر'],
  ['09-العد-بالحركة.png', "closeMenu();S.aod=false;S.read=false;S.cMode=1;S.motionOn=true;S.si=0;S.ii=4;S.c=12;render();applyLayout();"],
  // ── تحديث v2 ──
  ['10-الإحصاءات.png', "closeMenu();S.si=0;S.ii=4;S.read=false;S.hist={'2026-10-11':42};S.histTotal=42;render();applyLayout();openMenu('stats');"],
  ['11-شاشة-التعريف.png', "closeMenu();openMenu('howto');"],
  ['12-الصوت-والاهتزاز.png', "closeMenu();openMenu('main');document.querySelector('#menu').scrollTop=200;"],
  // ── الخيار التلقائي الجديد (طلب المستخدم) ──
  ['13-إبقاء-العد-حيًّا.png', "closeMenu();S.cMode=1;render();applyLayout();openMenu('main');", 'إبقاء العدّ حيًّا'],
  // ── 📜 صفحة المصادر (مطابقة حصن المسلم) ──
  ['14-المصادر.png', "closeMenu();S.cMode=0;render();applyLayout();openMenu('sources');"],
  // ── 🎉 شاشة إتمام المجموعة (أُصلحت: لا كلمات مكسورة) ──
  // ── 🏠 القائمة مفتوحة فوق الشاشة الرئيسية (كان زرّها بلا أيقونة) ──
  ['21-القائمة-فوق-الشاشة-الرئيسية.png', "hideDone(); closeMenu(); S.home=true; renderHome(); render(); applyLayout(); openMenu('main');"],
  ['22-الوضع-النهاري.png', "closeMenu(); hideDone(); S.theme='day'; applyTheme(); S.home=false; S.read=false; S.si=1; S.ii=0; S.c=4; render(); applyLayout();"],
  ['20-التقييم-والملاحظات.png', "S.theme='auto'; applyTheme(); closeMenu();S.cMode=0;render();applyLayout();openMenu('support');"],
  ['15-شاشة-الإتمام.png', "closeMenu();hideDone();S.home=false;renderHome();S.si=0;S.ii=SETS[0].items.length-1;S.c=SETS[0].items[S.ii].n;S.done=false;S.start=Date.now()-214000;advanceOrFinish('tap');"],
];
for (const [name, setup, scrollTo] of shots) {
  // 🧹 لقطة نظيفة: أوقف أي تلقين جارٍ · امسح أي رسالة عابرة · أعِد تمرير القائمة لأعلاها
  await press("if (S.prompt) stopPrompt(); el.toast.classList.remove('on'); document.querySelector('#menu').scrollTop = 0;");
  await press(setup);
  if (scrollTo) {                     // تمرير صفحة القائمة إلى قسم بعينه
    await page.evaluate(t => {
      const w = document.querySelector('#menu');
      const el = [...w.querySelectorAll('*')].find(e => e.textContent.trim().startsWith(t) && e.offsetHeight > 0);
      if (el) { el.scrollIntoView({ block: 'start' }); w.scrollTop -= 96; }   // لا تختفِ خلف ترويسة القائمة
    }, scrollTo);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  // مهلة قصيرة: بعض اللقطات فيها انتقالات (التلاشي ٠٫٤٥ث) — ننتظر استقرارها
  await new Promise(r => setTimeout(r, 600));
  const el = await page.$('#screen');
  await el.screenshot({ path: path.join(SHOTS, name) });
}
const shotCount = fs.readdirSync(SHOTS).filter(f => f.endsWith('.png')).length;
console.log(`  ✔ حُفظت ${shotCount} لقطة في screenshots/ (منها ${shots.length} من هذا القسم)`);

ok(errors.length === 0, 'لا أخطاء JavaScript', errors.slice(0, 2).join(' | '));

/* ═══════════ ⑥ب الخروج بضغطة التاج والعودة (كما في الساعة) ═══════════ */
head('⑥ب ضغطة التاج (خروج) ثم العودة: العدّ محفوظ');
await press("hideDone(); closeMenu(); S.si = 0; S.ii = 4; S.c = 17; S.read = false; render(); applyLayout();");
await press("simulateLeaveReturn();");                 // خروج: كما يفعل النظام عند ضغط التاج
await new Promise(r => setTimeout(r, 500));            // استقرار ظهور شاشة الساعة
const leaveState = await page.evaluate(() => {
  const face = document.getElementById('leaveFace');
  const r = face.getBoundingClientRect(), sc = document.getElementById('screen').getBoundingClientRect();
  return { shown: face.classList.contains('on'),
           covers: r.width >= sc.width - 1 && r.height >= sc.height - 1 };
});
const elLeave = await page.$('#screen');
await elLeave.screenshot({ path: path.join(SHOTS, '16-الخروج-بضغطة-التاج-العدّ-محفوظ.png') });
const beforeLeave = await page.evaluate(() => JSON.stringify({ c: S.c, ii: S.ii, si: S.si }));
await press("simulateLeaveReturn();");                 // عودة: افتح السبحة من جديد
await new Promise(r => setTimeout(r, 220));
const afterLeave = await page.evaluate(() => ({
  state: JSON.stringify({ c: S.c, ii: S.ii, si: S.si }),
  keep: S.keepAlive,
  hidden: !document.getElementById('leaveFace').classList.contains('on') }));
ok(leaveState.shown && leaveState.covers, 'واجهة «خرجت من التطبيق» تغطي الشاشة كاملة (محاكاة قائمة التطبيقات)');
ok(beforeLeave === afterLeave.state, 'عدّك وذكرك محفوظان بعد العودة — والجلسة تُشغَّل من جديد', afterLeave.state);
ok(afterLeave.keep, '«إبقاء العدّ حيًّا» ما زال مفعّلًا (الجلسة تُطلب تلقائيًّا)');
ok(afterLeave.hidden, 'والسبحة تعود كما كانت (لا واجهة عالقة)');

/* ═══════════ ⑥ج العودة للشاشة الرئيسية بعد إتمام المجموعة ═══════════ */
head('⑥ج إتمام مجموعة → زر «الشاشة الرئيسية» → رجوع فعلي');
await press("hideDone(); closeMenu(); S.home=false; renderHome(); S.si=3; S.ii=SETS[3].items.length-1; S.c=SETS[3].items[S.ii].n; S.done=false; render();");
await press("advanceOrFinish('tap');");
await new Promise(r => setTimeout(r, 300));
const doneHomeBtn = await page.evaluate(() => {
  const b = document.getElementById('dHome');
  const sc = document.getElementById('screen').getBoundingClientRect();
  const r = b.getBoundingClientRect();
  return { exists: !!b, visible: document.getElementById('doneView').classList.contains('on'),
           overflow: Math.max(0, sc.left - r.left, r.right - sc.right) };
});
ok(doneHomeBtn.visible && doneHomeBtn.exists, 'شاشة الإتمام ظاهرة وفيها زر «الشاشة الرئيسية»');
ok(doneHomeBtn.overflow <= 1, 'والزر داخل حدود الشاشة', `${doneHomeBtn.overflow.toFixed(0)}px`);
const elDoneShot = await page.$('#screen');
await elDoneShot.screenshot({ path: path.join(SHOTS, '18-الإتمام-وفيها-زر-الرئيسية.png') });
await press("goHome();");
await new Promise(r => setTimeout(r, 300));
await bounds('بعد العودة: الشاشة الرئيسية داخل الحدود');
ok(await page.evaluate(() => S.home === true && document.getElementById('homeView').classList.contains('on')),
   'رجعت فعلًا إلى الشاشة الرئيسية (لا بقيت على شاشة الإتمام)');

/* ═══════════ ⑦ صفحة المصادر: داخل حدود الشاشة ═══════════ */
head('⑦ صفحة المصادر: المحتوى داخل حدود شاشة الساعة');
const src = await page.evaluate(async () => {
  openMenu('sources');
  await new Promise(r => requestAnimationFrame(r));
  const w = document.querySelector('#menu').getBoundingClientRect();
  const bad = [...document.querySelectorAll('#menu .hcard, #menu .mnote')]
    .filter(e => { const r = e.getBoundingClientRect(); return r.left < w.left - 0.5 || r.right > w.right + 0.5; }).length;
  return { title: document.querySelector('#menu .mh .t').textContent.trim(),
           cards: document.querySelectorAll('#menu .hcard').length, bad,
           hasBook: document.querySelector('#menu').textContent.includes('حِصْنُ الْمُسْلِم'),
           hasSite: document.querySelector('#menu').textContent.includes('hisnmuslim.com') };
});
ok(src.cards === 4 && src.hasBook && src.hasSite, 'صفحة المصادر: ٤ بطاقات + اسم الكتاب والمصدر', src.title);
ok(src.bad === 0, 'لا عنصر يخرج عن حدود شاشة الساعة في صفحة المصادر');
await press("closeMenu()");

/* ═══════════ ⑦ب التقييم والملاحظات: صفحة القائمة داخل حدود الشاشة ═══════════ */
head('⑦ب التقييم والملاحظات: صفحة واضحة القياس ومساحات لمس مريحة');
const sup = await page.evaluate(async () => {
  const raf = () => new Promise(r => requestAnimationFrame(r));
  openMenu('main'); await raf();
  const navEntry = document.querySelector('#menu [data-act="page:support"]');
  const navText = navEntry ? navEntry.textContent.replace(/\s+/g, ' ').trim() : '';
  menuAct('page:support'); await raf(); await new Promise(r => setTimeout(r, 120));
  const menu = document.querySelector('#menu');
  const w = menu.getBoundingClientRect();
  const title = menu.querySelector('.mh .t').textContent.trim();
  const rows = [...menu.querySelectorAll('[data-act="rate"], [data-act="supportMail"]')].map(e => {
    const r = e.getBoundingClientRect();
    return { act: e.dataset.act, h: r.height, out: Math.max(0, w.left - r.left, r.right - w.right),
             txt: e.textContent.replace(/\s+/g, ' ').trim() };
  });
  const clipped = [...menu.querySelectorAll('.mnote')].filter(e => e.scrollWidth > e.clientWidth + 1).length;
  const hasVersion = menu.textContent.includes('١٫٠');
  menuAct('page:main'); await raf();          // نُرجع القائمة كأول ما كانت
  return { navText, title, rows, clipped, hasVersion };
});
ok(sup.navText.includes('التقييم والملاحظات') && sup.navText.includes('قيّم'),
   'بند «التقييم والملاحظات» في القائمة مع شرح مختصر بجانبه', sup.navText);
ok(sup.title === 'التقييم والملاحظات', 'وبفتحه تظهر صفحة باسمها الصريح', sup.title);
ok(sup.rows.length === 2, 'وفيها زرّان وظيفيان (تقييم · ملاحظة)', sup.rows.map(r => r.txt).join(' · '));
ok(sup.rows.every(r => r.h >= 24), 'مساحة لمس كل زر مريحة (≥ ٢٤ بكسل)',
   sup.rows.map(r => r.act + ':' + r.h.toFixed(0)).join(' · '));
ok(sup.rows.every(r => r.out <= 0.5), 'والزرّان داخل حدود شاشة الساعة');
ok(sup.clipped === 0, 'وسطور الشرح غير مقصوصة أفقيًا');
ok(sup.hasVersion, 'وفيه رقم الإصدار (يسهّل تتبّع أي ملاحظة تصلني)');

/* ═══════════ ⑦ج جولة ملاحظات المستخدم: زرّ التالي · المظهر · الشاشة الخافتة ═══════════ */
head('⑦ج زرّ «التالي» في شاشة الساعة: واضح القياس داخل الحدود');
const nextBtn = await page.evaluate(async () => {
  closeMenu(); hideDone(); S.home = false; S.read = false; openSetHome(0); render(); applyLayout();
  await new Promise(r => setTimeout(r, 250));
  const b = document.getElementById('nextLine'), svg = b.querySelector('svg');
  const r = b.getBoundingClientRect(), sc = document.getElementById('screen').getBoundingClientRect();
  const txt = b.querySelector('span.tx');
  return { h: r.height, w: r.width, svg: !!svg, inside: r.left >= sc.left - 0.5 && r.right <= sc.right + 0.5,
           clipped: txt ? (txt.scrollWidth > txt.clientWidth + 1) : true,
           label: b.textContent.replace(/\s+/g, ' ').trim().slice(0, 26) };
});
ok(nextBtn.svg && nextBtn.w > 20, 'زرّ «التالي» بأيقونة متجهة وعرض كافٍ', `${nextBtn.w.toFixed(0)}×${nextBtn.h.toFixed(0)}`);
ok(nextBtn.h >= 14, 'وارتفاعه مساحة لمس معقولة (≥ ١٤px)', nextBtn.h.toFixed(0));
ok(nextBtn.inside, 'وداخل حدود شاشة الساعة');
ok(!nextBtn.clipped, 'ولا نصّ مقصوص داخله', nextBtn.label);

head('⑦ز 🏠 بطاقات الرئيسية: لا قصّ للأيقونة والاسم على أيّ خطّ + الشريحة المفعّلة بلون الأيقونات');
const tilesFit = async (scale, label) => {
  const r = await page.evaluate(async (k) => {
    // نحاكي تكبير خطوط نظام الجهاز: كل مقادير البطاقة مضروبة في --tk فيبقى القياس صالحًا
    let st = document.getElementById('fontsim');
    if (!st) { st = document.createElement('style'); st.id = 'fontsim'; document.head.appendChild(st); }
    st.textContent = k === 1 ? '' : `
      .home .tile .nm{font-size:calc(${(9.5*k).toFixed(2)}px * var(--tk,1));line-height:${(1.2*k).toFixed(2)}}
      .home .tile .cnt{font-size:calc(${(7.5*k).toFixed(2)}px * var(--tk,1));line-height:${(1.2*k).toFixed(2)}}
      .home .tile .ico svg{width:calc(${(22*k).toFixed(1)}px * var(--tk,1));height:calc(${(22*k).toFixed(1)}px * var(--tk,1))}`;
    goHome(); renderHome(); applyLayout();
    await new Promise(r => setTimeout(r, 300));
    const g = document.getElementById('hGrid');
    let over = 0, minGap = Infinity, shown = 0;
    g.querySelectorAll('.tile').forEach(t => {
      over = Math.max(over, t.scrollHeight - t.clientHeight);
      const box = t.getBoundingClientRect();
      t.querySelectorAll('.ico, .nm, .cnt').forEach(c => {
        if (getComputedStyle(c).display === 'none') return;
        const r2 = c.getBoundingClientRect();
        minGap = Math.min(minGap, r2.top - box.top, box.bottom - r2.bottom);
      });
      shown += t.querySelectorAll('.ico, .nm, .cnt').length - (g.classList.contains('nocnt') ? 0 : 0);
    });
    return { over: Math.max(0, over), minGap: +minGap.toFixed(1), tk: getComputedStyle(g).getPropertyValue('--tk').trim(),
             nocnt: g.classList.contains('nocnt') };
  }, scale);
  ok(r.over === 0, `${label}: لا محتوى مقطوعًا داخل البطاقة`, `فائض ${r.over}px · --tk=${r.tk}${r.nocnt ? ' · بلا سطر العدّ' : ''}`);
  ok(r.minGap >= 0, `${label}: والأيقونة والاسم داخل الحدود`, `أقرب حافة ${r.minGap}px`);
};
await page.evaluate(() => { setTheme('auto'); applyTheme(); goHome(); applyLayout(); });
await tilesFit(1, 'خطّ عادي');
await tilesFit(1.5, 'تكبير خطوط ٥٠٪');
await tilesFit(1.9, 'تكبير خطوط ٩٠٪');
await page.evaluate(() => { const st = document.getElementById('fontsim'); if (st) st.textContent = ''; goHome(); applyLayout(); });
const tileLayout = await page.evaluate(async () => {
  goHome(); applyLayout(); await new Promise(r => setTimeout(r, 300));
  const t = document.querySelector('.home .tile');
  const ico = t.querySelector('.ico').getBoundingClientRect(), tt = t.querySelector('.tt').getBoundingClientRect();
  const nm = t.querySelector('.nm'), cnt = t.querySelector('.cnt');
  return { iconRightOfText: ico.left >= tt.right - 1, iconW: Math.round(ico.width),
           nameTrunc: nm.scrollWidth > nm.clientWidth + 1, cntTrunc: cnt.scrollWidth > cnt.clientWidth + 1,
           nameFont: parseFloat(getComputedStyle(nm).fontSize) };
});
ok(tileLayout.iconRightOfText, '🧩 الأيقونة على الجانب الأيمن من البطاقة والكتابة على الأيسر');
ok(tileLayout.iconW >= 20, 'والأيقونة أكبر مما كانت (≥ ٢٠px)', tileLayout.iconW + 'px');
ok(!tileLayout.nameTrunc && !tileLayout.cntTrunc, 'والاسم والعدّ ظاهران كاملين بلا اختصار');
const chipOpaque = await page.evaluate(() => {
  S.recent = [0, 1, 2]; S.si = 1; S.c = 4; S.ii = 0; renderHome();
  const cont = getComputedStyle(document.getElementById('hCont')).backgroundImage;
  return { row: !!document.getElementById('hRecent'), chips: document.querySelectorAll('.chip2').length,
           hcont: cont.includes('rgb(') && !cont.includes('rgba(') };
});
ok(!chipOpaque.row && chipOpaque.chips === 0, '🚫 خانة «آخرها» غير موجودة في الصفحة (أُلغيت)', 'شرائح=' + chipOpaque.chips);
ok(chipOpaque.hcont, 'وبطاقة «متابعة» معتمة (تدرّج بألوان صلبة)');
// 🚫 إلغاء «آخرها» يمنح الشبكة مساحة أكبر (لا فراغ ولا حشو)
const noRow = await page.evaluate(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  S.recent = [3, 2, 1]; S.si = 3; S.c = 4; S.ii = 0; renderHome(); await wait(250);
  const grid = document.getElementById('hGrid').getBoundingClientRect();
  const t = document.querySelector('.home .tile').getBoundingClientRect();
  const foot = document.querySelector('.home #hMode').getBoundingClientRect();
  return { row: !!document.getElementById('hRecent'), tiles: document.querySelectorAll('.home .tile').length,
           tileH: Math.round(t.height), gap: Math.round(foot.top - grid.bottom),
           scroll: document.getElementById('hGrid').scrollHeight > document.getElementById('hGrid').clientHeight + 1 };
});
ok(!noRow.row, '🚫 لا صفّ «آخرها» إطلاقًا — الرئيسية بلا حشو');
ok(noRow.tiles === 8 && !noRow.scroll, 'والبطاقات الثماني في مساحة أوسع بلا تمرير', `ارتفاع البطاقة ${noRow.tileH}px`);
ok(noRow.tileH >= 34, 'والبطاقة أكبر مما كانت قبل الإلغاء', noRow.tileH + 'px');
const chip = await page.evaluate(() => {
  const on = document.querySelector('.home .mchip.on'), off = document.querySelector('.home .mchip:not(.on)');
  const svg = on.querySelector('svg');
  const cs = getComputedStyle(on), cso = getComputedStyle(off);
  return { bg: cs.backgroundColor, color: cs.color, stroke: getComputedStyle(svg).stroke,
           offBg: cso.backgroundColor, teal: getComputedStyle(document.getElementById('screen')).getPropertyValue('--teal').trim() };
});
const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255})`; };
ok(chip.bg === hex2rgb(chip.teal), 'الشريحة المفعّلة بمِلء بلون الأيقونات نفسه (تيل اللوحة الحالية)', `${chip.bg} ⟵ ${chip.teal}`);
ok(chip.stroke === chip.color, 'وأيقونتها بلون نصّها (يبقى مقروءًا على الملء)', `${chip.stroke} · ${chip.color}`);
ok(chip.bg !== chip.offBg, 'وغير المفعّلة مختلفة تمامًا');
const chipDay = await page.evaluate(async () => {
  setTheme('day'); applyTheme(); goHome(); applyLayout();
  await new Promise(r => setTimeout(r, 250));
  const on = document.querySelector('.home .mchip.on');
  const out = { bg: getComputedStyle(on).backgroundColor, color: getComputedStyle(on).color };
  setTheme('auto'); applyTheme(); goHome(); applyLayout();
  return out;
});
ok(chipDay.bg === 'rgb(13, 148, 136)', 'وفي النهاري بتيل داكن', chipDay.bg);
ok(chipDay.color === 'rgb(255, 255, 255)', 'ونصّ أبيض مقروء عليه', chipDay.color);

head('⑦و ☀️ تدقيق تباين النهاري في كل الشاشات (لا نصّ «باهت» على الورقي)');
const dayAudit = await page.evaluate(async () => {
  const lin = c => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c + 0.055)/1.055, 2.4); };
  const L = a => 0.2126*lin(a[0]) + 0.7152*lin(a[1]) + 0.0722*lin(a[2]);
  const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
  const hidden = el => { let e = el; while (e && e !== document.body) { const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.5) return true; e = e.parentElement; } return false; };
  const bgOf = el => { let e = el; while (e) { const cs = getComputedStyle(e); const c = parse(cs.backgroundColor);
      if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c.slice(0,3);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return [251,248,241]; e = e.parentElement; } return [251,248,241]; };
  const bad = []; const wait = ms => new Promise(r => setTimeout(r, ms));
  const scan = label => { document.querySelectorAll('#screen *').forEach(el => {
      if (el.children.length || !el.textContent.trim() || hidden(el)) return;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
      const fg = parse(getComputedStyle(el).color).slice(0,3), bg = bgOf(el);
      const l1 = L(fg), l2 = L(bg); const ratio = (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
      if (ratio < 3.0) bad.push(label + ' · .' + (el.className || el.id) + ' «' + el.textContent.trim().slice(0,14) + '» ' + ratio.toFixed(2)); }); };
  setTheme('day'); applyTheme();
  closeMenu(); hideDone(); S.home = false; openSetHome(0); render(); applyLayout(); await wait(350); scan('العدّ');
  startPrompt(); await wait(900); scan('القراءة');
  S.read = false; render(); applyLayout(); await wait(250);
  goHome(); await wait(300); scan('الرئيسية');
  openMenu('main'); await wait(350); scan('القائمة');
  openMenu('sets'); await wait(300); scan('المجموعات');
  openMenu('support'); await wait(300); scan('الدعم');
  closeMenu(); await wait(200);
  finishFreeSession(); await wait(400); scan('الإتمام'); hideDone(); await wait(200);
  setTheme('auto'); applyTheme(); goHome(); await wait(200);
  return bad;
});
ok(dayAudit.length === 0, 'لا نصّ في النهاري بتباين أقل من ٣:١ (وضع القراءة · الرئيسية · القائمة · الإتمام)', dayAudit.slice(0,4).join(' | '));
const readDay = await page.evaluate(async () => {
  setTheme('day'); S.home = false; openSetHome(0); startPrompt();
  await new Promise(r => setTimeout(r, 800));
  const cs = getComputedStyle(document.getElementById('rdText'));
  const t = getComputedStyle(document.getElementById('rdTitle'));
  const out = { text: cs.color, title: t.color };
  S.read = false; setTheme('auto'); applyTheme(); goHome();
  return out;
});
const lumOf = c => { const a = c.match(/\d+/g).slice(0,3).map(Number);
  return (0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2]) / 255; };
// وأهمّ حالة: الخلفية مُشغَّلة بأقوى شدّة في النهاري — نقيس اللوحة الحقيقية من لقطة الشاشة
// (لا تخمينًا بالألوان) بعد إخفاء النصّ، ثم نقارن لون كل نصّ بلون ما تحته فعلًا
const dayBgAudit = await page.evaluate(async () => {
  setTheme('day'); S.bg = true; S.bgOp = 0.78; applyBackground();
  closeMenu(); hideDone(); S.home = false; openSetHome(0); S.read = false; render(); applyLayout();
  await new Promise(r => setTimeout(r, 500));
  return getComputedStyle(document.getElementById('bgimg')).opacity;
});
ok(+dayBgAudit > 0.3, '☀️ خلفية المجموعة ظاهرة فعلًا في الوضع النهاري (كانت تكاد تختفي)', 'opacity=' + dayBgAudit);

const sampleBackdrop = async (selectors) => {
  // نخفي النصوص أولًا حتى نقيس **ما تحتها فعلًا** (بكسلات الحروف نفسها تشوّه المتوسط)
  await page.evaluate(ls => ls.forEach(sel => { const e = document.querySelector(sel); if (e) e.style.visibility = 'hidden'; }), selectors);
  await new Promise(r => setTimeout(r, 120));
  const b64 = await (await page.$('#screen')).screenshot({ encoding: 'base64' });
  await page.evaluate(ls => ls.forEach(sel => { const e = document.querySelector(sel); if (e) e.style.visibility = ''; }), selectors);
  return await page.evaluate(async ({ b64, selectors }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    const scr = document.getElementById('screen').getBoundingClientRect();
    const k = img.width / scr.width;
    const lin = c => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c + 0.055)/1.055, 2.4); };
    const Lp = (r,g,b) => 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
    const ratio = (a, b) => (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05);
    const out = [];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el || !el.textContent.trim()) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;      // (مخفي أو بلا مساحة ⇒ لا قياس)
      // ✂️ قصّ المنطقة على حدود اللقطة (نصّ القراءة قد يمتدّ خارج الشاشة فيُعطي بكسلات شفافة)
      const x = Math.min(Math.max(0, Math.round((r.left - scr.left) * k)), cv.width - 1);
      const y = Math.min(Math.max(0, Math.round((r.top - scr.top) * k)), cv.height - 1);
      const w = Math.max(1, Math.min(Math.round(r.width * k), cv.width - x));
      const h = Math.max(1, Math.min(Math.round(r.height * k), cv.height - y));
      const d = ctx.getImageData(x, y, w, h).data;
      let sum = 0, n = 0, min = 1;
      for (let i = 0; i < d.length; i += 4) { const L = Lp(d[i], d[i+1], d[i+2]); sum += L; n++; if (L < min) min = L; }
      const fg = (getComputedStyle(el).color.match(/[\d.]+/g) || []).map(Number).slice(0,3);
      const Lf = Lp(fg[0], fg[1], fg[2]);
      out.push({ sel, avgRatio: +ratio(Lf, sum / n).toFixed(2), minRatio: +ratio(Lf, min).toFixed(2) });
    }
    return out;
  }, { b64, selectors });
};
const dayTexts = await sampleBackdrop(['.setname', '.dhikr', '.meta', '.ring .num', '.status', '.nextline']);
const weak = dayTexts.filter(t => t.avgRatio < 3.0);
ok(dayTexts.length >= 4 && weak.length === 0,
   'بالخلفية مُشغَّلة نهارًا: كل نصّ تباينه مع ما تحته ≥ ٣:١ (قياس من اللقطة نفسها)',
   dayTexts.map(t => t.sel + ' ' + t.avgRatio).join(' · '));
// وضع القراءة فوق الخلفية أيضًا
const readBg = await page.evaluate(async () => {
  S.read = true; render(); applyLayout();          // وضع القراءة فعلًا (startPrompt وحده لا يفتحه)
  startPrompt(); await new Promise(r => setTimeout(r, 900));
  return getComputedStyle(document.getElementById('rdText')).color;
});
const readTexts = await sampleBackdrop(['#rdText', '#rdTitle']);
const weakRead = readTexts.filter(t => t.avgRatio < 3.0);
ok(readTexts.length >= 1 && weakRead.length === 0, 'ووضع القراءة فوق الخلفية: التباين سليم كذلك',
   readTexts.map(t => t.sel + ' ' + t.avgRatio).join(' · '));
await page.evaluate(() => { S.read = false; stopPrompt(); S.bg = false; S.bgOp = 0.55; applyBackground();
                            setTheme('auto'); applyTheme(); render(); applyLayout(); goHome(); });

ok(lumOf(readDay.text) < 0.2, 'نصّ الذكر في وضع القراءة (النهاري) كربوني فعليًا', readDay.text);
ok(lumOf(readDay.title) < 0.5, 'وعنوان الذكر بتيل داكن', readDay.title);

head('⑦ج٢ ⏮⏭ التنقّل: داخل الحدود في الوضعين + أيقونات متناسقة القياس');
const navRow = await page.evaluate(async () => {
  const sc = () => document.getElementById('screen').getBoundingClientRect();
  const grab = () => {
    const n = document.getElementById('nextLine'), pv = document.getElementById('btnPrev');
    const nr = n.getBoundingClientRect(), pr = pv.getBoundingClientRect(), s = sc();
    const inside = [nr, pr].every(r => r.left >= s.left - 0.5 && r.right <= s.right + 0.5 && r.top >= s.top - 0.5 && r.bottom <= s.bottom + 0.5);
    // صف الأدوات كلها بمقاس واحد، وزرّا التنقّل بمقاس واحد أصغر (مجموعتان لا خلط داخلهما)
    const rows = ['btnReset','btnDist','btnPrompt','btnMenu'].map(id => {
      const svg = document.getElementById(id).querySelector('svg');
      const r = svg.getBoundingClientRect(); const cs = getComputedStyle(svg);
      return { id, w: Math.round(r.width), h: Math.round(r.height), sw: cs.strokeWidth };
    });
    const navSvgs = ['btnPrev','nextLine'].map(id => {
      const svg = document.getElementById(id).querySelector('svg');
      return { id, w: Math.round(svg.getBoundingClientRect().width), sw: getComputedStyle(svg).strokeWidth };
    });
    rows.push(...navSvgs);
    return { inside, nextW: Math.round(nr.width), prevW: Math.round(pr.width), rows,
             footer: !!n.closest('.vfoot') };
  };
  closeMenu(); hideDone(); S.home = false; openSetHome(0); render(); applyLayout();
  await new Promise(r => setTimeout(r, 250));
  const counter = grab();
  S.read = true; render(); applyLayout();
  await new Promise(r => setTimeout(r, 300));
  const reading = grab();
  S.read = false; render(); applyLayout();
  await new Promise(r => setTimeout(r, 200));
  return { counter, reading };
});
ok(navRow.counter.inside, 'زرّا التنقّل داخل حدود الشاشة (وضع العدّ)');
ok(navRow.reading.inside && navRow.reading.footer, 'وداخل الحدود أيضًا في وضع القراءة (لأنهما في التذييل)', 'vfoot');
ok(navRow.counter.prevW >= 20 && navRow.counter.nextW >= 20, 'مساحة لمس مقبولة', `${navRow.counter.prevW}·${navRow.counter.nextW}`);
const bar = navRow.counter.rows.filter(r => ['btnReset','btnDist','btnPrompt','btnMenu'].includes(r.id)).map(r => r.w);
const nav = navRow.counter.rows.filter(r => ['btnPrev','nextLine'].includes(r.id)).map(r => r.w);
const sws = [...new Set(navRow.counter.rows.map(r => r.sw))];
ok(new Set(bar).size === 1, 'أيقونات صف الأدوات بمقاس واحد بالقياس الحقيقي', bar.join(' · '));
ok(new Set(nav).size === 1, 'وأيقونتا التنقّل بمقاس واحد بينهما (أصغر عمدًا)', nav.join(' · '));
ok(sws.length === 1, 'وسماكة القلم واحدة في الجميع', sws.join(' · '));

head('⑦د ☀️🌙 الوضع النهاري: يبدّل الخلفية والخطوط فعلًا — وبلا خروج عن الشاشة');
const dayMode = await page.evaluate(async () => {
  const raf = () => new Promise(r => setTimeout(r, 250));
  const grab = () => {
    const sc = document.getElementById('screen').getBoundingClientRect();
    const bad = [...document.querySelectorAll('#screen .view.on *, #screen .home.on *, #screen .nextline')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < sc.left - 1 || r.right > sc.right + 1); }).length;
    const dh = document.querySelector('#screen .dhikr');
    const cs = getComputedStyle(document.getElementById('screen'));
    // الخلفية قد تكون تدرّجًا (background-image) لا لونًا مسطّحًا — نأخذ أول لون فعلي
    const first = (cs.backgroundImage.match(/rgba?\([^)]+\)/) || [])
                    .concat(cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? [cs.backgroundColor] : [])[0];
    return { bg: first || cs.backgroundColor, gradient: cs.backgroundImage !== 'none',
             dhikrColor: getComputedStyle(dh).color, bad };
  };
  setTheme('night'); render(); applyLayout(); await raf();
  const night = grab();
  setTheme('day'); render(); applyLayout(); await raf();
  const day = grab();
  setTheme('auto'); render(); applyLayout(); await raf();
  return { night, day, dayCls: S.theme };
});
const lum = c => { const m = c.match(/\d+/g) || [255,255,255]; return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
// 📐 تباين WCAG الحقيقي (ترميز خطّي) — المعيار النهاري: ≥ ٣٫٠ على الأسطح الورقية
const rgbOf = c => (String(c).match(/[\d.]+/g) || [0,0,0]).map(Number);
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const relLum = c => { const [r,g,b] = rgbOf(c).slice(0,3); return 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b); };
const contrast = (c1, c2) => { const a = relLum(c1), b = relLum(c2);
  return Math.round(((Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05)) * 100) / 100; };
ok(lum(dayMode.day.bg) > 0.7 && dayMode.day.gradient, 'الوضع النهاري: خلفية فاتحة فعلًا (تدرّج ورقي دافئ)', dayMode.day.bg)
// 🏠 بطاقات الشاشة الرئيسية في النهاري: النصوص داكنة (كانت فاتحة فتظهر باهتة)
const homeDay = await page.evaluate(async () => {
  closeMenu(); setTheme('day'); goHome();
  await new Promise(r => setTimeout(r, 300));
  const g = sel => { const el = document.querySelector('.home ' + sel); if (!el) return null;
    return { l: getComputedStyle(el).color, bg: getComputedStyle(el.closest('.tile') || el).backgroundColor,
             cls: document.getElementById('screen').className }; };
  const out = { name: g('.tile .nm'), cnt: g('.tile .cnt'), htitle: g('.htitle') };
  setTheme('auto'); S.home = false; renderHome(); render(); applyLayout();
  return out;
});
// نُمزج شفافية البطاقة مع خلفية الشاشة لنقيس تباين النصّ على السطح الفعلي
const blendOn = (fg, bg) => { const f = rgbOf(fg), b = rgbOf(bg); const a = f.length > 3 ? f[3] : 1;
  return `rgb(${f.slice(0,3).map((v,i) => Math.round(v*a + b[i]*(1-a))).join(',')})`; };
const nameC = homeDay.name ? contrast(homeDay.name.l, blendOn(homeDay.name.bg, 'rgb(251,248,241)')) : 0;
const cntC  = homeDay.cnt  ? contrast(homeDay.cnt.l,  blendOn(homeDay.cnt.bg,  'rgb(251,248,241)')) : 0;
ok(nameC >= 4.5, 'وأسماء المجموعات في الرئيسية داكنة على البطاقات الفاتحة (تباين ≥ ٤٫٥)', `تباين ${nameC} · ${homeDay.name && homeDay.name.l}`);
ok(cntC >= 3.0, 'وعدّ الذكر على البطاقة مقروء كذلك نهارًا (تباين ≥ ٣٫٠)', `تباين ${cntC} · ${homeDay.cnt && homeDay.cnt.l}`);
ok(lum(dayMode.night.bg) < 0.3, 'والوضع الليلي: خلفية داكنة', dayMode.night.bg);
ok(lum(dayMode.day.dhikrColor) < 0.35, 'وفي النهاري يصير نصّ الذكر داكنًا (تباين صحيح)', dayMode.day.dhikrColor);
ok(lum(dayMode.night.dhikrColor) > 0.7, 'وفي الليلي يبقى فاتحًا', dayMode.night.dhikrColor);
ok(dayMode.day.bad === 0 && dayMode.night.bad === 0, 'ولا عنصر يخرج عن الشاشة في الوضعين');

head('⑦هـ 🌙 الشاشة الخافتة: اسم الذكر والعدّاد بشكل خافت (طلب المستخدم)');
const aod = await page.evaluate(async () => {
  document.getElementById('menu').classList.remove('on');
  document.getElementById('mscrim').classList.remove('on');
  S.menu = false; S.read = false; S.home = false; openSetHome(1); S.c = 12; render(); applyLayout();
  if (!S.aod) toggleAOD();
  await new Promise(r => setTimeout(r, 400));
  const d = document.getElementById('aodDhikr'), bar = document.getElementById('aodBar'), num = document.getElementById('aodNum');
  const sc = document.getElementById('screen').getBoundingClientRect();
  const rd = d.getBoundingClientRect();
  const c = getComputedStyle(d).color;
  return { shown: document.getElementById('aod').classList.contains('on'),
           dhikr: d.textContent.trim().slice(0, 22), w: rd.width,
           inside: rd.left >= sc.left - 1 && rd.right <= sc.right + 1 && rd.top >= sc.top - 1 && rd.bottom <= sc.bottom + 1,
           color: c, num: num.textContent, barW: bar.style.width };
});
const aodLum = lum(aod.color);
ok(aod.shown && aod.w > 40, 'الشاشة الخافتة تُعرض', aod.dhikr);
ok(aod.inside, 'واسم الذكر داخلها بأناقة (لا يخرج عن الشاشة)');
ok(aodLum > 0.15 && aodLum < 0.75, 'وبلون «خافت» فعلًا (بين الظلام والوضوح الكامل)', aod.color);
ok(aod.num === '12', 'والعدّاد ظاهر في الشاشة الخافتة', aod.num);
ok(aod.barW !== '0%', 'وشريط تقدّم الذكر ظاهر خافتًا', aod.barW);
const elAodShot = await page.$('#screen');
await elAodShot.screenshot({ path: path.join(SHOTS, '23-الشاشة-الخافتة-بالذكر.png') });
await page.evaluate(() => { if (S.aod) toggleAOD(); closeMenu(); goHome(); render(); applyLayout(); });
await new Promise(r => setTimeout(r, 300));

/* ═══════════ ⑧ شاشة الإتمام: عبر كل المجموعات (٨ حالات) ═══════════ */
head('⑧ شاشة الإتمام: ٨ مجموعات · لا كلمة خارج خليتها · لا خروج عن الشاشة');
const done = await page.evaluate(async () => {
  const raf = () => new Promise(r => requestAnimationFrame(r));
  const out = [];
  const snapshot = JSON.parse(JSON.stringify({ si: S.si, ii: S.ii, c: S.c }));
  for (let si = 0; si < SETS.length; si++) {
    hideDone();
    S.si = si; S.ii = SETS[si].items.length - 1; S.c = SETS[si].items[S.ii].n; S.done = false; S.start = Date.now() - 214000;
    render(); applyLayout(); await raf();
    if (S.done) { /* مجموعة مكتملة سابقًا */ }
    advanceOrFinish('tap');
    await new Promise(r => setTimeout(r, 800));
    const screen = document.querySelector('#screen').getBoundingClientRect();
    const cells = [...document.querySelectorAll('#doneView .scell')];
    // القصّ الأفقي هو ما يزعج العين (كلمة تخرج عن خليتها)؛ الرأسي نسمح فيه بهامش المحارف العربية
    const clipped = [...document.querySelectorAll('#doneView .scell b, #doneView .ttl, #doneView .dua')]
      .filter(e => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 6).length;
    const outside = ['#doneView .ttl', '#doneView .dua', '#doneView .stats', '#doneView .btns']
      .map(q => document.querySelector(q))
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < screen.left - 0.5 || r.right > screen.right + 0.5); }).length;
    out.push({ set: SETS[si].title, cells: cells.length, clipped, outside,
               time: document.getElementById('dTime').textContent.trim(),
               vals: cells.map(e => e.textContent.trim()) });
    hideDone();
  }
  S.si = snapshot.si; S.ii = snapshot.ii; S.c = snapshot.c; hideDone(); render(); applyLayout();
  return out;
});
ok(done.every(d => d.cells === 3), 'كل مجموعة: ثلاث خلايا ملخّص', `حالات: ${done.length}`);
ok(done.every(d => d.clipped === 0), 'لا كلمة مقصوصة في أي مجموعة', done.filter(d => d.clipped).map(d => d.set).join(' · ') || 'صفر حالة');
ok(done.every(d => d.outside === 0), 'لا عنصر يخرج عن شاشة الساعة', done.filter(d => d.outside).map(d => d.set).join(' · ') || 'صفر حالة');
ok(done.every(d => /^\d+:\d\d$|^\d+ ث$/.test(d.time)), 'المدة قصيرة في كل الحالات', done.map(d => d.time).join(' · '));

console.log(`\n${'─'.repeat(58)}`);
console.log(`  النتيجة: ${pass} ✔ · ${fail} ✘`);
await browser.close();
process.exit(fail ? 1 : 0);
